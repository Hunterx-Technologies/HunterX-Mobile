import type { LeaderboardMe } from '@/types/leaderboard';

// Copy for the "You" card at the top of the leaderboard. Each case has a
// title and several subtitle variants; one variant is picked per user per
// day (see pickVariant) so the line feels fresh without flickering.
//
// Placeholders: {pct} {ahead} {rank} {total} {behind} {xp} {xpToNext} {streak}.
// A variant whose placeholders can't all be filled is skipped. Only make
// claims about HunterX users — no comparisons with other groups and no
// health outcomes.

export type CardCaseKey =
  | 'hidden'
  | 'unrankedNoXp'
  | 'rank1'
  | 'rank2'
  | 'rank3'
  | 'pctTop1'
  | 'pctTop5'
  | 'pctTop25'
  | 'pctTop50'
  | 'pctRest'
  | 'rankOnly'
  | 'xpOnly';

export type CardCopyEntry = {
  /** Plain title (white). Used when there's no "You • …" highlight. */
  title?: string;
  /**
   * Rendered as "You • <highlight>". The first template whose placeholders
   * can all be filled wins, so later ones act as fallbacks.
   */
  highlights?: string[];
  subtitles: string[];
  isLink: boolean;
};

export type CardCopyTable = Record<CardCaseKey, CardCopyEntry>;

export const LEADERBOARD_CARD_COPY: CardCopyTable = {
  hidden: {
    title: "You're hidden from leaderboards",
    subtitles: ['Tap to manage visibility in System Settings'],
    isLink: true,
  },
  unrankedNoXp: {
    title: 'Complete your first quest to join the leaderboard',
    subtitles: ['Finish a quest today and claim your first rank.'],
    isLink: false,
  },
  rank1: {
    highlights: ['Apex Hunter 👑'],
    subtitles: ['Unrivaled. No one stands above you.'],
    isLink: false,
  },
  rank2: {
    highlights: ['Silver Hunter'],
    subtitles: ['One step from the Apex — keep climbing.'],
    isLink: false,
  },
  rank3: {
    highlights: ['Bronze Hunter'],
    subtitles: ['Among the Elite Three. The hunt continues.'],
    isLink: false,
  },
  pctTop1: {
    highlights: ['Top {pct}%'],
    subtitles: ['See how you compare and what keeps you ahead.'],
    isLink: false,
  },
  pctTop5: {
    highlights: ['Top {pct}%'],
    subtitles: ['See how you compare and what keeps you ahead.'],
    isLink: false,
  },
  pctTop25: {
    highlights: ['Top {pct}%'],
    subtitles: ['See how you compare and what keeps you ahead.'],
    isLink: false,
  },
  pctTop50: {
    highlights: ['Top {pct}%'],
    subtitles: ['See how you compare and what keeps you ahead.'],
    isLink: false,
  },
  pctRest: {
    highlights: ['Top {pct}%'],
    subtitles: ['See how you compare and what keeps you ahead.'],
    isLink: false,
  },
  rankOnly: {
    highlights: ['Rank #{rank} of {total}', 'Rank #{rank}'],
    subtitles: ['See how you compare and what keeps you ahead.'],
    isLink: false,
  },
  // Redis fallback mode — no rank available at all, only total XP.
  xpOnly: {
    highlights: ['{xp} XP'],
    subtitles: ['Rankings are catching up — your XP is safe.'],
    isLink: false,
  },
};

type Placeholder = 'pct' | 'ahead' | 'rank' | 'total' | 'behind' | 'xp' | 'xpToNext' | 'streak';
type PlaceholderValues = Partial<Record<Placeholder, string>>;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

/** Rounded and clamped to 1..100, or null when the server value is unusable. */
export function normalizePercent(topPercent: number | null | undefined): number | null {
  if (!isFiniteNumber(topPercent)) return null;
  return Math.min(100, Math.max(1, Math.round(topPercent)));
}

function percentTier(pct: number): CardCaseKey {
  if (pct <= 1) return 'pctTop1';
  if (pct <= 5) return 'pctTop5';
  if (pct <= 25) return 'pctTop25';
  if (pct <= 50) return 'pctTop50';
  return 'pctRest';
}

