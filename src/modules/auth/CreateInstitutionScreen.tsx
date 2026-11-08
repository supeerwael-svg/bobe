import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { createInstitution } from '@/db/auth';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/StatusBlock';
import { TextField } from '@/components/ui/TextField';
import { errorKey } from '@/utils/errors';
import { passwordKey, requiredKey } from '@/utils/validation';
import { useAuth } from './AuthContext';
import { AuthLayout } from './AuthLayout';

interface CreateForm {
  name: string;
  username: string;
  password: string;
  confirmPassword: string;
}

type FormErrors = Partial<Record<keyof CreateForm, string>>;

export function CreateInstitutionScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const [form, setForm] = useState<CreateForm>({ name: '', username: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setField = (field: keyof CreateForm) => (event: ChangeEvent<HTMLInputElement>) =>
    setForm((previous) => ({ ...previous, [field]: event.target.value }));

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    const nameError = requiredKey(form.name);
    const usernameError = requiredKey(form.username);
    const passwordError = passwordKey(form.password);
    if (nameError) next.name = t(nameError);
    if (usernameError) next.username = t(usernameError);
    if (passwordError) next.password = t(passwordError);
    if (!passwordError && form.password !== form.confirmPassword) {
      next.confirmPassword = t('validation.passwordMismatch');
    }
    return next;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const head = await createInstitution({
        name: form.name,
        username: form.username,
        password: form.password,
      });
      await signIn(head.id);
    } catch (error) {
      setFormError(t(errorKey(error)));
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title={t('auth.createTitle')} subtitle={t('auth.createSubtitle')} onBack={onBack}>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        <TextField
          label={t('auth.institutionName')}
          value={form.name}
          onChange={setField('name')}
          error={errors.name}
          autoComplete="organization"
        />
        <TextField
          label={t('auth.username')}
          value={form.username}
          onChange={setField('username')}
          error={errors.username}
          autoComplete="username"
        />
        <TextField
          label={t('auth.password')}
          type="password"
          value={form.password}
          onChange={setField('password')}
          error={errors.password}
          autoComplete="new-password"
        />
        <TextField
          label={t('auth.confirmPassword')}
          type="password"
          value={form.confirmPassword}
          onChange={setField('confirmPassword')}
          error={errors.confirmPassword}
          autoComplete="new-password"
        />
        <FormError message={formError} />
        <Button type="submit" fullWidth disabled={submitting} className="mt-2">
          {t('auth.createAction')}
        </Button>
      </form>
    </AuthLayout>
  );
}
