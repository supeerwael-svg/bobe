import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { TextField } from '@/components/ui/TextField';
import type { Student } from '@/db/types';

interface ManualEntryModalProps {
  open: boolean;
  students: Student[];
  onCodeSubmit: (code: string) => void;
  onStudentPick: (student: Student) => void;
  onClose: () => void;
}

const MAX_RESULTS = 20;

export function ManualEntryModal({ open, students, onCodeSubmit, onStudentPick, onClose }: ManualEntryModalProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return students
      .filter((student) => `${student.firstName} ${student.lastName}`.toLowerCase().includes(needle))
      .slice(0, MAX_RESULTS);
  }, [query, students]);

  const close = () => {
    setCode('');
    setQuery('');
    onClose();
  };

  return (
    <Modal open={open} title={t('canteen.manual.title')} description={t('canteen.manual.hint')} onClose={close}>
      <div className="flex flex-col gap-6">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const value = code.trim();
            if (!value) return;
            onCodeSubmit(value);
            setCode('');
          }}
          className="flex flex-col gap-3"
        >
          <TextField label={t('canteen.manual.codeLabel')} value={code} autoComplete="off" onChange={(event) => setCode(event.target.value)} />
          <Button type="submit" fullWidth disabled={!code.trim()}>
            {t('canteen.manual.submitCode')}
          </Button>
        </form>

        <div className="flex flex-col gap-3">
          <TextField label={t('canteen.manual.searchLabel')} value={query} autoComplete="off" onChange={(event) => setQuery(event.target.value)} />
          {query.trim() && matches.length === 0 ? (
            <p className="text-sm text-neutral-500">{t('canteen.manual.noMatches')}</p>
          ) : null}
          <ul className="flex flex-col gap-2">
            {matches.map((student) => (
              <li key={student.id}>
                <button
                  type="button"
                  onClick={() => {
                    onStudentPick(student);
                    setQuery('');
                  }}
                  className="flex min-h-14 w-full items-center justify-between rounded-xl bg-neutral-50 px-4 text-start text-base font-medium text-neutral-900 transition hover:bg-neutral-100 active:scale-[0.99]"
                >
                  <span>{`${student.firstName} ${student.lastName}`}</span>
                  <span className="text-sm text-neutral-500">{t(`students.boarding.${student.boardingStatus}`)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
