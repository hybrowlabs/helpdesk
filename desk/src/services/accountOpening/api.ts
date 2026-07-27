
import { call } from "frappe-ui";

import { normalizeVerification } from "./presenter";
import {
  AccountOpeningError,
  type AccountOpeningEnvelope,
  type AccountOpeningErrorCode,
  type AccountOpeningRecord,
  type AccountOpeningService,
  type VerificationDetails,
} from "./types";

const METHODS = {
  fetch: "pc_helpdesk.customizations.api.account_opening.get_account_opening",
  save: "pc_helpdesk.customizations.api.account_opening.save_verification",
} as const;

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
function toAccountOpeningError(cause: unknown): AccountOpeningError {
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
function unwrap<T>(envelope: AccountOpeningEnvelope<T> | null | undefined): T | null {
  if (!envelope) {
    throw new AccountOpeningError(
      "UNKNOWN",
      "Empty response from the account opening service"
    );
  }
  if (!envelope.success) {
    const code = isErrorCode(envelope.error?.code) ? envelope.error.code : "UNKNOWN";
    throw new AccountOpeningError(
      code,
      envelope.error?.message || "Account opening request failed"
    );
  }
  return envelope.data ?? null;
}

export class HttpAccountOpeningService implements AccountOpeningService {
  async fetch(ticketId: string): Promise<AccountOpeningRecord | null> {
    let envelope: AccountOpeningEnvelope<AccountOpeningRecord>;
    try {
      envelope = await call(METHODS.fetch, { ticket_id: ticketId });
    } catch (cause) {
      throw toAccountOpeningError(cause);
    }

    const record = unwrap(envelope);
    if (!record) return null;

    // Trust the shape, but keep the enum honest.
    return {
      ...record,
      verification: normalizeVerification(record.verification),
    };
  }

  async saveVerification(
    ticketId: string,
    verification: VerificationDetails
  ): Promise<VerificationDetails> {
    let envelope: AccountOpeningEnvelope<{ verification: VerificationDetails }>;
    try {
      envelope = await call(METHODS.save, {
        ticket_id: ticketId,
        verification: JSON.stringify(verification),
      });
    } catch (cause) {
      throw toAccountOpeningError(cause);
    }

    const data = unwrap(envelope);
    return normalizeVerification(data?.verification ?? verification);
  }
}
