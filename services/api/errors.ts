// Machine-readable error codes the backend sends as error.code, and helpers
// to read them off whatever the API layer threw (ApiError, or an Error the
// service layer re-wrapped with `code` kept).

export const API_ERROR = {
  /** The account was deleted (after its 30-day grace period). */
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  /** Quest / reward action while the account waits to be deleted. */
  ACCOUNT_PENDING_DELETION: 'ACCOUNT_PENDING_DELETION',
  /** Signing up again with an identity whose account waits to be deleted. */
  ACCOUNT_PENDING_DELETION_LOGIN_TO_RESTORE: 'ACCOUNT_PENDING_DELETION_LOGIN_TO_RESTORE',
} as const;

export function getApiErrorCode(err: unknown): string | null {
  const e = err as any;
  const code = e?.code && e.code !== 'api_error' && e.code !== 'network_error' ? e.code : null;
  return code ?? e?.response?.data?.error?.code ?? null;
}

export const isApiError = (err: unknown, code: string) => getApiErrorCode(err) === code;

/** Shown when a quest or reward action is refused because deletion is pending. */
export const PENDING_DELETION_MESSAGE =
  'Your account is scheduled for deletion. Tap “Keep my account” on the banner to continue.';

export const PENDING_RESTORE_MESSAGE = 'This account is scheduled for deletion. Log in to restore it.';
