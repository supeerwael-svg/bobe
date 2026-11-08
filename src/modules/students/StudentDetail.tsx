import { useState, type ReactNode } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SubpageHeader } from '@/components/SubpageHeader';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormError } from '@/components/ui/StatusBlock';
import { canAccessClass, type StudentAccess } from '@/db/access';
import { deleteStudent, setStudentCardCode } from '@/db/students';
import type { SchoolClass, Student } from '@/db/types';
import { useSession } from '@/modules/auth/AuthContext';
import { CardScanner } from '@/modules/canteen/CardScanner';
import { errorKey } from '@/utils/errors';
import { formatIsoDate } from '@/utils/dates';

interface StudentDetailProps {
  student: Student;
  classes: SchoolClass[];
  access: StudentAccess;
  onBack: () => void;
  onEdit: () => void;
  onDeleted: (student: Student) => void;
}

export function StudentDetail({ student, classes, access, onBack, onEdit, onDeleted }: StudentDetailProps) {
  const { t, i18n } = useTranslation();
  const { user } = useSession();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cardCode, setCardCode] = useState(student.cardCode ?? '');
  const canEdit = access.canEdit && canAccessClass(access, student.classId);
  const className = classes.find((item) => item.id === student.classId)?.name ?? t('students.unknownClass');
  const fullName = `${student.firstName} ${student.lastName}`;
  const formatDate = (iso: string | null) => (iso ? formatIsoDate(iso, i18n.language) : t('students.notSet'));

  const handleDelete = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await deleteStudent(student.id, user.id);
      onDeleted(student);
    } catch (deleteError) {
      setError(t(errorKey(deleteError)));
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const handleScannedCard = async (text: string) => {
    setScanning(false);
    setError(null);
    try {
      await setStudentCardCode(student.id, text, user.id);
      setCardCode(text.trim());
    } catch (saveError) {
      setError(t(errorKey(saveError)));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <SubpageHeader title={fullName} subtitle={className} onBack={onBack} />

      <section className="grid grid-cols-1 gap-x-6 gap-y-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200 sm:grid-cols-2">
        <DetailItem label={t('students.fields.gender')} value={t(`students.gender.${student.gender}`)} />
        <DetailItem label={t('students.fields.boardingStatus')} value={t(`students.boarding.${student.boardingStatus}`)} />
        <DetailItem label={t('students.fields.dateOfBirth')} value={formatDate(student.dateOfBirth)} />
        <DetailItem label={t('students.fields.placeOfBirth')} value={student.placeOfBirth || t('students.notSet')} />
        <DetailItem label={t('students.cardCode.label')} value={cardCode || t('students.cardCode.notSet')} />
        <DetailItem label={t('students.fields.repeater')} value={student.repeater ? t('common.yes') : t('common.no')} />
        <DetailItem label={t('students.fields.joinDate')} value={formatDate(student.joinDate)} />
        <DetailItem label={t('students.fields.leaveDate')} value={formatDate(student.leaveDate)} />
      </section>

      <FormError message={error} />

      {canEdit ? (
        <div className="flex flex-col gap-3">
          <Button fullWidth variant="ghost" onClick={() => setScanning(true)}>
            {t('students.cardCode.scanCard')}
          </Button>
          <p className="text-center text-sm text-neutral-500">{t('students.cardCode.learnHint')}</p>
          <Button fullWidth onClick={onEdit} icon={<Pencil className="size-5" aria-hidden />}>
            {t('students.detail.edit')}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setConfirmOpen(true)} className="text-danger-700 hover:bg-danger-50" icon={<Trash2 className="size-5" aria-hidden />}>
            {t('students.detail.delete')}
          </Button>
        </div>
      ) : (
        <p className="rounded-xl bg-neutral-50 px-4 py-4 text-center text-sm text-neutral-500">{t('students.detail.readOnly')}</p>
      )}

      {scanning ? (
        <CardScanner paused={false} onDetect={handleScannedCard} onManual={() => setScanning(false)} onClose={() => setScanning(false)} />
      ) : null}

      <Modal
        open={confirmOpen}
        title={t('students.detail.deleteTitle', { name: fullName })}
        description={t('students.detail.deleteBody')}
        onClose={() => setConfirmOpen(false)}
      >
        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <Button variant="danger" fullWidth onClick={handleDelete} disabled={submitting}>
            {t('students.detail.delete')}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setConfirmOpen(false)}>
            {t('common.cancel')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="text-base font-medium text-neutral-900">{value}</span>
    </div>
  );
}
