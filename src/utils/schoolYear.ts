const SCHOOL_YEAR_START_MONTH = 9;

export function schoolYearForDate(date: string): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const startYear = month >= SCHOOL_YEAR_START_MONTH ? year : year - 1;
  return `${startYear}/${startYear + 1}`;
}
