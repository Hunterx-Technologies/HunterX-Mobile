export type LeaderboardScope = 'global' | 'friends' | 'genz';

export type LeaderboardMeStatus = 'ranked' | 'unranked_no_xp' | 'hidden';

export type LeaderboardMe = {
  status: LeaderboardMeStatus;
  rank: number | null;
  totalXp: number;
  level: number;
  rankName: string | null;
  name: string;
  avatarThumbUrl: string | null;
  totalRanked: number | null;
  topPercent: number | null;
};

export type LeaderboardEntry = {
  rank: number | null;
  userId: string;
  name: string;
  avatarThumbUrl: string | null;
  level: number;
  rankName: string | null;
  totalXp: number;
  isMe: boolean;
};

export type LeaderboardEmptyState = null | 'no_friends' | 'no_entries';

export type LeaderboardPage = {
  entries: LeaderboardEntry[];
  me: LeaderboardMe | null;
  nextCursor: string | null;
  emptyState: LeaderboardEmptyState;
};
