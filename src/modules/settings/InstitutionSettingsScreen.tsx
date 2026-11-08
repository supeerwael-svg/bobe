import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { updateInstitutionSettings } from '@/db/institutions';
import { SubpageHeader } from '@/components/SubpageHeader';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/StatusBlock';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TextField } from '@/components/ui/TextField';
import { useSession } from '@/modules/auth/AuthContext';
import { errorKey } from '@/utils/errors';
import type { AbsenceCountRule, CanteenMatchField, Holiday } from '@/db/types';
import { requiredKey } from '@/utils/validation';
import { BackupCard } from './BackupCard';
import { HolidaysEditor } from './HolidaysEditor';
import { InviteCodeCard } from './InviteCodeCard';
import { SchedulePreview } from './SchedulePreview';
import { WorkingDaysPicker } from './WorkingDaysPicker';

const MAX_ROOMS = 500;

interface InstitutionForm {
  name: string;
  rooms: string;
  workingDays: number[];
  canteenDays: number[];
  holidays: Holiday[];
  directorate: string;
  city: string;
  reportNumberPrefix: string;
  absenceCountRule: AbsenceCountRule;
  canteenMatchField: CanteenMatchField;
  canteenTrackingStart: string;
}

interface FormErrors {
  name?: string;
  rooms?: string;
  workingDays?: string;
}

