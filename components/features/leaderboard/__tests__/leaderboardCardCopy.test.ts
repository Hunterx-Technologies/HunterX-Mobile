import {
  LEADERBOARD_CARD_COPY,
  buildCardCopy,
  fillTemplate,
  hashString,
  localDateKey,
  normalizePercent,
  pickVariant,
  type CardCopyTable,
} from '@/components/features/leaderboard/leaderboardCardCopy';
import type { LeaderboardMe } from '@/types/leaderboard';

const USER = 'user-42';
const DAY = new Date(2026, 9, 29, 9, 0); // local time

function makeMe(overrides: Partial<LeaderboardMe> = {}): LeaderboardMe {
  return {
    status: 'ranked',
    rank: 8,
    totalXp: 1250,
    level: 3,
    rankName: null,
    name: 'sunil',
    avatarThumbUrl: null,
    totalRanked: 120,
    topPercent: null,
    streak: null,
    ...overrides,
  };
}

/** A table whose every case uses the live entry, so tests can override one. */
function tableWith(overrides: Partial<CardCopyTable>): CardCopyTable {
  return { ...LEADERBOARD_CARD_COPY, ...overrides };
}

describe('buildCardCopy — case order', () => {
  it('hidden wins over everything else, and is a link', () => {
    const copy = buildCardCopy(makeMe({ status: 'hidden', rank: 1, topPercent: 1 }), USER, DAY);
    expect(copy?.caseKey).toBe('hidden');
    expect(copy?.title).toBe("You're hidden from leaderboards");
    expect(copy?.highlight).toBeNull();
    expect(copy?.isLink).toBe(true);
  });

  it('unranked_no_xp shows the join prompt', () => {
    const copy = buildCardCopy(makeMe({ status: 'unranked_no_xp', rank: null }), USER, DAY);
    expect(copy?.caseKey).toBe('unrankedNoXp');
    expect(copy?.title).toBe('Complete your first quest to join the leaderboard');
    expect(copy?.isLink).toBe(false);
  });

  it.each([
    [1, 'rank1', 'Apex Hunter 👑'],
    [2, 'rank2', 'Silver Hunter'],
    [3, 'rank3', 'Bronze Hunter'],
  ])('rank %i uses the %s badge even when a percent is present', (rank, caseKey, highlight) => {
    const copy = buildCardCopy(makeMe({ rank, topPercent: 1 }), USER, DAY);
    expect(copy?.caseKey).toBe(caseKey);
    expect(copy?.highlight).toBe(highlight);
    expect(copy?.title).toBeNull();
  });

  it('rank 4+ with a percent uses a percentile tier before rank-only', () => {
    expect(buildCardCopy(makeMe({ topPercent: 12 }), USER, DAY)?.caseKey).toBe('pctTop25');
  });

  it('rank-only shows "Rank #N of T"', () => {
    const copy = buildCardCopy(makeMe(), USER, DAY);
    expect(copy?.caseKey).toBe('rankOnly');
    expect(copy?.highlight).toBe('Rank #8 of 120');
  });

  it('rank-only drops "of T" when the total is missing', () => {
    const copy = buildCardCopy(makeMe({ totalRanked: null }), USER, DAY);
    expect(copy?.highlight).toBe('Rank #8');
  });

  it('falls back to XP when there is no rank and no percent', () => {
    const copy = buildCardCopy(makeMe({ rank: null, topPercent: null }), USER, DAY);
    expect(copy?.caseKey).toBe('xpOnly');
    expect(copy?.highlight).toBe('1,250 XP');
    expect(copy?.subtitle).toBe('Rankings are catching up — your XP is safe.');
  });
});

