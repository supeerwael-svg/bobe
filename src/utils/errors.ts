export class DomainError extends Error {
  key: string;

  constructor(key: string) {
    super(key);
    this.name = 'DomainError';
    this.key = key;
  }
}

export function errorKey(error: unknown): string {
  return error instanceof DomainError ? error.key : 'common.errorGeneric';
}
