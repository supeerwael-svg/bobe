import { useMemo } from 'react';
import { Download, Printer, Users, UserRound, UsersRound, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StatusBlock';
import { loadStudentWorkspace } from '@/db/students';
import { useSession } from '@/modules/auth/AuthContext';
import { StatisticsCharts } from '@/modules/statistics/StatisticsCharts';
import { errorKey } from '@/utils/errors';
import { todayIso } from '@/utils/dates';
import { exportRowsToExcel } from '@/utils/spreadsheet';
import { printReport } from '@/utils/printReport';
import { buildClassStatistics, sumClassStatistics, type ClassStatistics, type GenderCounts } from '@/utils/statistics';
import { useAsyncData } from '@/utils/useAsyncData';

export function StatisticsScreen() {
  const { t, i18n } = useTranslation();
  const { user, institution } = useSession();
  const workspace = useAsyncData(() => loadStudentWorkspace(institution.id, user.id), [institution.id, user.id]);
  const today = todayIso();

  const data = workspace.data;
  const isHead = data?.access.isHead ?? false;
  const stats = useMemo(
    () => (data ? buildClassStatistics(data.classes, data.students, today) : []),
    [data, today],
  );
  const totals = useMemo(() => sumClassStatistics(stats), [stats]);

  const reportHeaders = [
    t('statistics.classColumn'),
    t('statistics.boysColumn'),
    t('statistics.girlsColumn'),
    t('statistics.totalColumn'),
    t('statistics.halfBoysColumn'),
    t('statistics.halfGirlsColumn'),
    t('statistics.halfBoardersColumn'),
  ];

  const buildReportRows = (): (string | number)[][] => {
    const classRows = stats.map((row) => statRowValues(row.name, row));
    const footer = [t('statistics.totalRow'), totals.students.boys, totals.students.girls, totals.students.total, totals.halfBoarders.boys, totals.halfBoarders.girls, totals.halfBoarders.total];
    return [...classRows, footer];
  };

  const handleExcel = () => {
    const rows = buildReportRows().map((values) =>
      Object.fromEntries(reportHeaders.map((header, index) => [header, values[index]])) as Record<string, string | number>,
    );
    exportRowsToExcel(rows, t('statistics.title'), 'student-statistics.xlsx');
  };

  const handlePrint = () => {
    const rows = buildReportRows();
    const footer = rows[rows.length - 1].map(String);
    printReport({
      title: t('statistics.reportTitle'),
      subtitle: t('statistics.reportSubtitle', { date: today }),
      lang: i18n.language,
      dir: i18n.dir(),
      sections: [
        {
          heading: null,
          headers: reportHeaders,
          rows: rows.slice(0, -1).map((values) => values.map(String)),
          footer,
        },
      ],
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl text-neutral-900">{t('statistics.title')}</h1>
          <p className="text-base text-neutral-600">{t('statistics.subtitle')}</p>
        </div>
      </header>

      {workspace.loading && !data ? (
        <LoadingState />
      ) : workspace.error ? (
        <ErrorState message={t(errorKey(workspace.error))} onRetry={workspace.reload} />
      ) : stats.length === 0 ? (
        <EmptyState icon={<Users className="size-7" aria-hidden />} title={t('statistics.empty')} body={t('statistics.scopeTotals')} />
      ) : (
        <>
          <p className="text-sm font-medium text-primary-700">
            {isHead ? t('statistics.institutionTotals') : t('statistics.scopeTotals')}
          </p>

          <section className="grid grid-cols-2 gap-3">
            <SummaryCard icon={<Users className="size-5" aria-hidden />} label={t('statistics.summaryStudents')} value={totals.students.total} tone="primary" />
            <SummaryCard icon={<UserRound className="size-5" aria-hidden />} label={t('statistics.summaryBoys')} value={totals.students.boys} tone="secondary" />
            <SummaryCard icon={<UsersRound className="size-5" aria-hidden />} label={t('statistics.summaryGirls')} value={totals.students.girls} tone="accent" />
            <SummaryCard icon={<Home className="size-5" aria-hidden />} label={t('statistics.summaryHalfBoarders')} value={totals.halfBoarders.total} tone="success" />
          </section>

          <StatisticsCharts rows={stats} />

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-neutral-900">{t('statistics.perClass')}</h2>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleExcel} icon={<Download className="size-4" aria-hidden />}>
                  {t('statistics.exportExcel')}
                </Button>
                <Button variant="secondary" onClick={handlePrint} icon={<Printer className="size-4" aria-hidden />}>
                  {t('statistics.exportPdf')}
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-neutral-200">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="bg-neutral-50 text-neutral-600">
                  <tr>
                    {reportHeaders.map((header, index) => (
                      <th key={header} className={`px-4 py-3 font-semibold ${index === 0 ? 'text-start' : 'text-end'}`}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {stats.map((row) => (
                    <tr key={row.classId} className="transition hover:bg-neutral-50">
                      {statRowValues(row.name, row).map((value, index) => (
                        <td key={index} className={`px-4 py-3 text-neutral-900 ${index === 0 ? 'font-medium text-start' : 'text-end tabular-nums'}`}>
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-neutral-200 bg-neutral-50 font-bold text-neutral-900">
                  <tr>
                    {buildReportRows()[stats.length].map((value, index) => (
                      <td key={index} className={`px-4 py-3 ${index === 0 ? 'text-start' : 'text-end tabular-nums'}`}>
                        {value}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function statRowValues(name: string, row: ClassStatistics): (string | number)[] {
  return [name, ...countValues(row.students), ...countValues(row.halfBoarders).slice(0, 0), row.halfBoarders.boys, row.halfBoarders.girls, row.halfBoarders.total];
}

function countValues(counts: GenderCounts): number[] {
  return [counts.boys, counts.girls, counts.total];
}

const TONE_CLASSES = {
  primary: 'bg-primary-50 text-primary-700',
  secondary: 'bg-secondary-50 text-secondary-700',
  accent: 'bg-accent-50 text-accent-700',
  success: 'bg-success-50 text-success-700',
} as const;

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: keyof typeof TONE_CLASSES;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200 transition hover:-translate-y-0.5 hover:shadow-md">
      <span className={`flex size-10 items-center justify-center rounded-xl ${TONE_CLASSES[tone]}`}>{icon}</span>
      <span className="text-sm text-neutral-600">{label}</span>
      <span className="text-2xl font-bold tabular-nums text-neutral-900">{value}</span>
    </div>
  );
}
