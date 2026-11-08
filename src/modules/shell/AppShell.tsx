import { useState } from 'react';
import { ChartBar as BarChart3, CalendarDays, ClipboardList, GraduationCap, Chrome as Home, Search, Settings, Users, Utensils } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppLogo } from '@/components/AppLogo';
import { BottomTabs, type TabItem } from '@/components/BottomTabs';
import { AbsencesScreen } from '@/modules/absences/AbsencesScreen';
import { useSession } from '@/modules/auth/AuthContext';
import { HomeScreen } from '@/modules/home/HomeScreen';
import { SettingsScreen } from '@/modules/settings/SettingsScreen';
import { StatisticsScreen } from '@/modules/statistics/StatisticsScreen';
import { StudentsScreen } from '@/modules/students/StudentsScreen';
import { SupervisorsScreen } from '@/modules/supervisors/SupervisorsScreen';
import { TimetableScreen } from '@/modules/timetable/TimetableScreen';
import { SearchScreen } from '@/modules/search/SearchScreen';
import { CanteenScreen } from '@/modules/canteen/CanteenScreen';

type TabId = 'home' | 'students' | 'timetable' | 'absences' | 'canteen' | 'statistics' | 'supervisors' | 'settings' | 'search';

export function AppShell() {
  const { t } = useTranslation();
  const { user, institution } = useSession();
  const [tab, setTab] = useState<TabId>('home');
  const isHead = user.role === 'head';
  const hasCanteen = isHead || user.permissions !== null;

  const tabs: TabItem<TabId>[] = [
    { id: 'home', label: t('nav.home'), icon: Home },
    { id: 'students', label: t('nav.students'), icon: GraduationCap },
    { id: 'timetable', label: t('nav.timetable'), icon: CalendarDays },
    { id: 'absences', label: t('nav.absences'), icon: ClipboardList },
    ...(hasCanteen ? [{ id: 'canteen' as const, label: t('nav.canteen'), icon: Utensils }] : []),
    { id: 'statistics', label: t('nav.statistics'), icon: BarChart3 },
    { id: 'search', label: t('nav.search'), icon: Search },
    ...(isHead ? [{ id: 'supervisors' as const, label: t('nav.supervisors'), icon: Users }] : []),
    { id: 'settings', label: t('nav.settings'), icon: Settings },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50">
      <header className="sticky top-0 z-20 border-b border-neutral-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <AppLogo size="sm" />
          <div className="flex min-w-0 flex-col">
            <span className="text-xs text-neutral-500">{t('app.name')}</span>
            <span className="truncate text-base font-bold text-neutral-900">{institution.name}</span>
          </div>
        </div>
      </header>

      <main key={tab} className="mx-auto w-full max-w-3xl flex-1 px-4 pb-32 pt-6 animate-fade-up">
        {tab === 'home' ? <HomeScreen onNavigate={setTab} /> : null}
        {tab === 'students' ? <StudentsScreen /> : null}
        {tab === 'timetable' ? <TimetableScreen /> : null}
        {tab === 'absences' ? <AbsencesScreen /> : null}
        {tab === 'canteen' && hasCanteen ? <CanteenScreen /> : null}
        {tab === 'statistics' ? <StatisticsScreen /> : null}
        {tab === 'search' ? <SearchScreen /> : null}
        {tab === 'supervisors' && isHead ? <SupervisorsScreen /> : null}
        {tab === 'settings' ? <SettingsScreen /> : null}
      </main>

      <BottomTabs items={tabs} active={tab} onChange={setTab} />
    </div>
  );
}
