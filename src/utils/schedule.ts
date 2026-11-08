export interface Period {
  number: number;
  start: string;
  end: string;
}

export const LUNCH_BREAK = { start: '12:00', end: '13:00' } as const;

const PERIOD_COUNT = 7;
const FIRST_HOUR = 8;
const LUNCH_HOUR = 12;

const pad = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

export const PERIODS: Period[] = Array.from({ length: PERIOD_COUNT }, (_, index) => {
  const startHour = index < LUNCH_HOUR - FIRST_HOUR ? FIRST_HOUR + index : FIRST_HOUR + index + 1;
  return { number: index + 1, start: pad(startHour), end: pad(startHour + 1) };
});
