
import { call } from "frappe-ui";

import { toAccountOpeningError, unwrap } from "./envelope";
import { normalizeVerification } from "./presenter";
import {
  type AccountOpeningEnvelope,
  type AccountOpeningRecord,
  type AccountOpeningService,
  type VerificationDetails,
} from "./types";

const METHODS = {
  fetch: "pc_helpdesk.customizations.api.account_opening.get_account_opening",
  create: "pc_helpdesk.customizations.api.account_opening.create_case",
  save: "pc_helpdesk.customizations.api.account_opening.save_verification",
} as const;

function normalizeRecord(
  record: AccountOpeningRecord | null
): AccountOpeningRecord | null {
  if (!record) return null;

  // Trust the shape, but keep the enum honest.
  return {
    ...record,
    case: record.case ?? null,
    verification: normalizeVerification(record.verification),
  };
}

export class HttpAccountOpeningService implements AccountOpeningService {
  async fetch(ticketId: string): Promise<AccountOpeningRecord | null> {
    let envelope: AccountOpeningEnvelope<AccountOpeningRecord>;
    try {
      envelope = await call(METHODS.fetch, { ticket_id: ticketId });
    } catch (cause) {
      throw toAccountOpeningError(cause);
    }

    return normalizeRecord(unwrap(envelope));
  }

  async createCase(ticketId: string): Promise<AccountOpeningRecord> {
    let envelope: AccountOpeningEnvelope<AccountOpeningRecord>;
    try {
      envelope = await call(METHODS.create, { ticket_id: ticketId });
    } catch (cause) {
      throw toAccountOpeningError(cause);
    }

    const record = normalizeRecord(unwrap(envelope));
    if (!record?.case) {
      throw toAccountOpeningError(new Error("Case was not created"));
    }
    return record;
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
