import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SubpageHeader } from '@/components/SubpageHeader';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup } from '@/components/ui/ChoiceGroup';
import { FormError } from '@/components/ui/StatusBlock';
import { TextField } from '@/components/ui/TextField';
import { createStudent, updateStudent } from '@/db/students';
import { prepareStudentInput, TEXT_MAX_LENGTH, validateStudentInput } from '@/db/studentRules';
import { BOARDING_STATUSES, GENDERS, type BoardingStatus, type Gender, type SchoolClass, type Student, type StudentInput } from '@/db/types';
import { useSession } from '@/modules/auth/AuthContext';
import { errorKey } from '@/utils/errors';

type FieldErrors = Partial<Record<keyof StudentInput, string>>;

interface StudentFormDraft {
  firstName: string;
  lastName: string;
  gender: Gender | '';
  dateOfBirth: string;
  placeOfBirth: string;
  repeater: 'yes' | 'no';
  boardingStatus: BoardingStatus;
  classId: string;
  joinDate: string;
  leaveDate: string;
  cardCode: string;
}

interface StudentFormProps {
  student: Student | null;
  classes: SchoolClass[];
  onBack: () => void;
  onSaved: () => void;
}

function initialDraft(student: Student | null, classes: SchoolClass[]): StudentFormDraft {
  if (!student) {
    return {
      firstName: '',
      lastName: '',
      gender: '',
      dateOfBirth: '',
      placeOfBirth: '',
      repeater: 'no',
      boardingStatus: 'external',
      classId: classes[0]?.id ?? '',
      joinDate: '',
      leaveDate: '',
      cardCode: '',
    };
  }
  return {
    firstName: student.firstName,
    lastName: student.lastName,
    gender: student.gender,
    dateOfBirth: student.dateOfBirth ?? '',
    placeOfBirth: student.placeOfBirth,
    repeater: student.repeater ? 'yes' : 'no',
    boardingStatus: student.boardingStatus,
    classId: student.classId,
    joinDate: student.joinDate ?? '',
    leaveDate: student.leaveDate ?? '',
    cardCode: student.cardCode ?? '',
  };
}

function toStudentInput(draft: StudentFormDraft): StudentInput {
  return {
    firstName: draft.firstName,
    lastName: draft.lastName,
    gender: draft.gender as Gender,
    dateOfBirth: draft.dateOfBirth || null,
    placeOfBirth: draft.placeOfBirth,
    repeater: draft.repeater === 'yes',
    boardingStatus: draft.boardingStatus,
    classId: draft.classId,
    joinDate: draft.joinDate || null,
    leaveDate: draft.leaveDate || null,
    cardCode: draft.cardCode.trim() || null,
  };
}

