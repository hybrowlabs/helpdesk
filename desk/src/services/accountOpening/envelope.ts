
import {
  AccountOpeningError,
  type AccountOpeningEnvelope,
  type AccountOpeningErrorCode,
} from "./types";

const ERROR_CODES: readonly AccountOpeningErrorCode[] = [
  "NOT_FOUND",
  "PERMISSION_DENIED",
  "VALIDATION",
  "NETWORK",
  "UNKNOWN",
];

function isErrorCode(value: unknown): value is AccountOpeningErrorCode {
  return (
    typeof value === "string" &&
    (ERROR_CODES as readonly string[]).includes(value)
  );
}

/**
 * Turn whatever `call` rejected with into a typed error.
 * Frappe surfaces PermissionError with a 403, so status is the best signal.
 */
export function toAccountOpeningError(cause: unknown): AccountOpeningError {
  if (cause instanceof AccountOpeningError) return cause;

  const err = cause as {
    status?: number;
    httpStatus?: number;
    messages?: string[];
    message?: string;
    exc_type?: string;
  } | null;

  const status = err?.status ?? err?.httpStatus;
  const message =
    err?.messages?.[0] ||
    err?.message ||
    "Could not reach the account opening service";

  if (status === 403 || err?.exc_type === "PermissionError") {
    return new AccountOpeningError("PERMISSION_DENIED", message);
  }
  if (status === 404) {
    return new AccountOpeningError("NOT_FOUND", message);
  }
  if (status && status >= 500) {
    return new AccountOpeningError("NETWORK", message);
  }
  return new AccountOpeningError("UNKNOWN", message);
}

/** Unwrap the backend envelope, throwing on an explicit failure. */
export function unwrap<T>(
  envelope: AccountOpeningEnvelope<T> | null | undefined
): T | null {
  if (!envelope) {
    throw new AccountOpeningError(
      "UNKNOWN",
      "Empty response from the account opening service"
    );
  }
  if (!envelope.success) {
    const code = isErrorCode(envelope.error?.code)
      ? envelope.error.code
      : "UNKNOWN";
    throw new AccountOpeningError(
      code,
      envelope.error?.message || "Account opening request failed"
    );
  }
  return envelope.data ?? null;
}
