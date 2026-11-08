import { useEffect, useRef, useState } from 'react';
import { Search as SearchIcon, GraduationCap, Users, CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StatusBlock';
import { useSession } from '@/modules/auth/AuthContext';
import { weekdayName } from '@/utils/calendar';
import { TeachersScheduleSearch } from './teachers-schedule/TeachersScheduleSearch';
import {
  searchStudents,
  searchTeachers,
  searchTimetables,
  type SearchTab,
  type StudentSearchResult,
  type TeacherSearchResult,
  type TimetableSearchResult,
} from './searchQueries';

const DEBOUNCE_MS = 300;

export function SearchScreen() {
  const { t } = useTranslation();
  const { user, institution } = useSession();
  const [tab, setTab] = useState<SearchTab>('students');
  const [advancedSchedule, setAdvancedSchedule] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentSearchResult[]>([]);
  const [teachers, setTeachers] = useState<TeacherSearchResult[]>([]);
  const [timetables, setTimetables] = useState<TimetableSearchResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setDebouncedQuery('');
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setStudents([]);
      setTeachers([]);
      setTimetables([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setError(null);
    const run = async () => {
      try {
        if (tab === 'students') {
          const results = await searchStudents(institution.id, user.id, debouncedQuery);
          if (!cancelled) setStudents(results);
        } else if (tab === 'teachers') {
          const results = await searchTeachers(institution.id, user.id, debouncedQuery);
          if (!cancelled) setTeachers(results);
        } else {
          const results = await searchTimetables(institution.id, user.id, debouncedQuery);
          if (!cancelled) setTimetables(results);
        }
        if (!cancelled) setLoading(false);
      } catch (cause) {
        if (!cancelled) {
          setError(String(cause));
          setLoading(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, tab, institution.id, user.id]);

  const tabs: { id: SearchTab; label: string }[] = [
    { id: 'students', label: t('nav.students') },
    { id: 'teachers', label: t('teachers.title') },
    { id: 'timetables', label: t('nav.timetable') },
  ];

  return advancedSchedule ? (
    <TeachersScheduleSearch onBack={() => setAdvancedSchedule(false)} />
  ) : (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl text-neutral-900">{t('search.title')}</h1>
        <p className="text-base text-neutral-600">{t('search.subtitle')}</p>
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-white px-4 ring-1 ring-neutral-300 focus-within:ring-2 focus-within:ring-primary-200">
          <SearchIcon className="size-5 shrink-0 text-neutral-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            className="min-h-12 flex-1 bg-transparent text-base text-neutral-900 outline-none placeholder:text-neutral-400"
          />
        </div>

        <SegmentedControl<SearchTab> options={tabs} value={tab} onChange={setTab} />
        <Button variant="secondary" onClick={() => setAdvancedSchedule(true)} icon={<CalendarDays className="size-5" aria-hidden />}>
          {t('search.teacherScheduleAction')}
        </Button>
      </div>

      {!debouncedQuery.trim() ? (
        <EmptyState
          icon={<SearchIcon className="size-7" aria-hidden />}
          title={t('search.emptyTitle')}
          body={t('search.emptyBody')}
        />
      ) : loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setDebouncedQuery(debouncedQuery)} />
      ) : tab === 'students' ? (
        <StudentResults results={students} />
      ) : tab === 'teachers' ? (
        <TeacherResults results={teachers} />
      ) : (
        <TimetableResults results={timetables} />
      )}
    </div>
  );
}

function StudentResults({ results }: { results: StudentSearchResult[] }) {
  const { t } = useTranslation();
  if (results.length === 0) return <p className="text-sm text-neutral-600">{t('search.noMatches')}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {results.map((s) => (
        <li key={s.id} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <GraduationCap className="size-5" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="truncate font-semibold text-neutral-900">{s.firstName} {s.lastName}</p>
            <p className="text-xs text-neutral-500">{s.className} · {t(`students.gender.${s.gender}`)} · {t(`students.boarding.${s.boardingStatus}`)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TeacherResults({ results }: { results: TeacherSearchResult[] }) {
  const { t } = useTranslation();
  if (results.length === 0) return <p className="text-sm text-neutral-600">{t('search.noMatches')}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {results.map((tch) => (
        <li key={tch.id} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
            <Users className="size-5" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="truncate font-semibold text-neutral-900">{tch.name}</p>
            <p className="text-xs text-neutral-500">
              {tch.subjects.join(' · ')}
              {tch.classNames.length > 0 ? ` — ${tch.classNames.join(', ')}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TimetableResults({ results }: { results: TimetableSearchResult[] }) {
  const { t, i18n } = useTranslation();
  if (results.length === 0) return <p className="text-sm text-neutral-600">{t('search.noMatches')}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {results.map((r) => (
        <li key={r.id} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
            <CalendarDays className="size-5" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="truncate font-semibold text-neutral-900">{r.subject} — {r.className}</p>
            <p className="text-xs text-neutral-500">
              {weekdayName(r.day, i18n.language)} · {t('absences.period', { number: r.period })}
              {r.teacherName ? ` · ${r.teacherName}` : ''}
              {r.roomName ? ` · ${r.roomName}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
