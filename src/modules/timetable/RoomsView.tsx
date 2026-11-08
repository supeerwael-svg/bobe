import { useMemo, useState, type FormEvent } from 'react';
import { DoorOpen, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { EmptyState, ErrorState, FormError, LoadingState } from '@/components/ui/StatusBlock';
import { TextField } from '@/components/ui/TextField';
import { UndoToast } from '@/components/ui/UndoToast';
import { createRoom, deleteRoom, restoreRoom } from '@/db/rooms';
import { loadTimetableWorkspace } from '@/db/timetable';
import type { Room } from '@/db/types';
import { TEXT_MAX_LENGTH } from '@/db/studentRules';
import { useSession } from '@/modules/auth/AuthContext';
import { RoomHeatmap, type HourSelection } from '@/modules/timetable/RoomHeatmap';
import { RoomHourModal } from '@/modules/timetable/RoomHourModal';
import { errorKey } from '@/utils/errors';
import { buildRoomAvailability } from '@/utils/roomAvailability';
import { PERIODS } from '@/utils/schedule';
import { useAsyncData } from '@/utils/useAsyncData';

const PERIOD_NUMBERS = PERIODS.map((period) => period.number);

interface UndoState {
  id: number;
  message: string;
  onUndo: () => void;
}

export function RoomsView() {
  const { t } = useTranslation();
  const { user, institution } = useSession();
  const workspace = useAsyncData(() => loadTimetableWorkspace(institution.id, user.id), [institution.id, user.id]);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Room | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selection, setSelection] = useState<HourSelection | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);

  const data = workspace.data;
  const rooms = useMemo(() => data?.rooms ?? [], [data]);
  const days = useMemo(() => [...institution.workingDays].sort((a, b) => a - b), [institution.workingDays]);
  const availability = useMemo(
    () => buildRoomAvailability(data?.slots ?? [], rooms.map((room) => room.id), days, PERIOD_NUMBERS),
    [data, rooms, days],
  );

  const roomNameById = new Map(rooms.map((room) => [room.id, room.name]));
  const classNameById = new Map((data?.classes ?? []).map((schoolClass) => [schoolClass.id, schoolClass.name]));
  const teacherNameById = new Map((data?.teachers ?? []).map((teacher) => [teacher.id, teacher.name]));

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAdding(true);
    setActionError(null);
    try {
      await createRoom(institution.id, name, user.id);
      setName('');
      workspace.reload();
    } catch (error) {
      setActionError(t(errorKey(error)));
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    const room = pendingDelete;
    if (!room) return;
    setDeleting(true);
    setActionError(null);
    try {
      await deleteRoom(room.id, user.id);
      setPendingDelete(null);
      setUndo({
        id: Date.now(),
        message: t('rooms.deleted', { name: room.name }),
        onUndo: () => {
          restoreRoom(room.id, user.id)
            .then(() => workspace.reload())
            .catch((error: unknown) => setActionError(t(errorKey(error))));
        },
      });
      workspace.reload();
    } catch (error) {
      setPendingDelete(null);
      setActionError(t(errorKey(error)));
    } finally {
      setDeleting(false);
    }
  };

  if (workspace.loading && !data) return <LoadingState />;
  if (workspace.error) return <ErrorState message={t(errorKey(workspace.error))} onRetry={workspace.reload} />;

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleAdd} className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <TextField
            id="room-name"
            label={t('rooms.namePlaceholder')}
            value={name}
            maxLength={TEXT_MAX_LENGTH}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={adding || name.trim() === ''} icon={<Plus className="size-5" aria-hidden />}>
          {t('rooms.add')}
        </Button>
      </form>

      <FormError message={actionError} />

      {rooms.length === 0 ? (
        <EmptyState icon={<DoorOpen className="size-7" aria-hidden />} title={t('rooms.title')} body={t('rooms.empty')} />
      ) : (
        <>
          <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-bold text-neutral-900">{t('rooms.heatmapTitle')}</h2>
              <p className="text-sm text-neutral-600">{t('rooms.heatmapHint')}</p>
              <p className="text-sm font-medium text-neutral-800">{t('rooms.totalRooms', { count: rooms.length })}</p>
            </div>
            <RoomHeatmap
              days={days}
              periods={PERIODS}
              availability={availability}
              totalRooms={rooms.length}
              onSelect={setSelection}
            />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold text-neutral-900">{t('rooms.listTitle')}</h2>
            <ul className="flex flex-col gap-2">
              {rooms.map((room) => (
                <li key={room.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-neutral-200">
                  <span className="min-w-0 truncate text-base font-medium text-neutral-900">{room.name}</span>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(room)}
                    aria-label={t('rooms.delete')}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-danger-50 hover:text-danger-700"
                  >
                    <Trash2 className="size-5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <RoomHourModal
        selection={selection}
        availability={availability}
        roomNameById={roomNameById}
        classNameById={classNameById}
        teacherNameById={teacherNameById}
        onClose={() => setSelection(null)}
      />

      <ConfirmModal
        open={pendingDelete !== null}
        title={t('rooms.deleteTitle', { name: pendingDelete?.name ?? '' })}
        body={t('rooms.deleteBody')}
        confirmLabel={t('rooms.delete')}
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {undo ? <UndoToast key={undo.id} message={undo.message} onUndo={undo.onUndo} onExpire={() => setUndo(null)} /> : null}
    </div>
  );
}
