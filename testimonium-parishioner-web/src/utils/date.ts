/**
 * Calculates a user-friendly countdown label relative to today for a given start date.
 * @param startDateStr The start date string of the event (YYYY-MM-DD).
 * @returns A friendly countdown string (e.g. "Today", "Tomorrow", "Starts in 3 days").
 */
export function getEventCountdownLabel(startDateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(startDateStr);
  start.setHours(0, 0, 0, 0);

  const diffTime = start.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Tomorrow';
  } else if (diffDays === -1) {
    return 'Yesterday';
  } else if (diffDays < -1) {
    return 'Completed';
  } else {
    return `Starts in ${diffDays} days`;
  }
}
