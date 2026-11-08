import { useTranslation } from 'react-i18next';
import type { ClassStatistics } from '@/utils/statistics';

interface StatisticsChartsProps {
  rows: ClassStatistics[];
}

export function StatisticsCharts({ rows }: StatisticsChartsProps) {
  const { t } = useTranslation();
  const maxStudents = Math.max(1, ...rows.map((row) => row.students.total));

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChartCard title={t('statistics.chartGenderTitle')}>
        <Legend
          items={[
            { label: t('statistics.summaryBoys'), className: 'bg-secondary-500' },
            { label: t('statistics.summaryGirls'), className: 'bg-accent-500' },
          ]}
        />
        {rows.map((row) => {
          const boysPct = (row.students.boys / maxStudents) * 100;
          const girlsPct = (row.students.girls / maxStudents) * 100;
          return (
            <BarRow key={row.classId} label={row.name} value={row.students.total}>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full bg-secondary-500 transition-all duration-500" style={{ width: `${boysPct}%` }} />
                <div className="h-full bg-accent-500 transition-all duration-500" style={{ width: `${girlsPct}%` }} />
              </div>
            </BarRow>
          );
        })}
      </ChartCard>

      <ChartCard title={t('statistics.chartBoardingTitle')}>
        {rows.map((row) => {
          const pct = (row.halfBoarders.total / maxStudents) * 100;
          return (
            <BarRow key={row.classId} label={row.name} value={row.halfBoarders.total}>
              <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-primary-500 transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            </BarRow>
          );
        })}
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
      <h2 className="text-base font-bold text-neutral-900">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function BarRow({ label, value, children }: { label: string; value: number; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="truncate font-medium text-neutral-700">{label}</span>
        <span className="font-semibold text-neutral-900">{value}</span>
      </div>
      {children}
    </div>
  );
}

function Legend({ items }: { items: { label: string; className: string }[] }) {
  return (
    <div className="flex flex-wrap gap-4 text-sm text-neutral-600">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-2">
          <span className={`size-3 rounded-full ${item.className}`} aria-hidden />
          {item.label}
        </span>
      ))}
    </div>
  );
}
