import { useEffect, useState, type ChangeEvent } from 'react';
import { Check, Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/StatusBlock';
import { changeOwnPassword, updateOwnDisplayName } from '@/db/users';
import { useSession } from '@/modules/auth/AuthContext';
import { errorKey } from '@/utils/errors';

interface PasswordFieldProps {
  label: string;
  value: string;
  visible: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
  autoComplete: string;
  disabled: boolean;
}

function PasswordField({ label, value, visible, onChange, onToggle, showLabel, hideLabel, autoComplete, disabled }: PasswordFieldProps) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
      {label}
      <span className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          disabled={disabled}
          autoComplete={autoComplete}
          className="min-h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 pe-12 text-base text-neutral-900 transition focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/15 disabled:cursor-not-allowed disabled:bg-neutral-100"
        />
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-label={visible ? hideLabel : showLabel}
          className="absolute inset-y-0 end-0 flex w-12 items-center justify-center text-neutral-500 transition hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </span>
    </label>
  );
}

export function AccountSection() {
  const { t } = useTranslation();
  const { user, refresh } = useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordVisibility, setPasswordVisibility] = useState({ current: false, new: false, confirmation: false });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [lockSeconds, setLockSeconds] = useState(0);
  const [name, setName] = useState(user.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);

  useEffect(() => {
    if (lockSeconds === 0) return;
    const timer = window.setInterval(() => {
      setLockSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockSeconds]);

  const passwordLocked = lockSeconds > 0;

  const handlePasswordChange = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);
    setPasswordSaving(true);
    try {
      await changeOwnPassword(user.id, currentPassword, newPassword, confirmation);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      setWrongAttempts(0);
      setPasswordSuccess(true);
    } catch (cause) {
      const key = errorKey(cause);
      if (key === 'settings.account.currentPasswordIncorrect') {
        const nextAttempts = wrongAttempts + 1;
        if (nextAttempts >= 5) {
          setWrongAttempts(0);
          setLockSeconds(60);
          setPasswordError(t('settings.account.passwordLocked', { seconds: 60 }));
        } else {
          setWrongAttempts(nextAttempts);
          setPasswordError(t(key));
        }
      } else {
        setPasswordError(t(key));
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleNameChange = async () => {
    setNameError(null);
    setNameSuccess(false);
    setNameSaving(true);
    const normalizedName = name.trim().replace(/\s+/g, ' ');
    try {
      await updateOwnDisplayName(user.id, normalizedName);
      setName(normalizedName);
      setNameSuccess(true);
      await refresh();
    } catch (cause) {
      setNameError(t(errorKey(cause)));
    } finally {
      setNameSaving(false);
    }
  };

  const togglePasswordVisibility = (field: keyof typeof passwordVisibility) => {
    setPasswordVisibility((current) => ({ ...current, [field]: !current[field] }));
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
          <UserRound className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-xl text-neutral-900">{t('settings.account.title')}</h2>
          <p className="text-sm text-neutral-600">{t('settings.account.subtitle')}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden />
          <div>
            <h3 className="font-bold text-neutral-900">{t('settings.account.changePasswordTitle')}</h3>
            <p className="text-sm text-neutral-600">{t('settings.account.changePasswordHint')}</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <PasswordField label={t('settings.account.currentPassword')} value={currentPassword} visible={passwordVisibility.current} onChange={(event) => setCurrentPassword(event.target.value)} onToggle={() => togglePasswordVisibility('current')} showLabel={t('settings.account.showPassword')} hideLabel={t('settings.account.hidePassword')} autoComplete="current-password" disabled={passwordSaving || passwordLocked} />
          <PasswordField label={t('settings.account.newPassword')} value={newPassword} visible={passwordVisibility.new} onChange={(event) => setNewPassword(event.target.value)} onToggle={() => togglePasswordVisibility('new')} showLabel={t('settings.account.showPassword')} hideLabel={t('settings.account.hidePassword')} autoComplete="new-password" disabled={passwordSaving || passwordLocked} />
          <PasswordField label={t('settings.account.confirmPassword')} value={confirmation} visible={passwordVisibility.confirmation} onChange={(event) => setConfirmation(event.target.value)} onToggle={() => togglePasswordVisibility('confirmation')} showLabel={t('settings.account.showPassword')} hideLabel={t('settings.account.hidePassword')} autoComplete="new-password" disabled={passwordSaving || passwordLocked} />
        </div>
        <FormError message={passwordError} />
        {passwordSuccess ? <p className="flex items-center gap-2 text-sm font-medium text-success-700"><Check className="size-4" aria-hidden />{t('settings.account.passwordChanged')}</p> : null}
        {passwordLocked ? <p className="text-sm font-medium text-warning-800">{t('settings.account.tryAgainIn', { seconds: lockSeconds })}</p> : null}
        <Button onClick={() => void handlePasswordChange()} disabled={passwordSaving || passwordLocked} fullWidth>
          {passwordLocked ? t('settings.account.passwordLockedButton') : t('settings.account.changePassword')}
        </Button>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
        <div>
          <h3 className="font-bold text-neutral-900">{t('settings.account.changeNameTitle')}</h3>
          <p className="text-sm text-neutral-600">{t('settings.account.changeNameHint')}</p>
        </div>
        <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
          {t('settings.account.displayName')}
          <input
            type="text"
            value={name}
            onChange={(event) => { setName(event.target.value); setNameSuccess(false); }}
            disabled={nameSaving}
            autoComplete="name"
            className="min-h-12 rounded-xl border border-neutral-300 bg-white px-4 text-base text-neutral-900 transition focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/15 disabled:cursor-not-allowed disabled:bg-neutral-100"
          />
        </label>
        <FormError message={nameError} />
        {nameSuccess ? <p className="flex items-center gap-2 text-sm font-medium text-success-700"><Check className="size-4" aria-hidden />{t('settings.account.nameChanged')}</p> : null}
        <Button onClick={() => void handleNameChange()} disabled={nameSaving} fullWidth>
          {t('settings.account.saveName')}
        </Button>
      </div>
    </section>
  );
}