describe('buildCardCopy — percentile tiers', () => {
  it.each([
    [0.4, 'pctTop1', '1'],
    [1, 'pctTop1', '1'],
    [1.4, 'pctTop1', '1'],
    [1.6, 'pctTop5', '2'],
    [5, 'pctTop5', '5'],
    [6, 'pctTop25', '6'],
    [25, 'pctTop25', '25'],
    [25.4, 'pctTop25', '25'],
    [26, 'pctTop50', '26'],
    [50, 'pctTop50', '50'],
    [51, 'pctRest', '51'],
    [100, 'pctRest', '100'],
    [140, 'pctRest', '100'],
    [-3, 'pctTop1', '1'],
  ])('topPercent %p → %s showing Top %s%%', (topPercent, caseKey, shown) => {
    const copy = buildCardCopy(makeMe({ topPercent }), USER, DAY);
    expect(copy?.caseKey).toBe(caseKey);
    expect(copy?.highlight).toBe(`Top ${shown}%`);
  });

  it.each([NaN, Infinity, -Infinity, null, undefined, '12' as unknown as number])(
    'invalid topPercent %p falls through to rank-only',
    (topPercent) => {
      const copy = buildCardCopy(makeMe({ topPercent: topPercent as number | null }), USER, DAY);
      expect(copy?.caseKey).toBe('rankOnly');
    }
  );

  it('invalid topPercent with no rank falls through to XP', () => {
    const copy = buildCardCopy(makeMe({ topPercent: NaN, rank: null }), USER, DAY);
    expect(copy?.caseKey).toBe('xpOnly');
  });
});

describe('normalizePercent', () => {
  it('rounds and clamps to 1..100', () => {
    expect(normalizePercent(12.5)).toBe(13);
    expect(normalizePercent(0)).toBe(1);
    expect(normalizePercent(250)).toBe(100);
  });

  it('rejects non-finite values', () => {
    expect(normalizePercent(NaN)).toBeNull();
    expect(normalizePercent(null)).toBeNull();
    expect(normalizePercent(undefined)).toBeNull();
  });
});

describe('placeholders', () => {
  const allPlaceholders = tableWith({
    rankOnly: {
      highlights: ['Rank #{rank}'],
      subtitles: [
        'pct={pct} ahead={ahead} rank={rank} total={total} behind={behind} xp={xp} next={xpToNext} streak={streak}',
      ],
      isLink: false,
    },
  });

  it('fills every placeholder from server data', () => {
    // 12% lands in the top-25 tier, so point that tier at the all-placeholder copy.
    const table = tableWith({ pctTop25: allPlaceholders.rankOnly });
    const copy = buildCardCopy(
      makeMe({ topPercent: 12.4, xpToNextRank: 1500, streak: 6, totalXp: 98765 }),
      USER,
      DAY,
      table
    );
    expect(copy?.subtitle).toBe(
      'pct=12 ahead=88 rank=8 total=120 behind=112 xp=98,765 next=1,500 streak=6'
    );
  });

  it('never renders a variant with a missing placeholder', () => {
    const table = tableWith({
      rankOnly: {
        highlights: ['Rank #{rank}'],
        subtitles: ['On a {streak}-day streak.', 'Only {xpToNext} XP to the next spot.', 'Plain line.'],
        isLink: false,
      },
    });
    // No streak, no xpToNextRank → only the plain line can render, on any day.
    for (let d = 1; d <= 31; d++) {
      const copy = buildCardCopy(makeMe(), `user-${d}`, new Date(2026, 0, d), table);
      expect(copy?.subtitle).toBe('Plain line.');
    }
  });

  it.each([
    ['streak 0', { streak: 0 }],
    ['streak null', { streak: null }],
    ['streak missing', { streak: undefined }],
    ['xpToNextRank 0', { xpToNextRank: 0 }],
    ['xpToNextRank NaN', { xpToNextRank: NaN }],
  ])('treats %s as missing', (_label, overrides) => {
    const table = tableWith({
      rankOnly: {
        highlights: ['Rank #{rank}'],
        subtitles: ['{streak}|{xpToNext}', 'fallback'],
        isLink: false,
      },
    });
    const copy = buildCardCopy(makeMe({ streak: 3, xpToNextRank: 10, ...overrides }), USER, DAY, table);
    expect(copy?.subtitle).toBe('fallback');
  });

  it('drops {behind} when rank exceeds total (stale counts)', () => {
    const table = tableWith({
      rankOnly: { highlights: ['Rank #{rank}'], subtitles: ['{behind} behind', 'fallback'], isLink: false },
    });
    const copy = buildCardCopy(makeMe({ rank: 130, totalRanked: 120 }), USER, DAY, table);
    expect(copy?.subtitle).toBe('fallback');
  });

  it('falls through to the next case when no subtitle can render', () => {
    const table = tableWith({
      pctTop25: { highlights: ['Top {pct}%'], subtitles: ['{streak} days'], isLink: false },
    });
    const copy = buildCardCopy(makeMe({ topPercent: 12 }), USER, DAY, table);
    expect(copy?.caseKey).toBe('rankOnly');
  });

  it('never shows undefined, NaN or a raw placeholder in the live copy', () => {
    const variants: Partial<LeaderboardMe>[] = [
      { status: 'hidden' },
      { status: 'unranked_no_xp', rank: null },
      { rank: 1 },
      { rank: 2 },
      { rank: 3 },
      { topPercent: 1 },
      { topPercent: 4 },
      { topPercent: 20 },
      { topPercent: 40 },
      { topPercent: 80 },
      { topPercent: NaN },
      { totalRanked: null },
      { rank: null },
      { rank: null, totalXp: NaN },
    ];
    for (const overrides of variants) {
      for (let d = 1; d <= 14; d++) {
        const copy = buildCardCopy(makeMe(overrides), `u${d}`, new Date(2026, 5, d));
        const text = [copy?.title, copy?.highlight, copy?.subtitle].join(' ');
        expect(text).not.toMatch(/undefined|NaN|\{\w+\}/);
      }
    }
  });
});

