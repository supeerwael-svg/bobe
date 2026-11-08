import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/StatusBlock';
import type { AbsenceWorkspace } from '@/db/absences';
import { loadDailyReport, saveDailyReport, type DailyReportInput } from '@/db/dailyReports';
import { listCanteenEntriesForDates } from '@/db/canteen';
import type { CanteenEntry, DailyReportRecord } from '@/db/types';
import { DailyPagePreview } from '@/modules/absences/DailyPagePreview';
import { SupervisorRowsEditor, TeacherNotesEditor } from '@/modules/absences/DailyPage2Editors';
import {
  DetailsEditor,
  ParentRowsEditor,
  TextBlockEditor,
  type StudentOption,
} from '@/modules/absences/DailyReportEditors';
import { ReportExportBar } from '@/modules/absences/ReportTableView';
import { useSession } from '@/modules/auth/AuthContext';
import { isSchoolDay, isEnrolledOn } from '@/utils/absenceReports';
import { isIsoDate } from '@/utils/absences';
import { computePage2 } from '@/utils/dailyPage2';
import { exportDailyReportExcel } from '@/utils/dailyExcel';
import { buildStudentPagesHtml, type Page1Render } from '@/utils/dailyPageHtml';
import { buildPage2Html, type Page2Render } from '@/utils/dailyPage2Html';
import { studentDayAbsences } from '@/utils/dailyPage1';
import { printDailyPages } from '@/utils/printDailyPages';
import { schoolYearForDate } from '@/utils/schoolYear';
import { todayIso } from '@/utils/dates';

type EditTarget = 'parents' | 'counselor' | 'details' | 'teachers' | 'observations' | 'canteen' | 'supervisors';
type SaveState = 'idle' | 'saved' | 'failed';

interface DailyReportViewProps {
  data: AbsenceWorkspace;
}

function inputFromRecord(record: DailyReportRecord): DailyReportInput {
  return {
    reportNumber: record.reportNumber,
    schoolYear: record.schoolYear,
    parentRows: record.parentRows,
    counselorNotes: record.counselorNotes,
    observationsActions: record.observationsActions,
    canteenNote: record.canteenNote,
    supervisorRows: record.supervisorRows,
    teacherNotes: record.teacherNotes,
  };
}

function defaultInput(date: string, reportNumberPrefix: string): DailyReportInput {
  return {
    reportNumber: reportNumberPrefix,
    schoolYear: schoolYearForDate(date),
    parentRows: [],
    counselorNotes: '',
    observationsActions: '/',
    canteenNote: '',
    supervisorRows: [],
    teacherNotes: {},
  };
}

