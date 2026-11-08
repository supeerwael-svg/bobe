import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { TextField } from '@/components/ui/TextField';
import { SUPERVISOR_ATTENDANCE, type SupervisorAbsenceRow, type SupervisorAttendance } from '@/db/types';
import { INPUT_CLASS } from '@/modules/absences/DailyReportEditors';

export interface PersonOption {
  id: string;
  name: string;
}

export interface TeacherNoteLine {
  teacherId: string;
  name: string;
  classes: string;
}

const ATTENDANCE_KEYS = {
  none: 'dailyReport.attendance.none',
  absent: 'dailyReport.attendance.absent',
  late: 'dailyReport.attendance.late',
} as const;

export function emptySupervisorRow(): SupervisorAbsenceRow {
  return { supervisorId: null, name: '', morning: 'none', evening: 'none', notes: '' };
}

interface TeacherNotesEditorProps {
  lines: TeacherNoteLine[];
  notes: Record<string, string>;
  onApply: (notes: Record<string, string>) => void;
  onClose: () => void;
}

export function TeacherNotesEditor({ lines, notes, onApply, onClose }: TeacherNotesEditorProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(notes);
  return (
    <Modal open title={t('dailyReport.teacherNotes')} onClose={onClose}>
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pe-1">
        {lines.length === 0 ? <p className="text-sm text-neutral-600">{t('dailyReport.noAbsentTeachers')}</p> : null}
        {lines.map((line) => (
          <label key={line.teacherId} className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
            {line.name}
            {line.classes ? <span className="text-xs font-normal text-neutral-500">{line.classes}</span> : null}
            <textarea
              value={draft[line.teacherId] ?? ''}
              rows={3}
              placeholder={t('dailyReport.teacherNotesHint')}
              onChange={(event) => setDraft((previous) => ({ ...previous, [line.teacherId]: event.target.value }))}
              className="w-full rounded-xl border border-neutral-300 bg-white p-3 text-base font-normal text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </label>
        ))}
        <Button fullWidth onClick={() => onApply(draft)}>
          {t('dailyReport.apply')}
        </Button>
      </div>
    </Modal>
  );
}

interface SupervisorRowsEditorProps {
  rows: SupervisorAbsenceRow[];
  supervisors: PersonOption[];
  onApply: (rows: SupervisorAbsenceRow[]) => void;
  onClose: () => void;
}

export function SupervisorRowsEditor({ rows, supervisors, onApply, onClose }: SupervisorRowsEditorProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(rows);

  const update = (index: number, patch: Partial<SupervisorAbsenceRow>) =>
    setDraft((previous) => previous.map((row, position) => (position === index ? { ...row, ...patch } : row)));

  const pickSupervisor = (index: number, supervisorId: string) => {
    const supervisor = supervisors.find((item) => item.id === supervisorId);
    update(index, supervisor ? { supervisorId: supervisor.id, name: supervisor.name } : { supervisorId: null, name: '' });
  };

  const attendanceSelect = (label: string, value: SupervisorAttendance, onChange: (next: SupervisorAttendance) => void) => (
    <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
      {label}
      <select className={INPUT_CLASS} value={value} onChange={(event) => onChange(event.target.value as SupervisorAttendance)}>
        {SUPERVISOR_ATTENDANCE.map((option) => (
          <option key={option} value={option}>
            {t(ATTENDANCE_KEYS[option])}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Modal open title={t('dailyReport.supervisorRows')} onClose={onClose}>
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pe-1">
        {draft.map((row, index) => (
          <div key={index} className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-800">{t('dailyReport.rowNumber', { n: index + 1 })}</span>
              <Button variant="ghost" onClick={() => setDraft((previous) => previous.filter((_, position) => position !== index))}>
                {t('dailyReport.removeRow')}
              </Button>
            </div>
            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
              {t('dailyReport.chooseSupervisor')}
              <select className={INPUT_CLASS} value={row.supervisorId ?? ''} onChange={(event) => pickSupervisor(index, event.target.value)}>
                <option value="">{t('dailyReport.chooseSupervisor')}</option>
                {supervisors.map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>
                    {supervisor.name}
                  </option>
                ))}
              </select>
            </label>
            <TextField label={t('dailyReport.name')} value={row.name} onChange={(event) => update(index, { name: event.target.value, supervisorId: null })} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {attendanceSelect(t('dailyReport.morning'), row.morning, (morning) => update(index, { morning }))}
              {attendanceSelect(t('dailyReport.evening'), row.evening, (evening) => update(index, { evening }))}
            </div>
            <TextField label={t('dailyReport.notes')} value={row.notes} onChange={(event) => update(index, { notes: event.target.value })} />
          </div>
        ))}
        <Button variant="secondary" fullWidth onClick={() => setDraft((previous) => [...previous, emptySupervisorRow()])}>
          {t('dailyReport.addRow')}
        </Button>
        <Button fullWidth onClick={() => onApply(draft)}>
          {t('dailyReport.apply')}
        </Button>
      </div>
    </Modal>
  );
}
