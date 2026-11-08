import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { joinInstitution } from '@/db/auth';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/StatusBlock';
import { TextField } from '@/components/ui/TextField';
import { errorKey } from '@/utils/errors';
import { passwordKey, requiredKey } from '@/utils/validation';
import { useAuth } from './AuthContext';
import { AuthLayout } from './AuthLayout';

interface JoinForm {
  inviteCode: string;
  name: string;
  password: string;
}

type FormErrors = Partial<Record<keyof JoinForm, string>>;

export function JoinInstitutionScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const [form, setForm] = useState<JoinForm>({ inviteCode: '', name: '', password: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setField = (field: keyof JoinForm) => (event: ChangeEvent<HTMLInputElement>) =>
    setForm((previous) => ({ ...previous, [field]: event.target.value }));

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    const codeError = requiredKey(form.inviteCode);
    const nameError = requiredKey(form.name);
    const passwordError = passwordKey(form.password);
    if (codeError) next.inviteCode = t(codeError);
    if (nameError) next.name = t(nameError);
    if (passwordError) next.password = t(passwordError);
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
      const user = await joinInstitution(form);
      await signIn(user.id);
    } catch (error) {
      setFormError(t(errorKey(error)));
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title={t('auth.joinTitle')} subtitle={t('auth.joinSubtitle')} onBack={onBack}>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        <TextField
          label={t('auth.inviteCode')}
          value={form.inviteCode}
          onChange={setField('inviteCode')}
          error={errors.inviteCode}
          hint={t('auth.inviteCodeHint')}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="font-mono tracking-widest uppercase"
        />
        <TextField
          label={t('auth.name')}
          value={form.name}
          onChange={setField('name')}
          error={errors.name}
          hint={t('auth.nameHint')}
          autoComplete="name"
        />
        <TextField
          label={t('auth.password')}
          type="password"
          value={form.password}
          onChange={setField('password')}
          error={errors.password}
          autoComplete="new-password"
        />
        <FormError message={formError} />
        <Button type="submit" fullWidth disabled={submitting} className="mt-2">
          {t('auth.joinAction')}
        </Button>
      </form>
    </AuthLayout>
  );
}
