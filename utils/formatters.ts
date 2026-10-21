export function formatXp(xp: number): string {
  return xp.toLocaleString('en-US');
}

export function formatStreak(days: number): string {
  return `${days} day${days === 1 ? '' : 's'}`;
}

/** "now", "5m", "3h", "2d", then a short date ("12 Oct"). */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMin = Math.floor((now.getTime() - then.getTime()) / 60000);
  if (Number.isNaN(diffMin)) return '';
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