describe('fillTemplate', () => {
  it('returns null when a value is missing or empty', () => {
    expect(fillTemplate('Top {pct}%', {})).toBeNull();
    expect(fillTemplate('Top {pct}%', { pct: '' })).toBeNull();
    expect(fillTemplate('Top {pct}%', { pct: '7' })).toBe('Top 7%');
    expect(fillTemplate('No placeholders', {})).toBe('No placeholders');
  });
});

describe('variant picker', () => {
  const variants = ['a', 'b', 'c', 'd', 'e'];

  it('is stable for the same user on the same local day', () => {
    const morning = new Date(2026, 9, 29, 0, 1);
    const night = new Date(2026, 9, 29, 23, 59);
    expect(pickVariant(variants, USER, morning)).toBe(pickVariant(variants, USER, night));
  });

  it('does not use Math.random', () => {
    const spy = jest.spyOn(Math, 'random');
    pickVariant(variants, USER, DAY);
    buildCardCopy(makeMe({ topPercent: 12 }), USER, DAY);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('changes across days for the same user', () => {
    const picks = new Set<string | undefined>();
    for (let d = 1; d <= 30; d++) picks.add(pickVariant(variants, USER, new Date(2026, 10, d)));
    expect(picks.size).toBeGreaterThan(1);
  });

  it('spreads across users on the same day', () => {
    const picks = new Set<string | undefined>();
    for (let i = 0; i < 50; i++) picks.add(pickVariant(variants, `user-${i}`, DAY));
    expect(picks.size).toBe(variants.length);
  });

  it('is index = hash(userId + local date) % length', () => {
    const expected = variants[hashString(USER + '2026-10-29') % variants.length];
    expect(pickVariant(variants, USER, DAY)).toBe(expected);
  });

  it('returns undefined for no variants', () => {
    expect(pickVariant([], USER, DAY)).toBeUndefined();
  });

  it('keys on the local date, zero-padded', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('subtitle stays the same within a day through buildCardCopy', () => {
    const table = tableWith({
      rankOnly: { highlights: ['Rank #{rank}'], subtitles: ['one', 'two', 'three', 'four'], isLink: false },
    });
    const a = buildCardCopy(makeMe(), USER, new Date(2026, 9, 29, 1), table);
    const b = buildCardCopy(makeMe(), USER, new Date(2026, 9, 29, 22), table);
    expect(a?.subtitle).toBe(b?.subtitle);
  });
});
