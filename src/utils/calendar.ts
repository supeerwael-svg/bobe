const REFERENCE_SUNDAY = new Date(2024, 0, 7);

export function weekdayName(dayIndex: number, locale: string, style: 'short' | 'long' = 'short'): string {
  const date = new Date(REFERENCE_SUNDAY);
  date.setDate(REFERENCE_SUNDAY.getDate() + dayIndex);
  return new Intl.DateTimeFormat(locale, { weekday: style }).format(date);
}

export const WEEK_DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6] as const;
