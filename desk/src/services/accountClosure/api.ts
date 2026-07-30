/**
 * FR-11 Account Closure — HTTP client.
 *
 * The envelope and the error type are shared with the account-opening endpoints,
 * so `unwrap` and `toAccountOpeningError` are reused rather than duplicated.
 * There is no mock adapter: a closure case is entirely Frappe-side data that
 * exists on every site.
 */
import { call } from "frappe-ui";

import { toAccountOpeningError, unwrap } from "../accountOpening/envelope";
import type { AccountOpeningEnvelope } from "../accountOpening";
import { normalizeForm, toPayload } from "./presenter";
import type { ClosureAuditRow, ClosureForm, ClosureRecord } from "./types";

const BASE = "pc_helpdesk.customizations.api.account_closure";

const METHODS = {
  get: `${BASE}.get_case`,
  create: `${BASE}.create_case`,
  save: `${BASE}.save_case`,
  fetchMaster: `${BASE}.fetch_client_master`,
  fetchHoldings: `${BASE}.fetch_holdings`,
  auditTrail: `${BASE}.get_audit_trail`,
} as const;

function normalizeRecord(raw: ClosureRecord | null): ClosureRecord | null {
  if (!raw?.name) return null;

  return {
    name: raw.name,
    ticket: raw.ticket ?? "",
    workflowState: raw.workflowState ?? "",
    client: raw.client ?? null,
    form: normalizeForm(raw.form),
    writableFields: Array.isArray(raw.writableFields) ? raw.writableFields : [],
    meta: {
      lastUpdatedOn: raw.meta?.lastUpdatedOn ?? null,
      holdingsLookupConfigured: Boolean(raw.meta?.holdingsLookupConfigured),
    },
  };
}

/** Null when no case has been opened against this ticket yet. */
export async function fetchCase(ticketId: string): Promise<ClosureRecord | null> {
  let envelope: AccountOpeningEnvelope<ClosureRecord>;
  try {
    envelope = await call(METHODS.get, { ticket_id: ticketId });
  } catch (cause) {
    throw toAccountOpeningError(cause);
  }
  return normalizeRecord(unwrap(envelope));
}

/** Opens a case against the ticket. Idempotent — one case per ticket. */
export async function createCase(ticketId: string): Promise<ClosureRecord> {
  let envelope: AccountOpeningEnvelope<ClosureRecord>;
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
  form: ClosureForm
): Promise<ClosureRecord> {
  let envelope: AccountOpeningEnvelope<ClosureRecord>;
  try {
    envelope = await call(METHODS.save, {
      case_name: caseName,
      form: JSON.stringify(toPayload(form)),
    });
  } catch (cause) {
    throw toAccountOpeningError(cause);
  }

  const record = normalizeRecord(unwrap(envelope));
  if (!record) throw toAccountOpeningError(new Error("Case not returned"));
  return record;
}

/**
 * Pull the client master for a trading account number onto the case. Returns a
 * record whose `client` is null when the lookup is not configured, which is an
 * empty state rather than a failure.
 */
export async function fetchClientMaster(
  caseName: string,
  tradingAccountNumber: string
): Promise<ClosureRecord> {
  let envelope: AccountOpeningEnvelope<ClosureRecord>;
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

/** FR-11.12 — the debit balance and the stock holding valuation. */
export async function fetchHoldings(caseName: string): Promise<ClosureRecord> {
  let envelope: AccountOpeningEnvelope<ClosureRecord>;
  try {
    envelope = await call(METHODS.fetchHoldings, { case_name: caseName });
  } catch (cause) {
    throw toAccountOpeningError(cause);
  }

  const record = normalizeRecord(unwrap(envelope));
  if (!record) throw toAccountOpeningError(new Error("Case not returned"));
  return record;
}

/** FR-11.15 — the case's audit rows, newest first. */
export async function fetchAuditTrail(caseName: string): Promise<ClosureAuditRow[]> {
  let envelope: AccountOpeningEnvelope<ClosureAuditRow[]>;
  try {
    envelope = await call(METHODS.auditTrail, { case_name: caseName });
  } catch (cause) {
    throw toAccountOpeningError(cause);
  }

  return unwrap(envelope) ?? [];
}
