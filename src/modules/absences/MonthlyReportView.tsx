import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormError } from '@/components/ui/StatusBlock';
import type { AbsenceWorkspace } from '@/db/absences';
import { buildMonthlyReport } from '@/modules/absences/reportData';
import { ReportExportBar, ReportTableView } from '@/modules/absences/ReportTableView';
import { monthlyReportTables, toWorkbookSheets } from '@/modules/absences/reportTables';
import { isMonthValue } from '@/utils/absenceReports';
import { todayIso } from '@/utils/dates';
import { exportSheetsToExcel } from '@/utils/spreadsheet';
import { printReport } from '@/utils/printReport';

interface MonthlyReportViewProps {
  data: AbsenceWorkspace;
}

export function MonthlyReportView({ data }: MonthlyReportViewProps) {
  const { t, i18n } = useTranslation();
  const [month, setMonth] = useState(() => todayIso().slice(0, 7));
  const validMonth = isMonthValue(month);
  const report = useMemo(() => (validMonth ? buildMonthlyReport(data, month) : null), [data, month, validMonth]);
  const tables = report ? monthlyReportTables(report, t) : [];

  const handlePrint = () => {
    printReport({
      title: t('reports.monthly.title'),
      subtitle: t('reports.monthly.subtitle', { month, days: report?.schoolDayCount ?? 0 }),
      lang: i18n.language,
      dir: i18n.dir(),
      sections: tables,
    });
  };

  const handleExcel = () => {
    exportSheetsToExcel(toWorkbookSheets(tables), `monthly-absence-report-${month}.xlsx`);
  };

  return (
    <div className="flex flex-col gap-6">
      <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700 sm:max-w-xs">
        {t('reports.month')}
        <input
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          className="min-h-11 rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
      </label>

      {!validMonth ? <FormError message={t('validation.invalidDate')} /> : null}

      {report ? (
        <>
          <p className="text-sm text-neutral-600">{t('reports.monthly.formula')}</p>
          <ReportExportBar onPrint={handlePrint} onExcel={handleExcel} />
          {tables.map((table) => (
            <ReportTableView key={table.sheetName} table={table} />
          ))}
        </>
      ) : null}
    </div>
  );
}
