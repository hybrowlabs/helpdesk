
import { call } from "frappe-ui";

import { getCall } from "../http";
import {
  toAccountOpeningError,
  unwrap,
} from "../accountOpening/envelope";
import type { AccountOpeningEnvelope } from "../accountOpening";
import { normalizeForm, toPayload } from "./presenter";
import type { ModificationForm, ModificationRecord } from "./types";

const BASE = "pc_helpdesk.customizations.api.client_modification";

const METHODS = {
  get: `${BASE}.get_case`,
  create: `${BASE}.create_case`,
  save: `${BASE}.save_case`,
  fetchMaster: `${BASE}.fetch_client_master`,
} as const;

function normalizeRecord(
  raw: ModificationRecord | null
): ModificationRecord | null {
  if (!raw?.name) return null;

  return {
    name: raw.name,
    ticket: raw.ticket ?? "",
    workflowState: raw.workflowState ?? "",
    client: raw.client ?? null,
    form: normalizeForm(raw.form),
    meta: { lastUpdatedOn: raw.meta?.lastUpdatedOn ?? null },
  };
}

/** Null when no case has been opened against this ticket yet. */
export async function fetchCase(
  ticketId: string
): Promise<ModificationRecord | null> {
  let envelope: AccountOpeningEnvelope<ModificationRecord>;
  try {
    envelope = await getCall(METHODS.get, { ticket_id: ticketId });
  } catch (cause) {
    throw toAccountOpeningError(cause);
  }
  return normalizeRecord(unwrap(envelope));
}

/** Opens a case against the ticket. Idempotent — one case per ticket. */
export async function createCase(ticketId: string): Promise<ModificationRecord> {
  let envelope: AccountOpeningEnvelope<ModificationRecord>;
  try {
    envelope = await call(METHODS.create, { ticket_id: ticketId });
  } catch (cause) {
    throw toAccountOpeningError(cause);
  }

  const record = normalizeRecord(unwrap(envelope));
  if (!record) {
    throw toAccountOpeningError(new Error("Case was not created"));
  }
  return record;
}

export async function saveCase(
  caseName: string,
  form: ModificationForm
): Promise<ModificationRecord> {
  let envelope: AccountOpeningEnvelope<ModificationRecord>;
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
 * FR-14.14 — pull the client master for a trading account number and write it
 * onto the ticket. Returns a record whose `client` is null when the lookup is
 * not configured, which is an empty state rather than a failure.
 */
export async function fetchClientMaster(
  caseName: string,
  tradingAccountNumber: string
): Promise<ModificationRecord> {
  let envelope: AccountOpeningEnvelope<ModificationRecord>;
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
