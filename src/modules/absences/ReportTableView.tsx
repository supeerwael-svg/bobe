import { Download, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import type { ReportTable } from '@/modules/absences/reportTables';

interface ReportTableViewProps {
  table: ReportTable;
}

export function ReportTableView({ table }: ReportTableViewProps) {
  return (
    <section className="flex flex-col gap-3">
      {table.heading ? <h2 className="text-lg font-bold text-neutral-900">{table.heading}</h2> : null}
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-neutral-200">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              {table.headers.map((header, index) => (
                <th
                  key={index}
                  className={`px-4 py-3 font-semibold whitespace-nowrap ${index === 0 ? 'sticky l-0 z-10 bg-neutral-50 text-start' : 'text-end'}`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {table.rows.length === 0 && table.emptyLabel ? (
              <tr>
                <td colSpan={table.headers.length} className="px-4 py-6 text-center text-neutral-500">
                  {table.emptyLabel}
                </td>
              </tr>
            ) : (
              table.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="transition hover:bg-neutral-50">
                  {row.map((cell, index) => (
                    <td
                      key={index}
                      className={`px-4 py-3 whitespace-nowrap text-neutral-900 ${index === 0 ? 'sticky l-0 z-10 bg-white font-medium text-start' : 'text-end tabular-nums'}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {table.footer ? (
            <tfoot className="border-t-2 border-neutral-200 bg-neutral-50 font-bold text-neutral-900">
              <tr>
                {table.footer.map((cell, index) => (
                  <td
                    key={index}
                    className={`px-4 py-3 whitespace-nowrap ${index === 0 ? 'sticky l-0 z-10 bg-neutral-50 text-start' : 'text-end tabular-nums'}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  );
}

interface ReportExportBarProps {
  onPrint: () => void;
  onExcel: () => void;
}

export function ReportExportBar({ onPrint, onExcel }: ReportExportBarProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={onPrint} icon={<Printer className="size-4" aria-hidden />}>
        {t('reports.printPdf')}
      </Button>
      <Button variant="secondary" onClick={onExcel} icon={<Download className="size-4" aria-hidden />}>
        {t('reports.exportExcel')}
      </Button>
    </div>
  );
}
