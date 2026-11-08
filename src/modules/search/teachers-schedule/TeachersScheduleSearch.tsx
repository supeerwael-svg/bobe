import { useState } from 'react';
import { ArrowLeft, CalendarDays, Clock3, MapPin, Search as SearchIcon, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StatusBlock';
import { TextField } from '@/components/ui/TextField';
import { PERIODS } from '@/utils/schedule';
import { WEEK_DAY_INDEXES, weekdayName } from '@/utils/calendar';
import { searchTeacherSchedule, type TeacherScheduleResult } from '../searchQueries';
import { useSession } from '@/modules/auth/AuthContext';

interface TeachersScheduleSearchProps {
  onBack: () => void;
}

function currentPeriodNumber(): number {
  const minutes = new Date().getHours() * 60 + new Date().getMinutes();
  const active = PERIODS.find((period) => {
    const [startHour, startMinute] = period.start.split(':').map(Number);
    const [endHour, endMinute] = period.end.split(':').map(Number);
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    return minutes >= start && minutes < end;
  });
  return active?.number ?? PERIODS[0].number;
}

export function TeachersScheduleSearch({ onBack }: TeachersScheduleSearchProps) {
  const { t, i18n } = useTranslation();
  const { user, institution } = useSession();
  const [query, setQuery] = useState('');
  const [day, setDay] = useState(String(new Date().getDay()));
  const [period, setPeriod] = useState(String(currentPeriodNumber()));
  const [results, setResults] = useState<TeacherScheduleResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    setError(null);
    try {
      const nextResults = await searchTeacherSchedule(institution.id, user.id, query, Number(day), Number(period));
      setResults(nextResults);
    } catch {
      setError(t('search.scheduleError'));
    } finally {
      setLoading(false);
    }
  };

  const dayOptions = WEEK_DAY_INDEXES.map((dayIndex) => ({
    value: String(dayIndex),
    label: weekdayName(dayIndex, i18n.language, 'long'),
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Button variant="ghost" onClick={onBack} icon={<ArrowLeft className="size-5 rtl:rotate-180" aria-hidden />} className="self-start px-2">
          {t('common.back')}
        </Button>
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl text-neutral-900">{t('search.teacherScheduleTitle')}</h1>
          <p className="text-base text-neutral-600">{t('search.teacherScheduleSubtitle')}</p>
        </div>
      </header>

      <form
        className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200 sm:p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSearch();
        }}
      >
        <TextField
          label={t('search.teacherName')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('search.teacherNamePlaceholder')}
          autoComplete="off"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
            {t('search.day')}
            <select value={day} onChange={(event) => setDay(event.target.value)} className="min-h-12 rounded-xl border border-neutral-300 bg-white px-4 text-base text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/15">
              {dayOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
            {t('search.period')}
            <select value={period} onChange={(event) => setPeriod(event.target.value)} className="min-h-12 rounded-xl border border-neutral-300 bg-white px-4 text-base text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/15">
              {PERIODS.map((item) => <option key={item.number} value={item.number}>{t('absences.period', { number: item.number })} · {item.start} - {item.end}</option>)}
            </select>
          </label>
        </div>
        <Button type="submit" fullWidth icon={<SearchIcon className="size-5" aria-hidden />} disabled={loading}>
          {t('search.findTeacher')}
        </Button>
      </form>

      {!searched ? (
        <EmptyState icon={<SearchIcon className="size-7" aria-hidden />} title={t('search.teacherScheduleEmptyTitle')} body={t('search.teacherScheduleEmptyBody')} />
      ) : loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void handleSearch()} />
      ) : results.length === 0 ? (
        <EmptyState icon={<Users className="size-7" aria-hidden />} title={t('search.teacherNoMatchesTitle')} body={t('search.teacherNoMatchesBody')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {results.map((result) => <TeacherScheduleCard key={`${result.id}-${result.className}-${result.period}`} result={result} />)}
        </ul>
      )}
    </div>
  );
}

function TeacherScheduleCard({ result }: { result: TeacherScheduleResult }) {
  const { t } = useTranslation();
  const isTeaching = result.className !== null;
  return (
    <li className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
          <Users className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-neutral-900">{result.name}</p>
          <p className={`mt-1 text-sm font-medium ${isTeaching ? 'text-primary-700' : 'text-success-700'}`}>
            {isTeaching
              ? t('search.teacherTeaching', { className: result.className, roomName: result.roomName ?? t('search.noRoom') })
              : t('search.teacherAvailable')}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 border-t border-neutral-100 pt-3 text-sm text-neutral-600 sm:grid-cols-3">
        <span className="flex items-center gap-2"><CalendarDays className="size-4 text-neutral-400" aria-hidden />{result.subject ?? t('search.noLesson')}</span>
        <span className="flex items-center gap-2"><Clock3 className="size-4 text-neutral-400" aria-hidden />{t('absences.period', { number: result.period })}</span>
        <span className="flex items-center gap-2"><MapPin className="size-4 text-neutral-400" aria-hidden />{result.roomName ?? t('search.noRoom')}</span>
      </div>
    </li>
  );
}
