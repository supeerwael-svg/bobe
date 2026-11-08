import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, FileSpreadsheet, GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { FilterChip } from '@/components/ui/FilterChip';
import { EmptyState, ErrorState, FormError, LoadingState } from '@/components/ui/StatusBlock';
import { UndoToast } from '@/components/ui/UndoToast';
import { clearTimetableSlot, loadTimetableWorkspace, restoreTimetableSlot } from '@/db/timetable';
import type { TimetableSlot } from '@/db/types';
import { useSession } from '@/modules/auth/AuthContext';
import { TimetableGrid } from '@/modules/timetable/TimetableGrid';
import { SlotEditorModal, type SlotTarget } from '@/modules/timetable/SlotEditorModal';
import { TimetableImportScreen } from '@/modules/timetable/import/TimetableImportScreen';
import { weekdayName } from '@/utils/calendar';
import { errorKey } from '@/utils/errors';
import { findTimetableConflicts, slotKey, type TimetableConflict } from '@/utils/timetableConflicts';
import { useAsyncData } from '@/utils/useAsyncData';

interface UndoState {
  id: number;
  message: string;
  onUndo: () => void;
}

export function ScheduleView() {
  const { t, i18n } = useTranslation();
  const { user, institution } = useSession();
  const workspace = useAsyncData(() => loadTimetableWorkspace(institution.id, user.id), [institution.id, user.id]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [target, setTarget] = useState<SlotTarget | null>(null);
  const [pendingClear, setPendingClear] = useState<TimetableSlot | null>(null);
  const [clearing, setClearing] = useState(false);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const dismissUndo = useCallback(() => setUndo(null), []);

  const data = workspace.data;
  const classes = useMemo(() => data?.classes ?? [], [data]);
  const classNameById = useMemo(() => new Map(classes.map((item) => [item.id, item.name])), [classes]);
  const teacherNameById = useMemo(() => new Map((data?.teachers ?? []).map((item) => [item.id, item.name])), [data]);
  const roomNameById = useMemo(() => new Map((data?.rooms ?? []).map((item) => [item.id, item.name])), [data]);
  const conflicts = useMemo(() => findTimetableConflicts(data?.slots ?? []), [data]);
  const canEdit = data?.access.canEdit ?? false;
  const days = useMemo(() => [...institution.workingDays].sort((a, b) => a - b), [institution.workingDays]);

  const activeClassId = classes.some((item) => item.id === selectedClassId) ? selectedClassId : (classes[0]?.id ?? null);
  const activeClassName = classes.find((item) => item.id === activeClassId)?.name ?? '';
  const classSlots = useMemo(
    () => (data?.slots ?? []).filter((slot) => slot.classId === activeClassId),
    [data, activeClassId],
  );
  const slotByKey = useMemo(() => new Map(classSlots.map((slot) => [slotKey(slot.day, slot.period), slot])), [classSlots]);
  const classConflicts = conflicts.filter((conflict) => activeClassId !== null && conflict.classIds.includes(activeClassId));
  const conflictKeys = new Set(classConflicts.map((conflict) => slotKey(conflict.day, conflict.period)));

  const describeConflict = (conflict: TimetableConflict) => {
    const params = {
      day: weekdayName(conflict.day, i18n.language, 'long'),
      period: conflict.period,
      classes: conflict.classIds.map((id) => classNameById.get(id) ?? '').join(', '),
    };
    return conflict.kind === 'teacher'
      ? t('timetable.conflictTeacher', { ...params, name: teacherNameById.get(conflict.resourceId) ?? '' })
      : t('timetable.conflictRoom', { ...params, name: roomNameById.get(conflict.resourceId) ?? '' });
  };

  const handleClear = async () => {
    const slot = pendingClear;
    if (!slot) return;
    setClearing(true);
    setActionError(null);
    try {
      await clearTimetableSlot(slot.id, user.id);
      setPendingClear(null);
      setUndo({
        id: Date.now(),
        message: t('timetable.removed', { subject: slot.subject }),
        onUndo: () => {
          restoreTimetableSlot(slot.id, user.id)
            .then(() => workspace.reload())
            .catch((error: unknown) => setActionError(t(errorKey(error))));
        },
      });
      workspace.reload();
    } catch (error) {
      setPendingClear(null);
      setActionError(t(errorKey(error)));
    } finally {
      setClearing(false);
    }
  };

  if (importing && activeClassId) {
    return (
      <TimetableImportScreen
        classId={activeClassId}
        className={activeClassName}
        onBack={() => {
          setImporting(false);
          workspace.reload();
        }}
      />
    );
  }

  if (workspace.loading && !data) return <LoadingState />;
  if (workspace.error) return <ErrorState message={t(errorKey(workspace.error))} onRetry={workspace.reload} />;

  if (classes.length === 0) {
    return (
      <EmptyState
        icon={<GraduationCap className="size-7" aria-hidden />}
        title={t('timetable.noClassesTitle')}
        body={canEdit ? t('timetable.noClassesBody') : t('timetable.noAssignedClasses')}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <FormError message={actionError} />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {classes.map((schoolClass) => (
          <FilterChip
            key={schoolClass.id}
            label={schoolClass.name}
            active={schoolClass.id === activeClassId}
            onClick={() => setSelectedClassId(schoolClass.id)}
          />
        ))}
      </div>

      {canEdit ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-neutral-600">{t('timetable.classLabel')}: <span className="font-semibold text-neutral-900">{activeClassName}</span></p>
          <Button variant="secondary" onClick={() => setImporting(true)} icon={<FileSpreadsheet className="size-5" aria-hidden />}>
            {t('timetable.importExcel')}
          </Button>
        </div>
      ) : null}

      {classConflicts.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-2xl bg-danger-50 p-4 ring-1 ring-danger-200">
          <h2 className="flex items-center gap-2 text-base font-bold text-danger-700">
            <AlertTriangle className="size-5" aria-hidden />
            {t('timetable.conflictsTitle')}
          </h2>
          <ul className="flex flex-col gap-2 text-sm text-danger-800">
            {classConflicts.map((conflict) => (
              <li key={`${conflict.kind}-${conflict.day}-${conflict.period}-${conflict.resourceId}`}>{describeConflict(conflict)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <TimetableGrid
        days={days}
        slotByKey={slotByKey}
        conflictKeys={conflictKeys}
        teacherNameById={teacherNameById}
        roomNameById={roomNameById}
        canEdit={canEdit}
        onOpenSlot={(day, period) => {
          if (activeClassId === null) return;
          setTarget({ classId: activeClassId, day, period, slot: slotByKey.get(slotKey(day, period)) ?? null });
        }}
      />

      <SlotEditorModal
        target={target}
        teachers={data?.teachers ?? []}
        rooms={data?.rooms ?? []}
        onClose={() => setTarget(null)}
        onSaved={() => {
          setTarget(null);
          workspace.reload();
        }}
        onRemove={(slot) => {
          setTarget(null);
          setPendingClear(slot);
        }}
      />

      <ConfirmModal
        open={pendingClear !== null}
        title={t('timetable.clearTitle')}
        body={t('timetable.clearBody')}
        confirmLabel={t('timetable.clearSlot')}
        busy={clearing}
        onConfirm={handleClear}
        onCancel={() => setPendingClear(null)}
      />

      {undo ? <UndoToast key={undo.id} message={undo.message} onUndo={undo.onUndo} onExpire={dismissUndo} /> : null}
    </div>
  );
}