export function DailyReportView({ data }: DailyReportViewProps) {
  const { t, i18n } = useTranslation();
  const { user, institution } = useSession();
  const [date, setDate] = useState(todayIso);
  const [extras, setExtras] = useState<DailyReportInput | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [loadFailed, setLoadFailed] = useState(false);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [canteenEntries, setCanteenEntries] = useState<CanteenEntry[] | null>(null);
  const validDate = isIsoDate(date);

  useEffect(() => {
    if (!validDate) return;
    let active = true;
    setExtras(null);
    setLoadFailed(false);
    loadDailyReport(institution.id, date)
      .then((record) => {
        if (!active) return;
        setExtras(record ? inputFromRecord(record) : defaultInput(date, institution.reportNumberPrefix ?? ''));
        setDirty(false);
        setSaveState('idle');
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, [institution.id, institution.reportNumberPrefix, date, validDate]);

  useEffect(() => {
    if (!validDate) return;
    let active = true;
    setCanteenEntries(null);
    listCanteenEntriesForDates(institution.id, [date])
      .then((entries) => {
        if (active) setCanteenEntries(entries);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, [institution.id, date, validDate]);

  const schoolDay = validDate && isSchoolDay(date, data.workingDays, new Set(data.holidayDates));
  const absences = validDate
    ? studentDayAbsences({
        date,
        students: data.students,
        classes: data.classes,
        absences: data.studentAbsences,
        slots: data.slots,
        workingDays: data.workingDays,
        holidayDates: data.holidayDates,
      })
    : [];
  const countRule = institution.absenceCountRule ?? 'wholeDay';

  const page2Computed =
    extras && validDate && canteenEntries
      ? computePage2({
          date,
          rule: countRule,
          classes: data.classes,
          students: data.students,
          slots: data.slots,
          studentAbsences: data.studentAbsences,
          teachers: data.teachers,
          teacherAbsences: data.teacherAbsences,
          supervisors: data.supervisors,
          supervisorRows: extras.supervisorRows,
          teacherNotes: extras.teacherNotes,
          canteenEntries,
          canteenTrackingStart: institution.canteenTrackingStart ?? null,
        })
      : null;

  const render: Page1Render | null =
    extras && validDate
      ? {
          wholeDay: absences.filter((item) => item.wholeDay),
          partial: absences.filter((item) => !item.wholeDay),
          parentRows: extras.parentRows,
          counselorNotes: extras.counselorNotes,
        }
      : null;

  const render2: Page2Render | null =
    extras && validDate && page2Computed
      ? {
          header: {
            wilaya: institution.directorate ?? '',
            schoolYear: extras.schoolYear,
            institution: institution.name,
            reportNumber: extras.reportNumber,
            city: institution.city ?? '',
            reportDate: date,
          },
          countRule,
          computed: page2Computed,
          observations: extras.observationsActions,
          canteenNote: extras.canteenNote,
          supervisorRows: extras.supervisorRows,
          counselorNotes: extras.counselorNotes,
        }
      : null;

  const pages = render && render2 ? [buildPage2Html(render2), ...buildStudentPagesHtml(render)] : [];

  const classNameById = new Map(data.classes.map((item) => [item.id, item.name]));
  const studentOptions: StudentOption[] = data.students
    .filter((student) => isEnrolledOn(student, date))
    .map((student) => ({
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      className: classNameById.get(student.classId) ?? '',
    }))
    .sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }) || a.name.localeCompare(b.name));

  const patchExtras = (patch: Partial<DailyReportInput>) => {
    setExtras((previous) => (previous ? { ...previous, ...patch } : previous));
    setDirty(true);
    setSaveState('idle');
  };

  const handleSave = async () => {
    if (!extras) return;
    try {
      await saveDailyReport(institution.id, date, extras, user.id);
      setDirty(false);
      setSaveState('saved');
    } catch {
      setSaveState('failed');
    }
  };

  const handleSectionClick = (section: string) => {
    setEditing(section as EditTarget);
  };

  const handlePrint = () => {
    if (pages.length) printDailyPages(pages, t('dailyReport.title'), i18n.language, i18n.dir());
  };

  const handleExcel = () => {
    if (render && render2) exportDailyReportExcel(render, render2, `daily-report-${date}.xlsx`);
  };

  const status = dirty
    ? { text: t('dailyReport.unsaved'), className: 'text-warning-700' }
    : saveState === 'saved'
      ? { text: t('dailyReport.saved'), className: 'text-success-700' }
      : saveState === 'failed'
        ? { text: t('dailyReport.saveFailed'), className: 'text-danger-700' }
        : null;

  return (
    <div className="flex flex-col gap-6">
      <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700 sm:max-w-xs">
        {t('absences.date')}
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="min-h-11 rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
      </label>

      {!validDate ? <FormError message={t('validation.invalidDate')} /> : null}
      {validDate && !schoolDay ? (
        <p className="rounded-xl bg-warning-50 p-4 text-sm text-warning-700">{t('reports.notSchoolDay')}</p>
      ) : null}
      {loadFailed ? <FormError message={t('dailyReport.loadFailed')} /> : null}

      {extras && render && render2 ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setEditing('details')}>
              {t('dailyReport.reportDetails')}
            </Button>
            <Button onClick={handleSave} disabled={!dirty}>
              {t('dailyReport.saveReport')}
            </Button>
            {status ? <span className={`text-sm font-medium ${status.className}`}>{status.text}</span> : null}
          </div>
          <ReportExportBar onPrint={handlePrint} onExcel={handleExcel} />
          <p className="text-sm text-neutral-500">{t('dailyReport.tapToEdit')}</p>
          <DailyPagePreview pages={pages} onSectionClick={handleSectionClick} />
        </>
      ) : null}

      {editing === 'parents' && extras ? (
        <ParentRowsEditor
          rows={extras.parentRows}
          students={studentOptions}
          absentToday={absences}
          onApply={(parentRows) => {
            patchExtras({ parentRows });
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {editing === 'counselor' && extras ? (
        <TextBlockEditor
          title={t('dailyReport.counselorNotes')}
          notes={extras.counselorNotes}
          onApply={(counselorNotes) => {
            patchExtras({ counselorNotes });
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {editing === 'observations' && extras ? (
        <TextBlockEditor
          title={t('dailyReport.observations')}
          notes={extras.observationsActions}
          onApply={(observationsActions) => {
            patchExtras({ observationsActions });
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {editing === 'canteen' && extras ? (
        <TextBlockEditor
          title={t('dailyReport.canteenNote')}
          notes={extras.canteenNote}
          onApply={(canteenNote) => {
            patchExtras({ canteenNote });
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {editing === 'teachers' && extras && page2Computed ? (
        <TeacherNotesEditor
          lines={page2Computed.teacherLines}
          notes={extras.teacherNotes}
          onApply={(teacherNotes) => {
            patchExtras({ teacherNotes });
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {editing === 'supervisors' && extras ? (
        <SupervisorRowsEditor
          rows={extras.supervisorRows}
          supervisors={data.supervisors.map((item) => ({ id: item.id, name: item.name }))}
          onApply={(supervisorRows) => {
            patchExtras({ supervisorRows });
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {editing === 'details' && extras ? (
        <DetailsEditor
          reportNumber={extras.reportNumber}
          schoolYear={extras.schoolYear}
          onApply={(details) => {
            patchExtras(details);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