export function InstitutionSettingsScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { user, institution, refresh } = useSession();
  const [form, setForm] = useState<InstitutionForm>(() => ({
    name: institution.name,
    rooms: String(institution.rooms),
    workingDays: [...institution.workingDays],
    canteenDays: [...(institution.canteenDays ?? institution.workingDays)],
    holidays: [...institution.holidays],
    directorate: institution.directorate ?? '',
    city: institution.city ?? '',
    reportNumberPrefix: institution.reportNumberPrefix ?? '',
    absenceCountRule: institution.absenceCountRule ?? 'wholeDay',
    canteenMatchField: institution.canteenMatchField ?? 'cardCode',
    canteenTrackingStart: institution.canteenTrackingStart ?? '',
  }));
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const setName = (event: ChangeEvent<HTMLInputElement>) => {
    setSaved(false);
    setForm((previous) => ({ ...previous, name: event.target.value }));
  };
  const setRooms = (event: ChangeEvent<HTMLInputElement>) => {
    setSaved(false);
    setForm((previous) => ({ ...previous, rooms: event.target.value }));
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    const nameError = requiredKey(form.name);
    if (nameError) next.name = t(nameError);
    if (!/^\d+$/.test(form.rooms.trim()) || Number(form.rooms) > MAX_ROOMS) {
      next.rooms = t('validation.roomsInvalid');
    }
    if (form.workingDays.length === 0) {
      next.workingDays = t('validation.workingDaysRequired');
    }
    return next;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setFormError(null);
    setSaved(false);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await updateInstitutionSettings(
        institution.id,
        {
          name: form.name,
          rooms: Number(form.rooms),
          workingDays: form.workingDays,
          canteenDays: form.canteenDays,
          holidays: form.holidays,
          directorate: form.directorate,
          city: form.city,
          reportNumberPrefix: form.reportNumberPrefix,
          absenceCountRule: form.absenceCountRule,
          canteenMatchField: form.canteenMatchField,
          canteenTrackingStart: form.canteenTrackingStart || null,
        },
        user.id,
      );
      await refresh();
      setSaved(true);
    } catch (error) {
      setFormError(t(errorKey(error)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <SubpageHeader title={t('institution.title')} subtitle={t('institution.subtitle')} onBack={onBack} />

      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-8">
        <Section title={t('institution.generalSection')}>
          <TextField label={t('institution.name')} value={form.name} onChange={setName} error={errors.name} />
          <TextField
            label={t('institution.rooms')}
            inputMode="numeric"
            value={form.rooms}
            onChange={setRooms}
            error={errors.rooms}
          />
          <WorkingDaysPicker
            value={form.workingDays}
            error={errors.workingDays}
            onChange={(workingDays) => {
              setSaved(false);
              setErrors((previous) => ({ ...previous, workingDays: undefined }));
              setForm((previous) => ({ ...previous, workingDays }));
            }}
          />
          <WorkingDaysPicker
            value={form.canteenDays}
            legend={t('canteenReport.openDaysLegend')}
            hint={t('canteenReport.openDaysHint')}
            onChange={(canteenDays) => {
              setSaved(false);
              setForm((previous) => ({ ...previous, canteenDays }));
            }}
          />
          <HolidaysEditor
            holidays={form.holidays}
            onChange={(holidays) => {
              setSaved(false);
              setForm((previous) => ({ ...previous, holidays }));
            }}
          />
        </Section>

        <Section title={t('institution.reportSection')} hint={t('institution.reportHint')}>
          <TextField
            label={t('institution.directorate')}
            value={form.directorate}
            onChange={(event) => {
              setSaved(false);
              setForm((previous) => ({ ...previous, directorate: event.target.value }));
            }}
          />
          <TextField
            label={t('institution.city')}
            value={form.city}
            onChange={(event) => {
              setSaved(false);
              setForm((previous) => ({ ...previous, city: event.target.value }));
            }}
          />
          <TextField
            label={t('institution.reportNumberPrefix')}
            value={form.reportNumberPrefix}
            onChange={(event) => {
              setSaved(false);
              setForm((previous) => ({ ...previous, reportNumberPrefix: event.target.value }));
            }}
          />
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-neutral-700">{t('institution.absenceCountRule')}</span>
            <SegmentedControl<AbsenceCountRule>
              options={[
                { id: 'wholeDay', label: t('institution.countWholeDay') },
                { id: 'anyPeriod', label: t('institution.countAnyPeriod') },
              ]}
              value={form.absenceCountRule}
              onChange={(absenceCountRule) => {
                setSaved(false);
                setForm((previous) => ({ ...previous, absenceCountRule }));
              }}
            />
          </div>
        </Section>

        <Section title={t('institution.canteenSection')} hint={t('institution.canteenHint')}>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-neutral-700">{t('institution.canteenMatchField')}</span>
            <SegmentedControl<CanteenMatchField>
              options={[
                { id: 'cardCode', label: t('institution.canteenMatchCardCode') },
                { id: 'studentId', label: t('institution.canteenMatchStudentId') },
              ]}
              value={form.canteenMatchField}
              onChange={(canteenMatchField) => {
                setSaved(false);
                setForm((previous) => ({ ...previous, canteenMatchField }));
              }}
            />
          </div>
          <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
            {t('institution.canteenTrackingStart')}
            <span className="text-xs font-normal text-neutral-500">{t('institution.canteenTrackingHint')}</span>
            <input
              type="date"
              value={form.canteenTrackingStart}
              onChange={(event) => {
                setSaved(false);
                setForm((previous) => ({ ...previous, canteenTrackingStart: event.target.value }));
              }}
              className="min-h-11 rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900"
            />
          </label>
        </Section>

        <Section title={t('institution.scheduleSection')} hint={t('institution.scheduleHint')}>
          <SchedulePreview />
        </Section>

        <FormError message={formError} />
        <div className="sticky bottom-24 z-10 flex items-center gap-4">
          <Button type="submit" fullWidth disabled={submitting} className="shadow-lg">
            {t('common.save')}
          </Button>
        </div>
        {saved ? (
          <p role="status" className="text-center text-sm font-medium text-success-700 animate-fade-in">
            {t('institution.settingsSaved')}
          </p>
        ) : null}
      </form>

      <Section title={t('institution.inviteSection')} hint={t('institution.inviteHint')}>
        <InviteCodeCard />
      </Section>

      <Section title={t('institution.backupSection')} hint={t('institution.backupHint')}>
        <BackupCard />
      </Section>
    </div>
  );
}

interface SectionProps {
  title: string;
  hint?: string;
  children: ReactNode;
}

function Section({ title, hint, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg text-neutral-900">{title}</h2>
        {hint ? <p className="text-sm text-neutral-600">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}
