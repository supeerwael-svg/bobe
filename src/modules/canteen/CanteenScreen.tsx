import { useCallback, useEffect, useState } from 'react';
import { Info, Utensils } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormError } from '@/components/ui/StatusBlock';
import { getModuleAccess } from '@/db/access';
import { listCanteenEntries, listCanteenStudents, loadWholeDayAbsentStudentIds, recordCanteenScan, voidCanteenEntry } from '@/db/canteen';
import { listClasses } from '@/db/classes';
import { findStudentByCode, computeCanteenCounters, decideScan, type ScanDecision } from '@/utils/canteen';
import { useSession } from '@/modules/auth/AuthContext';
import { errorKey } from '@/utils/errors';
import { todayIso } from '@/utils/dates';
import type { CanteenEntry, SchoolClass, Student } from '@/db/types';
import { CardScanner } from './CardScanner';
import { CanteenReportScreen } from './CanteenReportScreen';
import { HalfBoardersView } from './HalfBoardersView';
import { ManualEntryModal } from './ManualEntryModal';
import { playScanFeedback, type ScanTone } from './scanFeedback';
import { ScanResultBanner, type ScanBannerState } from './ScanResultBanner';

type CanteenTab = 'halfBoarders' | 'scan';
const TAB_STORAGE_KEY = 'canteen-tab';

function loadInitialTab(): CanteenTab {
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    return saved === 'scan' ? 'scan' : 'halfBoarders';
  } catch {
    return 'halfBoarders';
  }
}

const BANNER_MS = 2000;

interface PendingScan {
  student: Student;
  code: string;
  manual: boolean;
}

function nowTime(): string {
  return new Date().toTimeString().slice(0, 5);
}

