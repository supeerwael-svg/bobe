import { useTranslation } from 'react-i18next';
import { weekdayName } from '@/utils/calendar';
import { slotKey } from '@/utils/timetableConflicts';
import type { SlotAvailability } from '@/utils/roomAvailability';
import type { Period } from '@/utils/schedule';

export interface HourSelection {
  day: number;
  period: number;
}

interface RoomHeatmapProps {
  days: number[];
  periods: Period[];
  availability: Map<string, SlotAvailability>;
  totalRooms: number;
  onSelect: (selection: HourSelection) => void;
}

export function RoomHeatmap({ days, periods, availability, totalRooms, onSelect }: RoomHeatmapProps) {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-5 overflow-x-auto px-5 pb-1">
        <table className="w-full min-w-[30rem] border-separate border-spacing-1.5">
          <thead>
            <tr>
              <th scope="col" aria-hidden className="w-20" />
              {periods.map((period) => (
                <th key={period.number} scope="col" className="px-1 pb-1 text-center text-xs font-medium text-neutral-500">
                  {period.start}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day}>
                <th scope="row" className="pe-2 text-start text-xs font-semibold text-neutral-700">
                  {weekdayName(day, i18n.language, 'short')}
                </th>
                {periods.map((period) => {
                  const cell = availability.get(slotKey(day, period.number));
                  const free = cell?.freeRoomIds.length ?? 0;
                  return (
                    <td key={period.number} className="p-0">
                      <button
                        type="button"
                        onClick={() => onSelect({ day, period: period.number })}
                        aria-label={t('rooms.freeOfTotal', { free, total: totalRooms })}
                        className={`flex h-14 w-full flex-col items-center justify-center rounded-lg text-sm font-bold ring-1 ring-inset transition duration-150 hover:scale-[1.04] hover:ring-2 active:scale-[0.97] ${heatTone(free, totalRooms)}`}
                      >
                        {free}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-neutral-700">
        <LegendItem className="bg-success-100 ring-success-300" label={t('rooms.legendHigh')} />
        <LegendItem className="bg-warning-100 ring-warning-300" label={t('rooms.legendMedium')} />
        <LegendItem className="bg-danger-100 ring-danger-300" label={t('rooms.legendLow')} />
      </div>
    </div>
  );
}

function heatTone(free: number, total: number): string {
  if (total === 0 || free === 0) return 'bg-danger-100 text-danger-800 ring-danger-300';
  const ratio = free / total;
  if (ratio >= 0.5) return 'bg-success-100 text-success-800 ring-success-300';
  return 'bg-warning-100 text-warning-800 ring-warning-300';
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`size-3.5 rounded ring-1 ${className}`} aria-hidden />
      {label}
    </span>
  );
}
