import { DomainError } from '@/utils/errors';
import { hashPassword, verifyPassword } from '@/utils/password';
import { generateInviteCode, normalizeInviteCode } from '@/utils/invite';
import { DEFAULT_WORKING_DAYS } from '@/db/institutions';
import { db } from './database';
import { newBaseFields } from './records';
import { assertUsernameAvailable, defaultPermissions, toUsernameKey } from './users';
import type { Institution, User } from './types';

export interface SessionData {
  user: User;
  institution: Institution;
}

export async function createInstitution(input: { name: string; username: string; password: string }): Promise<User> {
  const institutionId = crypto.randomUUID();
  const passwordHash = await hashPassword(input.password);
  const usernameKey = toUsernameKey(input.username);

  const institution: Institution = {
    ...newBaseFields(institutionId, null, institutionId),
    name: input.name.trim(),
    rooms: 0,
    holidays: [],
    workingDays: [...DEFAULT_WORKING_DAYS],
    inviteCode: generateInviteCode(),
  };
  const head: User = {
    ...newBaseFields(institutionId, null),
    name: input.username.trim(),
    usernameKey,
    passwordHash,
    role: 'head',
    status: 'approved',
    permissions: null,
  };
  institution.updatedBy = head.id;

  await db.transaction('rw', db.institutions, db.users, async () => {
    await assertUsernameAvailable(usernameKey);
    await db.institutions.add(institution);
    await db.users.add(head);
  });
  return head;
}

export async function joinInstitution(input: { inviteCode: string; name: string; password: string }): Promise<User> {
  const code = normalizeInviteCode(input.inviteCode);
  const usernameKey = toUsernameKey(input.name);
  const passwordHash = await hashPassword(input.password);

  return db.transaction('rw', db.institutions, db.users, async () => {
    const institution = await db.institutions.where('inviteCode').equals(code).first();
    if (!institution || institution.deletedAt !== null) {
      throw new DomainError('auth.errors.inviteInvalid');
    }
    await assertUsernameAvailable(usernameKey);

    const user: User = {
      ...newBaseFields(institution.id, null),
      name: input.name.trim(),
      usernameKey,
      passwordHash,
      role: 'supervisor',
      status: 'pending',
      permissions: defaultPermissions(),
    };
    user.updatedBy = user.id;
    await db.users.add(user);
    return user;
  });
}

export async function signInWithCredentials(identifier: string, password: string): Promise<User> {
  const usernameKey = toUsernameKey(identifier);
  const user = await db.users
    .where('usernameKey')
    .equals(usernameKey)
    .filter((candidate) => candidate.deletedAt === null)
    .first();

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new DomainError('auth.errors.invalidCredentials');
  }
  if (user.status === 'rejected') {
    throw new DomainError('auth.errors.rejected');
  }
  return user;
}

export async function loadSession(userId: string): Promise<SessionData | null> {
  const user = await db.users.get(userId);
  if (!user || user.deletedAt !== null) return null;
  const institution = await db.institutions.get(user.institutionId);
  if (!institution || institution.deletedAt !== null) return null;
  return { user, institution };
}
