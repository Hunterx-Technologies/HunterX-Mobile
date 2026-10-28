/** "12 days", "1 day", or hours on the last day ("5 hours", "less than an hour"). */
export function deletionTimeLeft(deleteAt: string | number | Date, now = Date.now()): string {
  const ms = new Date(deleteAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return 'less than an hour';
  const hours = ms / 3_600_000;
  if (hours < 24) {
    const h = Math.floor(hours);
    return h < 1 ? 'less than an hour' : `${h} hour${h === 1 ? '' : 's'}`;
  }
  const days = Math.ceil(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}
