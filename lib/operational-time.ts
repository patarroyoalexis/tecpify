export function getCurrentTimestamp() {
  return Date.now();
}

export function getCurrentDate() {
  return new Date(getCurrentTimestamp());
}

export function getCurrentIsoTimestamp() {
  return new Date(getCurrentTimestamp()).toISOString();
}

export function isSameUtcCalendarDay(left: Date, right: Date) {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

export function getStartOfUtcDay(date: Date) {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  return dayStart;
}

export function getStartOfUtcWeek(date: Date) {
  const weekStart = getStartOfUtcDay(date);
  const day = weekStart.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setUTCDate(weekStart.getUTCDate() + diff);
  return weekStart;
}

export function getStartOfUtcMonth(date: Date) {
  const monthStart = getStartOfUtcDay(date);
  monthStart.setUTCDate(1);
  return monthStart;
}
