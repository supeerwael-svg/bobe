import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import type { AbsenceWorkspace } from '@/db/absences';
import { DailyReportView } from '@/modules/absences/DailyReportView';
import { MonthlyReportView } from '@/modules/absences/MonthlyReportView';

type ReportKind = 'daily' | 'monthly';

export function ReportsView({ data }: { data: AbsenceWorkspace }) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<ReportKind>('daily');

  return (
    <div className="flex flex-col gap-6">
      <SegmentedControl<ReportKind>
        value={kind}
        onChange={setKind}
        options={[
          { id: 'daily', label: t('reports.kinds.daily') },
          { id: 'monthly', label: t('reports.kinds.monthly') },
        ]}
      />
      {kind === 'daily' ? <DailyReportView data={data} /> : <MonthlyReportView data={data} />}
    </div>
  );
}
