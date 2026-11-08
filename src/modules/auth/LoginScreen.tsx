import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { signInWithCredentials } from '@/db/auth';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/StatusBlock';
import { TextField } from '@/components/ui/TextField';
import { errorKey } from '@/utils/errors';
import { requiredKey } from '@/utils/validation';
import { useAuth } from './AuthContext';
import { AuthLayout } from './AuthLayout';

interface LoginForm {
  identifier: string;
  password: string;
}

type FormErrors = Partial<Record<keyof LoginForm, string>>;

export function LoginScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const [form, setForm] = useState<LoginForm>({ identifier: '', password: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setField = (field: keyof LoginForm) => (event: ChangeEvent<HTMLInputElement>) =>
    setForm((previous) => ({ ...previous, [field]: event.target.value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FormErrors = {};
    const identifierError = requiredKey(form.identifier);
    const passwordError = requiredKey(form.password);
    if (identifierError) nextErrors.identifier = t(identifierError);
    if (passwordError) nextErrors.password = t(passwordError);
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const user = await signInWithCredentials(form.identifier, form.password);
      await signIn(user.id);
    } catch (error) {
      setFormError(t(errorKey(error)));
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')} onBack={onBack}>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        <TextField
          label={t('auth.identifier')}
          value={form.identifier}
          onChange={setField('identifier')}
          error={errors.identifier}
          autoComplete="username"
        />
        <TextField
          label={t('auth.password')}
          type="password"
          value={form.password}
          onChange={setField('password')}
          error={errors.password}
          autoComplete="current-password"
        />
        <FormError message={formError} />
        <Button type="submit" fullWidth disabled={submitting} className="mt-2">
          {t('auth.loginAction')}
        </Button>
      </form>
    </AuthLayout>
  );
}
