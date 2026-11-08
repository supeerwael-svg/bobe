import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/modules/auth/AuthContext';
import { RoomsView } from '@/modules/timetable/RoomsView';
import { ScheduleView } from '@/modules/timetable/ScheduleView';
import { TeachersView } from '@/modules/timetable/TeachersView';

type Section = 'schedule' | 'teachers' | 'rooms';

export function TimetableScreen() {
  const { t } = useTranslation();
  const { user } = useSession();
  const isHead = user.role === 'head';
  const [section, setSection] = useState<Section>('schedule');
  const activeSection: Section = isHead ? section : 'schedule';

  const sections: { id: Section; label: string }[] = [
    { id: 'schedule', label: t('timetable.sections.schedule') },
    { id: 'teachers', label: t('timetable.sections.teachers') },
    { id: 'rooms', label: t('timetable.sections.rooms') },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl text-neutral-900">{t('timetable.title')}</h1>
        <p className="text-base text-neutral-600">{t('timetable.subtitle')}</p>
      </header>

      {isHead ? (
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-neutral-100 p-1">
          {sections.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              aria-pressed={activeSection === item.id}
              className={`min-h-11 rounded-xl px-2 text-sm font-medium transition duration-200 ${
                activeSection === item.id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {activeSection === 'schedule' ? <ScheduleView /> : null}
      {activeSection === 'teachers' ? <TeachersView /> : null}
      {activeSection === 'rooms' ? <RoomsView /> : null}
    </div>
  );
}
