import type Ionicons from '@expo/vector-icons/Ionicons';

/** Where the tour needs to be for a step: on a tab, or wherever it already is (tab bar). */
export type TutorialScreen = 'home' | 'battles' | 'profile' | 'any';

export type TutorialStep = {
  id: string;
  /** The <TutorialTarget id> to spotlight. None: a centred card (welcome / finish). */
  target?: string;
  screen: TutorialScreen;
  icon: keyof typeof Ionicons.glyphMap;
  eyebrow: string;
  title: string;
  body: string;
  /** Extra room around the target, and the spotlight's corner radius. */
  padding?: number;
  radius?: number;
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    screen: 'home',
    icon: 'sparkles',
    eyebrow: 'WELCOME, HUNTER',
    title: 'Your quick tour',
    body: "Let's walk you through where everything lives. It takes under a minute, and you can skip any time.",
  },
  {
    id: 'streak',
    target: 'home-streak',
    screen: 'home',
    icon: 'flame',
    eyebrow: 'STREAK',
    title: 'Keep the flame alive',
    body: 'Clear your daily quests to grow your streak. Every day in a row adds to the count right here.',
    radius: 24,
  },
  {
    id: 'notifications',
    target: 'home-notifications',
    screen: 'home',
    icon: 'notifications',
    eyebrow: 'NOTIFICATIONS',
    title: 'Never miss a thing',
    body: 'Rewards, friend requests and reminders land here. The orange count shows what you haven’t read.',
    radius: 24,
  },
  {
    id: 'week',
    target: 'home-week',
    screen: 'home',
    icon: 'calendar',
    eyebrow: 'ACTIVE CAMPAIGN',
    title: 'Your week at a glance',
    body: 'Each day you clear lights up on this track. Fill the whole week to stay on top of your campaign.',
    radius: 18,
  },
  {
    id: 'badges',
    target: 'home-badges',
    screen: 'home',
    icon: 'ribbon',
    eyebrow: 'BADGES',
    title: 'Unlock streak badges',
    body: 'Hit streak milestones to crack open new badges. Tap an earned badge to view it in your vault.',
    radius: 18,
  },
  {
    id: 'shuffle',
    target: 'home-shuffle',
    screen: 'home',
    icon: 'repeat',
    eyebrow: 'SHUFFLE',
    title: 'Shape your day',
    body: 'Add or remove routine daily quests (sleep, water, protein, steps) so your day fits you.',
    radius: 14,
  },
  {
    id: 'quests',
    target: 'home-quest-filters',
    screen: 'home',
    icon: 'checkmark-done',
    eyebrow: "TODAY'S QUESTS",
    title: 'Track every quest',
    body: 'Tap a quest’s tick box to complete it and earn XP. Done and skipped quests move to their own tabs.',
    radius: 14,
  },
  {
    id: 'metrics',
    target: 'tab-metrics',
    screen: 'any',
    icon: 'stats-chart',
    eyebrow: 'METRICS',
    title: 'See your progress',
    body: 'Your week, month and year in numbers, read from your phone’s health data.',
    padding: 4,
    radius: 16,
  },
  {
    id: 'leaderboard',
    target: 'battles-global',
    screen: 'battles',
    icon: 'trophy',
    eyebrow: 'BATTLES',
    title: 'Climb the leaderboard',
    body: 'Every quest you clear earns XP and moves you up. See where you rank against every hunter.',
    radius: 22,
  },
  {
    id: 'friends',
    target: 'battles-friends',
    screen: 'battles',
    icon: 'people',
    eyebrow: 'FRIENDS',
    title: 'Battle your friends',
    body: 'Compete on a board of just your friends. A red count here means friend requests are waiting: tap Invite to accept them.',
    radius: 22,
  },
  {
    id: 'profile',
    target: 'tab-profile',
    screen: 'any',
    icon: 'person',
    eyebrow: 'PROFILE',
    title: 'Your hunter HQ',
    body: 'Your badges, activity, invites and settings all live here. You can replay this tour from Profile too.',
    padding: 4,
    radius: 16,
  },
  {
    id: 'rewards',
    target: 'profile-rewards',
    screen: 'profile',
    icon: 'gift',
    eyebrow: 'SCRATCH CARDS',
    title: 'Scratch & claim rewards',
    body: 'Streak milestones, level-ups and special quests win you scratch cards. Open Rewards, scratch a card to reveal your prize, then tap Redeem now to claim it.',
    padding: 2,
    radius: 14,
  },
  {
    id: 'done',
    screen: 'home',
    icon: 'flash',
    eyebrow: "YOU'RE READY",
    title: 'Arise, Hunter',
    body: 'Your first quests are waiting. Clear them today to light your first streak flame.',
  },
];
