/**
 * Stock Transfer — HTTP client.
 *
 * The envelope and the error type are shared with the account-opening endpoints,
 * so `unwrap` and `toAccountOpeningError` are reused rather than duplicated.
 * There is no mock adapter: a transfer case is entirely Frappe-side data that
 * exists on every site — and the vendor half is already served by the
 * placeholder source until the client's endpoint arrives.
 */
import { call } from "frappe-ui";

import { getCall } from "../http";
import { toAccountOpeningError, unwrap } from "../accountOpening/envelope";
import type { AccountOpeningEnvelope } from "../accountOpening";
import { normalizeForm, normalizeSecurities, toPayload } from "./presenter";
import type { TransferForm, TransferRecord, TransferSecurity } from "./types";

const BASE = "pc_helpdesk.customizations.api.stock_transfer";

const METHODS = {
  get: `${BASE}.get_case`,
  create: `${BASE}.create_case`,
  save: `${BASE}.save_case`,
  fetchMaster: `${BASE}.fetch_client_master`,
  fetchSecurities: `${BASE}.fetch_securities`,
} as const;

function normalizeRecord(raw: TransferRecord | null): TransferRecord | null {
  if (!raw?.name) return null;

  return {
    name: raw.name,
    ticket: raw.ticket ?? "",
    workflowState: raw.workflowState ?? "",
    client: raw.client ?? null,
    securities: normalizeSecurities(raw.securities),
    form: normalizeForm(raw.form),
    meta: {
      lastUpdatedOn: raw.meta?.lastUpdatedOn ?? null,
      usingPlaceholderData: Boolean(raw.meta?.usingPlaceholderData),
    },
  };
}

/** Null when no case has been opened against this ticket yet. */
export async function fetchCase(ticketId: string): Promise<TransferRecord | null> {
  let envelope: AccountOpeningEnvelope<TransferRecord>;
  try {
    envelope = await getCall(METHODS.get, { ticket_id: ticketId });
  } catch (cause) {
    throw toAccountOpeningError(cause);
  }
  return normalizeRecord(unwrap(envelope));
}

/** Opens a case against the ticket. Idempotent — one case per ticket. */
export async function createCase(ticketId: string): Promise<TransferRecord> {
  let envelope: AccountOpeningEnvelope<TransferRecord>;
  try {
    envelope = await call(METHODS.create, { ticket_id: ticketId });
  } catch (cause) {
    throw toAccountOpeningError(cause);
  }

  const record = normalizeRecord(unwrap(envelope));
  if (!record) throw toAccountOpeningError(new Error("Case was not created"));
  return record;
}

export async function saveCase(
  caseName: string,
  form: TransferForm,
  securities: TransferSecurity[]
): Promise<TransferRecord> {
  let envelope: AccountOpeningEnvelope<TransferRecord>;
  try {
    envelope = await call(METHODS.save, {
      case_name: caseName,
      form: JSON.stringify(toPayload(form, securities)),
    });
  } catch (cause) {
    throw toAccountOpeningError(cause);
  }

  const record = normalizeRecord(unwrap(envelope));
  if (!record) throw toAccountOpeningError(new Error("Case not returned"));
  return record;
}

/**
 * Pull the source account's master record onto the case. Served by the
 * placeholder source until the client's endpoint exists; the record carries
 * `meta.usingPlaceholderData` so the tab can say which it got.
 */
export async function fetchClientMaster(
  caseName: string,
  tradingAccountNumber: string
): Promise<TransferRecord> {
  let envelope: AccountOpeningEnvelope<TransferRecord>;
  try {
    envelope = await call(METHODS.fetchMaster, {
      case_name: caseName,
      trading_account_number: tradingAccountNumber,
    });
  } catch (cause) {
    throw toAccountOpeningError(cause);
  }

  const record = normalizeRecord(unwrap(envelope));
  if (!record) throw toAccountOpeningError(new Error("Case not returned"));
  return record;
}

/** Pull the holdings available to transfer. Replaces the securities table. */
export async function fetchSecurities(caseName: string): Promise<TransferRecord> {
  let envelope: AccountOpeningEnvelope<TransferRecord>;
  try {
    envelope = await call(METHODS.fetchSecurities, { case_name: caseName });
  } catch (cause) {
    throw toAccountOpeningError(cause);
  }

  const record = normalizeRecord(unwrap(envelope));
  if (!record) throw toAccountOpeningError(new Error("Case not returned"));
  return record;
}
