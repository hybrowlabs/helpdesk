
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
  save: "pc_helpdesk.customizations.api.account_opening.save_verification",
} as const;

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
