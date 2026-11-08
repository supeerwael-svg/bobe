import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { TextField } from '@/components/ui/TextField';
import type { ParentCorrespondenceRow } from '@/db/types';
import type { StudentDayAbsence } from '@/utils/dailyPage1';

export interface StudentOption {
  id: string;
  name: string;
  className: string;
}

export function emptyParentRow(): ParentCorrespondenceRow {
  return {
    studentId: null,
    name: '',
    className: '',
    hours: '',
    absenceDate: '',
    reason: '',
    firstNotice: '',
    secondNotice: '',
    excuse: '',
    struckDate: '',
  };
}

export const INPUT_CLASS =
  'min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200';

interface ParentRowsEditorProps {
  rows: ParentCorrespondenceRow[];
  students: StudentOption[];
  absentToday: StudentDayAbsence[];
  onApply: (rows: ParentCorrespondenceRow[]) => void;
  onClose: () => void;
}

export function ParentRowsEditor({ rows, students, absentToday, onApply, onClose }: ParentRowsEditorProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(rows);

  const update = (index: number, patch: Partial<ParentCorrespondenceRow>) =>
    setDraft((previous) => previous.map((row, position) => (position === index ? { ...row, ...patch } : row)));

  const pickStudent = (index: number, studentId: string) => {
    const student = students.find((item) => item.id === studentId);
    if (!student) {
      update(index, { studentId: null, name: '', className: '', hours: '', absenceDate: '' });
      return;
    }
    const absence = absentToday.find((item) => item.studentId === studentId);
    update(index, {
      studentId,
      name: student.name,
      className: student.className,
      hours: absence ? String(absence.hours) : '',
      absenceDate: absence ? absence.since : '',
    });
  };

  const removeRow = (index: number) => setDraft((previous) => previous.filter((_, position) => position !== index));

  return (
    <Modal open title={t('dailyReport.editParents')} onClose={onClose}>
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pe-1">
        {draft.map((row, index) => (
          <div key={index} className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-800">{t('dailyReport.rowNumber', { n: index + 1 })}</span>
              <Button variant="ghost" onClick={() => removeRow(index)}>
                {t('dailyReport.removeRow')}
              </Button>
            </div>
            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
              {t('dailyReport.chooseStudent')}
              <select
                className={INPUT_CLASS}
                value={row.studentId ?? ''}
                onChange={(event) => pickStudent(index, event.target.value)}
              >
                <option value="">{t('dailyReport.chooseStudent')}</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} - {student.className}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField label={t('dailyReport.name')} value={row.name} onChange={(e) => update(index, { name: e.target.value })} />
              <TextField label={t('dailyReport.className')} value={row.className} onChange={(e) => update(index, { className: e.target.value })} />
              <TextField label={t('dailyReport.hours')} value={row.hours} inputMode="numeric" onChange={(e) => update(index, { hours: e.target.value })} />
              <TextField label={t('dailyReport.absenceDate')} type="date" value={row.absenceDate} onChange={(e) => update(index, { absenceDate: e.target.value })} />
              <TextField label={t('dailyReport.reason')} value={row.reason} onChange={(e) => update(index, { reason: e.target.value })} />
              <TextField label={t('dailyReport.firstNotice')} value={row.firstNotice} onChange={(e) => update(index, { firstNotice: e.target.value })} />
              <TextField label={t('dailyReport.secondNotice')} value={row.secondNotice} onChange={(e) => update(index, { secondNotice: e.target.value })} />
              <TextField label={t('dailyReport.excuse')} value={row.excuse} onChange={(e) => update(index, { excuse: e.target.value })} />
              <TextField label={t('dailyReport.struckDate')} type="date" value={row.struckDate} onChange={(e) => update(index, { struckDate: e.target.value })} />
            </div>
          </div>
        ))}
        <Button variant="secondary" fullWidth onClick={() => setDraft((previous) => [...previous, emptyParentRow()])}>
          {t('dailyReport.addRow')}
        </Button>
        <Button fullWidth onClick={() => onApply(draft)}>
          {t('dailyReport.apply')}
        </Button>
      </div>
    </Modal>
  );
}

interface TextBlockEditorProps {
  title: string;
  notes: string;
  onApply: (notes: string) => void;
  onClose: () => void;
}

export function TextBlockEditor({ title, notes, onApply, onClose }: TextBlockEditorProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(notes);
  return (
    <Modal open title={title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <textarea
          value={draft}
          rows={10}
          onChange={(event) => setDraft(event.target.value)}
          className="w-full rounded-xl border border-neutral-300 bg-white p-3 text-base text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
        <Button fullWidth onClick={() => onApply(draft)}>
          {t('dailyReport.apply')}
        </Button>
      </div>
    </Modal>
  );
}

interface DetailsEditorProps {
  reportNumber: string;
  schoolYear: string;
  onApply: (details: { reportNumber: string; schoolYear: string }) => void;
  onClose: () => void;
}

export function DetailsEditor({ reportNumber, schoolYear, onApply, onClose }: DetailsEditorProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState({ reportNumber, schoolYear });
  return (
    <Modal open title={t('dailyReport.reportDetails')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <TextField
          label={t('dailyReport.reportNumber')}
          value={draft.reportNumber}
          onChange={(event) => setDraft((previous) => ({ ...previous, reportNumber: event.target.value }))}
        />
        <TextField
          label={t('dailyReport.schoolYear')}
          value={draft.schoolYear}
          onChange={(event) => setDraft((previous) => ({ ...previous, schoolYear: event.target.value }))}
        />
        <Button fullWidth onClick={() => onApply(draft)}>
          {t('dailyReport.apply')}
        </Button>
      </div>
    </Modal>
  );
}