export function StudentForm({ student, classes, onBack, onSaved }: StudentFormProps) {
  const { t } = useTranslation();
  const { user, institution } = useSession();
  const [draft, setDraft] = useState<StudentFormDraft>(() => initialDraft(student, classes));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (patch: Partial<StudentFormDraft>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
    setFieldErrors({});
    setFormError(null);
  };

  const fieldError = (field: keyof StudentInput) => fieldErrors[field] ?? null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = toStudentInput(draft);
    const issues = validateStudentInput(input);
    if (issues.length > 0) {
      setFieldErrors(Object.fromEntries(issues.map((issue) => [issue.field, t(issue.key)])));
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const prepared = prepareStudentInput(input);
      if (student) {
        await updateStudent(student.id, prepared, user.id);
      } else {
        await createStudent(institution.id, prepared, user.id);
      }
      onSaved();
    } catch (saveError) {
      setFormError(t(errorKey(saveError)));
      setSubmitting(false);
    }
  };

  const genderOptions = GENDERS.map((value) => ({ value, label: t(`students.gender.${value}`) }));
  const boardingOptions = BOARDING_STATUSES.map((value) => ({ value, label: t(`students.boarding.${value}`) }));
  const repeaterOptions: { value: 'yes' | 'no'; label: string }[] = [
    { value: 'yes', label: t('common.yes') },
    { value: 'no', label: t('common.no') },
  ];

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
      <SubpageHeader
        title={student ? t('students.form.editTitle') : t('students.form.addTitle')}
        subtitle={t('students.form.subtitle')}
        onBack={onBack}
      />

      <FormSection title={t('students.form.personalSection')}>
        <TextField
          label={t('students.fields.firstName')}
          maxLength={TEXT_MAX_LENGTH}
          autoComplete="off"
          value={draft.firstName}
          error={fieldError('firstName')}
          onChange={(event) => update({ firstName: event.target.value })}
        />
        <TextField
          label={t('students.fields.lastName')}
          maxLength={TEXT_MAX_LENGTH}
          autoComplete="off"
          value={draft.lastName}
          error={fieldError('lastName')}
          onChange={(event) => update({ lastName: event.target.value })}
        />
        <ChoiceGroup<Gender | ''>
          legend={t('students.fields.gender')}
          name="student-gender"
          value={draft.gender}
          options={genderOptions}
          error={fieldError('gender')}
          onChange={(gender) => update({ gender })}
        />
        <TextField
          label={t('students.fields.dateOfBirth')}
          type="date"
          value={draft.dateOfBirth}
          error={fieldError('dateOfBirth')}
          onChange={(event) => update({ dateOfBirth: event.target.value })}
        />
        <TextField
          label={t('students.fields.placeOfBirth')}
          maxLength={TEXT_MAX_LENGTH}
          value={draft.placeOfBirth}
          error={fieldError('placeOfBirth')}
          onChange={(event) => update({ placeOfBirth: event.target.value })}
        />
        <TextField
          label={t('students.cardCode.label')}
          hint={t('students.cardCode.hint')}
          maxLength={TEXT_MAX_LENGTH}
          autoComplete="off"
          value={draft.cardCode}
          error={fieldError('cardCode')}
          onChange={(event) => update({ cardCode: event.target.value })}
        />
      </FormSection>

      <FormSection title={t('students.form.schoolSection')}>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-neutral-700">{t('students.fields.className')}</span>
          <select
            value={draft.classId}
            onChange={(event) => update({ classId: event.target.value })}
            aria-invalid={fieldError('classId') ? true : undefined}
            className="min-h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/15"
          >
            <option value="">{t('students.form.choosePlaceholder')}</option>
            {classes.map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>
                {schoolClass.name}
              </option>
            ))}
          </select>
          {fieldError('classId') ? <span className="text-sm text-danger-700">{fieldError('classId')}</span> : null}
        </label>
        <ChoiceGroup
          legend={t('students.fields.boardingStatus')}
          name="student-boarding"
          value={draft.boardingStatus}
          options={boardingOptions}
          onChange={(boardingStatus) => update({ boardingStatus })}
        />
        <ChoiceGroup<'yes' | 'no'>
          legend={t('students.fields.repeater')}
          name="student-repeater"
          value={draft.repeater}
          options={repeaterOptions}
          onChange={(repeater) => update({ repeater })}
        />
        <TextField
          label={t('students.fields.joinDate')}
          type="date"
          value={draft.joinDate}
          error={fieldError('joinDate')}
          onChange={(event) => update({ joinDate: event.target.value })}
        />
        <TextField
          label={t('students.fields.leaveDate')}
          type="date"
          hint={t('students.form.leaveHint')}
          value={draft.leaveDate}
          error={fieldError('leaveDate')}
          onChange={(event) => update({ leaveDate: event.target.value })}
        />
      </FormSection>

      <FormError message={formError} />
      <Button type="submit" fullWidth disabled={submitting}>
        {t('common.save')}
      </Button>
    </form>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
      <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">{title}</h2>
      {children}
    </section>
  );
}
