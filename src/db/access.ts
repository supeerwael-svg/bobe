import { DomainError } from '@/utils/errors';
import { getActiveUser } from './users';
import type { ModuleId, SearchScope } from './types';

export interface StudentAccess {
  isHead: boolean;
  canEdit: boolean;
  visibleClassIds: string[] | null;
  searchScope: SearchScope;
}

export async function getModuleAccess(actorId: string, moduleId: ModuleId): Promise<StudentAccess> {
  const actor = await getActiveUser(actorId);
  if (actor.role === 'head') {
    return { isHead: true, canEdit: true, visibleClassIds: null, searchScope: 'institution' };
  }
  if (actor.status !== 'approved' || !actor.permissions) {
    throw new DomainError('errors.notAuthorized');
  }
  return {
    isHead: false,
    canEdit: actor.permissions.modules[moduleId] === 'edit',
    visibleClassIds: actor.permissions.assignedClasses,
    searchScope: actor.permissions.searchScope,
  };
}

export function getStudentAccess(actorId: string): Promise<StudentAccess> {
  return getModuleAccess(actorId, 'students');
}

export function canAccessClass(access: StudentAccess, classId: string): boolean {
  return access.visibleClassIds === null || access.visibleClassIds.includes(classId);
}

export function assertCanEditClassIn(access: StudentAccess, classId: string): void {
  if (!access.canEdit || !canAccessClass(access, classId)) {
    throw new DomainError('errors.notAuthorized');
  }
}