function placeholderValues(me: LeaderboardMe): PlaceholderValues {
  const values: PlaceholderValues = {};
  const pct = normalizePercent(me.topPercent);
  if (pct != null) {
    values.pct = String(pct);
    values.ahead = String(100 - pct);
  }
  if (isFiniteNumber(me.rank) && me.rank >= 1) values.rank = formatCount(me.rank);
  if (isFiniteNumber(me.totalRanked) && me.totalRanked >= 1) {
    values.total = formatCount(me.totalRanked);
    if (values.rank != null && me.totalRanked >= (me.rank as number)) {
      values.behind = formatCount(me.totalRanked - (me.rank as number));
    }
  }
  if (isFiniteNumber(me.totalXp)) values.xp = formatCount(me.totalXp);
  if (isFiniteNumber(me.xpToNextRank) && me.xpToNextRank > 0) {
    values.xpToNext = formatCount(me.xpToNextRank);
  }
  // A broken (0) streak isn't something to celebrate in copy.
  if (isFiniteNumber(me.streak) && me.streak >= 1) values.streak = formatCount(me.streak);
  return values;
}

const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;

/** Fills a template, or returns null if any placeholder has no value. */
export function fillTemplate(template: string, values: PlaceholderValues): string | null {
  let missing = false;
  const text = template.replace(PLACEHOLDER_PATTERN, (_match, name: string) => {
    const value = values[name as Placeholder];
    if (value == null || value === '') {
      missing = true;
      return '';
    }
    return value;
  });
  return missing ? null : text;
}

/** Local calendar date, so the variant rolls over at the user's midnight. */
export function localDateKey(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// 32-bit FNV-1a: small, stable across platforms, good enough spread for
// picking among a handful of variants.
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Same user + same local day → same variant. */
export function pickVariant<T>(variants: T[], userId: string, now: Date): T | undefined {
  if (variants.length === 0) return undefined;
  return variants[hashString(userId + localDateKey(now)) % variants.length];
}

/** Candidate cases in priority order; the first one that fully renders wins. */
function candidateCases(me: LeaderboardMe): CardCaseKey[] {
  if (me.status === 'hidden') return ['hidden'];
  if (me.status === 'unranked_no_xp') return ['unrankedNoXp'];
  if (me.rank === 1) return ['rank1'];
  if (me.rank === 2) return ['rank2'];
  if (me.rank === 3) return ['rank3'];

  const cases: CardCaseKey[] = [];
  const pct = normalizePercent(me.topPercent);
  if (pct != null) cases.push(percentTier(pct));
  if (me.rank != null) cases.push('rankOnly');
  cases.push('xpOnly');
  return cases;
}

export type CardCopy = {
  caseKey: CardCaseKey;
  /** Plain white title, when the case has one. */
  title: string | null;
  /** Orange part of "You • <highlight>", when the case uses that layout. */
  highlight: string | null;
  subtitle: string;
  isLink: boolean;
};

export function buildCardCopy(
  me: LeaderboardMe,
  userId: string,
  now: Date = new Date(),
  table: CardCopyTable = LEADERBOARD_CARD_COPY
): CardCopy | null {
  const values = placeholderValues(me);

  for (const caseKey of candidateCases(me)) {
    const entry = table[caseKey];

    let highlight: string | null = null;
    if (entry.highlights) {
      for (const template of entry.highlights) {
        highlight = fillTemplate(template, values);
        if (highlight != null) break;
      }
      if (highlight == null) continue;
    }

    const title = entry.title != null ? fillTemplate(entry.title, values) : null;
    if (entry.title != null && title == null) continue;

    const subtitles = entry.subtitles
      .map((template) => fillTemplate(template, values))
      .filter((text): text is string => text != null);
    const subtitle = pickVariant(subtitles, userId, now);
    if (subtitle == null) continue;

    return { caseKey, title, highlight, subtitle, isLink: entry.isLink };
  }
  return null;
}