export function CanteenScreen() {
  const { t, i18n } = useTranslation();
  const { user, institution } = useSession();
  const today = todayIso();
  const matchField = institution.canteenMatchField ?? 'cardCode';
  const [canteenTab, setCanteenTab] = useState<CanteenTab>(loadInitialTab);
  const [canEdit, setCanEdit] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [entries, setEntries] = useState<CanteenEntry[]>([]);
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [banner, setBanner] = useState<ScanBannerState | null>(null);
  const [pending, setPending] = useState<PendingScan | null>(null);
  const [voidTarget, setVoidTarget] = useState<CanteenEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTabChange = (tab: CanteenTab) => {
    setCanteenTab(tab);
    try { localStorage.setItem(TAB_STORAGE_KEY, tab); } catch { /* ignore */ }
  };

  const reload = useCallback(async () => {
    const [access, studentRows, classRows, entryRows] = await Promise.all([
      getModuleAccess(user.id, 'canteen'),
      listCanteenStudents(institution.id),
      listClasses(institution.id),
      listCanteenEntries(institution.id, today),
    ]);
    setCanEdit(access.canEdit);
    setStudents(studentRows);
    setClasses(classRows);
    setEntries(entryRows);
    setAbsentIds(await loadWholeDayAbsentStudentIds(institution, studentRows, today));
  }, [institution, today, user.id]);

  useEffect(() => {
    reload().catch((loadError) => setError(t(errorKey(loadError))));
  }, [reload, t]);

  useEffect(() => {
    if (!banner || pending) return;
    const timer = window.setTimeout(() => setBanner(null), BANNER_MS);
    return () => window.clearTimeout(timer);
  }, [banner, pending]);

  const studentName = (student: Student) => `${student.firstName} ${student.lastName}`;
  const classNameOf = (student: Student) => classes.find((item) => item.id === student.classId)?.name ?? '';

  const showDecision = (decision: ScanDecision, code: string): ScanBannerState => {
    const name = decision.student ? studentName(decision.student) : null;
    if (decision.kind === 'accepted') {
      return { tone: 'success', title: t('canteen.result.accepted'), detail: `${name} · ${classNameOf(decision.student)}` };
    }
    if (decision.kind === 'needsConfirmation') {
      return { tone: 'warning', title: t('canteen.result.absent'), detail: name };
    }
    const titles: Record<string, string> = {
      duplicate: t('canteen.result.duplicate'),
      external: t('canteen.result.external'),
      left: t('canteen.result.left'),
      unknown: t('canteen.result.unknown'),
    };
    const detail =
      decision.reason === 'duplicate' && decision.firstEntryTime
        ? t('canteen.result.firstEntryAt', { time: decision.firstEntryTime })
        : decision.reason === 'unknown'
          ? t('canteen.result.scanned', { code })
          : name;
    return { tone: 'error' as ScanTone, title: titles[decision.reason], detail };
  };

  const commit = async (decision: ScanDecision, code: string, manual: boolean) => {
    if (decision.kind === 'needsConfirmation') return;
    const accepted = decision.kind === 'accepted';
    await recordCanteenScan(
      institution.id,
      {
        studentId: decision.student?.id ?? null,
        scannedCode: code,
        date: today,
        time: nowTime(),
        result: accepted ? 'accepted' : 'rejected',
        reason: accepted ? null : decision.kind === 'rejected' ? decision.reason : null,
        manual,
      },
      user.id,
    );
    await reload();
  };

  const evaluate = async (student: Student | null, code: string, manual: boolean, confirmedAbsent = false) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const decision = decideScan({
        student,
        date: today,
        todayEntries: entries,
        absentToday: student ? absentIds.has(student.id) : false,
        confirmedAbsent,
      });
      if (decision.kind === 'needsConfirmation') {
        setPending({ student: decision.student, code, manual });
        setBanner(showDecision(decision, code));
        playScanFeedback('warning');
        return;
      }
      await commit(decision, code, manual);
      setBanner(showDecision(decision, code));
      playScanFeedback(decision.kind === 'accepted' ? 'success' : 'error');
    } catch (saveError) {
      setError(t(errorKey(saveError)));
    } finally {
      setBusy(false);
    }
  };

  const handleScannedText = (text: string) => {
    const student = findStudentByCode(students, text, matchField);
    void evaluate(student, text, false);
  };

  const handleManualCode = (code: string) => {
    setManualOpen(false);
    void evaluate(findStudentByCode(students, code, matchField), code, true);
  };

  const handleManualStudent = (student: Student) => {
    setManualOpen(false);
    void evaluate(student, student.cardCode?.trim() || student.id, true);
  };

  const confirmAbsentScan = () => {
    if (!pending) return;
    const { student, code, manual } = pending;
    setPending(null);
    void evaluate(student, code, manual, true);
  };

  const cancelAbsentScan = () => {
    setPending(null);
    setBanner(null);
  };

  const handleVoid = async () => {
    if (!voidTarget) return;
    const target = voidTarget;
    setVoidTarget(null);
    setError(null);
    try {
      await voidCanteenEntry(target.id, user.id);
      await reload();
    } catch (voidError) {
      setError(t(errorKey(voidError)));
    }
  };

  const counters = computeCanteenCounters(students, entries, today);
  const studentById = new Map(students.map((student) => [student.id, student]));
  const paused = banner !== null || pending !== null || busy;
  const formatter = new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' });

  const counterItems = [
    { label: t('canteen.counters.accepted'), value: counters.accepted, tone: 'text-success-700' },
    { label: t('canteen.counters.rejected'), value: counters.rejected, tone: 'text-danger-700' },
    { label: t('canteen.counters.halfBoarders'), value: counters.halfBoarders, tone: 'text-neutral-900' },
    { label: t('canteen.counters.remaining'), value: counters.remaining, tone: 'text-primary-700' },
  ];

  if (reportOpen) return <CanteenReportScreen onBack={() => setReportOpen(false)} />;

  const tabItems: { id: CanteenTab; label: string }[] = [
    { id: 'halfBoarders', label: t('canteen.halfBoarders.tabs.list') },
    { id: 'scan', label: t('canteen.halfBoarders.tabs.scan') },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-neutral-900">{t('canteen.title')}</h1>
        <p className="text-sm text-neutral-600">{t('canteen.subtitle')}</p>
        {institution.canteenTrackingStart ? (
          <p className="text-sm font-medium text-primary-700">{t('canteen.trackingSince', { date: institution.canteenTrackingStart })}</p>
        ) : (
          <p className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-700">{t('canteen.trackingOff')}</p>
        )}
        <Button variant="ghost" onClick={() => setReportOpen(true)} className="mt-2 min-h-11 self-start px-0 text-sm">
          {t('canteenReport.open')}
        </Button>
      </header>

      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {tabItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleTabChange(item.id)}
            className={`min-h-11 flex-none whitespace-nowrap rounded-xl px-4 text-sm font-medium transition ${
              canteenTab === item.id ? 'bg-primary-600 text-white' : 'bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {canteenTab === 'halfBoarders' ? (
        <HalfBoardersView canEdit={canEdit} students={students} classes={classes} onReload={reload} />
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-neutral-200">
          <span className="flex size-16 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
            <Utensils className="size-8" aria-hidden />
          </span>
          <p className="text-lg font-medium text-neutral-600">{t('canteen.halfBoarders.scannerComing')}</p>
        </div>
      )}

      {canteenTab === 'scan' ? (
        <>
      <section className="grid grid-cols-2 gap-3">
        {counterItems.map((item) => (
          <div key={item.label} className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
            <span className="text-sm text-neutral-500">{item.label}</span>
            <span className={`text-3xl font-extrabold ${item.tone}`}>{item.value}</span>
          </div>
        ))}
      </section>

      <FormError message={error} />

      {canEdit ? (
        <div className="flex flex-col gap-3">
          {institution.canteenTrackingStart && today < institution.canteenTrackingStart ? (
            <p className="flex items-center gap-2 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-700">
              <Info className="size-4 shrink-0" aria-hidden />
              {t('canteen.scanningBeforeStart')}
            </p>
          ) : null}
          {banner ? <ScanResultBanner banner={banner} /> : null}
          {pending ? (
            <div className="grid grid-cols-2 gap-3">
              <Button fullWidth onClick={confirmAbsentScan} className="min-h-14 text-base">
                {t('canteen.result.confirmAccept')}
              </Button>
              <Button variant="ghost" fullWidth onClick={cancelAbsentScan} className="min-h-14 text-base">
                {t('common.cancel')}
              </Button>
            </div>
          ) : null}
          <Button fullWidth onClick={() => setScannerOpen(true)} className="min-h-16 text-lg">
            {t('canteen.scanCard')}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setManualOpen(true)} className="min-h-14 text-base">
            {t('canteen.manual.open')}
          </Button>
        </div>
      ) : (
        <p className="rounded-xl bg-neutral-50 px-4 py-4 text-center text-sm text-neutral-500">{t('canteen.readOnly')}</p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">{t('canteen.latestScans')}</h2>
        {entries.length === 0 ? <p className="text-sm text-neutral-500">{t('canteen.noScans')}</p> : null}
        <ul className="flex flex-col gap-2">
          {entries.slice(0, 20).map((entry) => {
            const student = entry.studentId ? studentById.get(entry.studentId) : undefined;
            const accepted = entry.result === 'accepted';
            return (
              <li key={entry.id} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-neutral-200">
                <span className="w-14 shrink-0 text-sm font-medium text-neutral-500">
                  {formatter.format(new Date(`${today}T${entry.time}`))}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-neutral-900">
                    {student ? studentName(student) : entry.scannedCode}
                  </span>
                  <span className={`text-sm ${accepted ? 'text-success-700' : 'text-danger-700'}`}>
                    {accepted ? t('canteen.result.acceptedShort') : t(`canteen.reasons.${entry.reason ?? 'unknown'}`)}
                  </span>
                </div>
                {accepted && canEdit ? (
                  <Button variant="ghost" onClick={() => setVoidTarget(entry)} className="min-h-11 px-3 text-sm">
                    {t('canteen.undo')}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {scannerOpen ? (
        <CardScanner
          paused={paused}
          onDetect={handleScannedText}
          onManual={() => {
            setScannerOpen(false);
            setManualOpen(true);
          }}
          onClose={() => setScannerOpen(false)}
        />
      ) : null}

      <ManualEntryModal
        open={manualOpen}
        students={students}
        onCodeSubmit={handleManualCode}
        onStudentPick={handleManualStudent}
        onClose={() => setManualOpen(false)}
      />

      <Modal
        open={voidTarget !== null}
        title={t('canteen.undoTitle')}
        description={t('canteen.undoBody')}
        onClose={() => setVoidTarget(null)}
      >
        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <Button variant="danger" fullWidth onClick={handleVoid}>
            {t('canteen.undo')}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setVoidTarget(null)}>
            {t('common.cancel')}
          </Button>
        </div>
      </Modal>
        </>
      ) : null}
    </div>
  );
}
