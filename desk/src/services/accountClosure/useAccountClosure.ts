/**
 * FR-11 Account Closure — state for one ticket.
 *
 * Mirrors `useClientModification`: loading / saving / error owned here, the
 * component only renders it. Two things are specific to FR-11:
 *
 * - `canWrite(field)` answers the phase 1 question — five departments share this
 *   document and the server only accepts the block the user's role owns, so the
 *   tab must not offer inputs it knows will be dropped.
 * - the audit trail is loaded lazily, only when its sub-tab is first opened, so
 *   the common case does not pay for it.
 */
import { computed, reactive, ref, toValue, watch, type MaybeRefOrGetter } from "vue";

import { AccountOpeningError } from "../accountOpening";
import {
  createCase,
  fetchAuditTrail,
  fetchCase,
  fetchClientMaster,
  fetchHoldings,
  saveCase,
} from "./api";
import {
  emptyForm,
  getApprovalFields,
  getDepartmentBlocks,
  getDocumentFields,
  getIntakeFields,
  normalizeForm,
  toClientRows,
  toPhaseOneRows,
  toPhaseTwoRows,
  toRejectionRows,
  toStatusRows,
  validateForm,
} from "./presenter";
import { CHECK_FIELDS, CURRENCY_FIELDS } from "./types";
import type {
  ClosureAuditRow,
  ClosureClient,
  ClosureForm,
  ClosureRecord,
} from "./types";

const CHECKS = new Set<string>(CHECK_FIELDS);
const CURRENCIES = new Set<string>(CURRENCY_FIELDS);

function asError(cause: unknown): AccountOpeningError {
  return cause instanceof AccountOpeningError
    ? cause
    : new AccountOpeningError(
        "UNKNOWN",
        cause instanceof Error ? cause.message : String(cause)
      );
}

export function useAccountClosure(ticketId: MaybeRefOrGetter<string | number>) {
  // Null until a case has been opened against this ticket.
  const caseRecord = ref<ClosureRecord | null>(null);
  const client = ref<ClosureClient | null>(null);
  const creating = ref(false);
  const saved = ref<ClosureForm>(emptyForm());
  const form = reactive<ClosureForm>(emptyForm());
  const writable = ref<Set<string>>(new Set());

  const auditTrail = ref<ClosureAuditRow[]>([]);
  const auditLoading = ref(false);
  const auditLoaded = ref(false);

  const loading = ref(false);
  const saving = ref(false);
  const fetching = ref(false);
  const fetchingHoldings = ref(false);
  const error = ref<AccountOpeningError | null>(null);
  const saveError = ref<AccountOpeningError | null>(null);
  const fieldErrors = ref<Partial<Record<keyof ClosureForm, string>>>({});

  // Guards against a slow response for a previous ticket landing after the
  // agent has navigated on — same approach as useAccountOpening.
  let requestToken = 0;

  function applyForm(next: ClosureForm): void {
    saved.value = next;
    Object.assign(form, next);
    fieldErrors.value = {};
  }

  function applyRecord(record: ClosureRecord): void {
    caseRecord.value = record;
    client.value = record.client;
    writable.value = new Set(record.writableFields);
    applyForm(record.form);
  }

  function reset(): void {
    caseRecord.value = null;
    client.value = null;
    writable.value = new Set();
    auditTrail.value = [];
    auditLoaded.value = false;
    applyForm(emptyForm());
  }

  async function load(): Promise<void> {
    const id = String(toValue(ticketId) ?? "");
    if (!id) return;

    const token = ++requestToken;
    loading.value = true;
    error.value = null;
    saveError.value = null;

    try {
      const record = await fetchCase(id);
      if (token !== requestToken) return;

      if (record) {
        applyRecord(record);
      } else {
        reset();
      }
    } catch (cause) {
      if (token !== requestToken) return;
      caseRecord.value = null;
      client.value = null;
      error.value = asError(cause);
    } finally {
      if (token === requestToken) loading.value = false;
    }
  }

  /** Open a case against this ticket (idempotent server-side). */
  async function openCase(): Promise<boolean> {
    const id = String(toValue(ticketId) ?? "");
    if (!id || creating.value) return false;

    creating.value = true;
    saveError.value = null;
    try {
      applyRecord(await createCase(id));
      return true;
    } catch (cause) {
      saveError.value = asError(cause);
      return false;
    } finally {
      creating.value = false;
    }
  }

  async function save(): Promise<boolean> {
    const name = caseRecord.value?.name;
    if (!name || saving.value) return false;

    const candidate = normalizeForm(form);
    // Only the blocks this user owns are sent, so a rule about a block they
    // cannot write must not stop their own save.
    const errors = filterOwnedErrors(validateForm(candidate));
    fieldErrors.value = errors;
    if (Object.keys(errors).length) return false;

    saving.value = true;
    saveError.value = null;
    try {
      applyRecord(await saveCase(name, candidate));
      auditLoaded.value = false;
      return true;
    } catch (cause) {
      saveError.value = asError(cause);
      return false;
    } finally {
      saving.value = false;
    }
  }

  function filterOwnedErrors(
    errors: Partial<Record<keyof ClosureForm, string>>
  ): Partial<Record<keyof ClosureForm, string>> {
    const owned: Partial<Record<keyof ClosureForm, string>> = {};
    for (const [key, message] of Object.entries(errors)) {
      if (writable.value.has(key)) owned[key as keyof ClosureForm] = message as string;
    }
    return owned;
  }

  async function fetchMaster(): Promise<boolean> {
    const name = caseRecord.value?.name;
    const account = form.tradingAccountNumber.trim();
    if (!name || !account || fetching.value) return false;

    fetching.value = true;
    saveError.value = null;
    try {
      const record = await fetchClientMaster(name, account);
      // An unconfigured lookup returns the case unchanged, so `client` stays
      // null and nothing the agent typed is wiped.
      applyRecord(record);
      return Boolean(record.client);
    } catch (cause) {
      saveError.value = asError(cause);
      return false;
    } finally {
      fetching.value = false;
    }
  }

  /** FR-11.12 — pull the debit balance and holding valuation. */
  async function loadHoldings(): Promise<boolean> {
    const name = caseRecord.value?.name;
    if (!name || fetchingHoldings.value) return false;

    fetchingHoldings.value = true;
    saveError.value = null;
    try {
      const record = await fetchHoldings(name);
      applyRecord(record);
      return Boolean(record.form.holdingsSource);
    } catch (cause) {
      saveError.value = asError(cause);
      return false;
    } finally {
      fetchingHoldings.value = false;
    }
  }

  /** FR-11.15 — loaded on demand, and again after any save. */
  async function loadAuditTrail(force = false): Promise<void> {
    const name = caseRecord.value?.name;
    if (!name || auditLoading.value) return;
    if (auditLoaded.value && !force) return;

    auditLoading.value = true;
    try {
      auditTrail.value = await fetchAuditTrail(name);
      auditLoaded.value = true;
    } catch {
      // The trail is supporting detail; the tab reports real failures on the
      // case itself. An empty trail is a truthful fallback.
      auditTrail.value = [];
    } finally {
      auditLoading.value = false;
    }
  }

  function setField(fieldname: keyof ClosureForm, value: unknown): void {
    if (CHECKS.has(fieldname)) {
      (form as Record<string, unknown>)[fieldname] = Boolean(value);
    } else if (CURRENCIES.has(fieldname)) {
      (form as Record<string, unknown>)[fieldname] = Number(value ?? 0) || 0;
    } else {
      (form as Record<string, unknown>)[fieldname] =
        value === null || value === undefined ? "" : String(value);
    }

    if (fieldErrors.value[fieldname]) {
      const { [fieldname]: _cleared, ...rest } = fieldErrors.value;
      fieldErrors.value = rest;
    }
  }

  function revert(): void {
    applyForm(saved.value);
    saveError.value = null;
  }

  /** Whether this user's roles own a given field — see `writableFields`. */
  function canWrite(fieldname: string): boolean {
    return writable.value.has(fieldname);
  }

  const isDirty = computed(() =>
    (Object.keys(saved.value) as (keyof ClosureForm)[]).some(
      (key) => (form[key] ?? "") !== (saved.value[key] ?? "")
    )
  );

  const hasCase = computed(() => caseRecord.value !== null);
  const caseName = computed(() => caseRecord.value?.name ?? "");
  const workflowState = computed(() => caseRecord.value?.workflowState ?? "");
  const hasClient = computed(() => client.value !== null);
  const holdingsLookupConfigured = computed(
    () => caseRecord.value?.meta.holdingsLookupConfigured ?? false
  );

  const clientRows = computed(() => (client.value ? toClientRows(client.value) : []));
  const statusRows = computed(() => toStatusRows(saved.value));
  const phaseOneRows = computed(() => toPhaseOneRows(saved.value));
  const phaseTwoRows = computed(() => toPhaseTwoRows(saved.value));
  const rejectionRows = computed(() => toRejectionRows(saved.value));
  const intakeFields = computed(() => getIntakeFields(form));
  const documentFields = computed(() => getDocumentFields(form));
  const departmentBlocks = computed(() => getDepartmentBlocks(form));
  const approvalFields = computed(() => getApprovalFields());

  const isRejected = computed(() => Boolean(saved.value.rejectedBy));
  const canEdit = computed(() => hasCase.value && !loading.value && writable.value.size > 0);

  watch(() => toValue(ticketId), load, { immediate: true });

  return {
    caseRecord,
    caseName,
    workflowState,
    hasCase,
    creating,
    client,
    form,
    saved,
    loading,
    saving,
    fetching,
    fetchingHoldings,
    error,
    saveError,
    fieldErrors,
    isDirty,
    isRejected,
    hasClient,
    holdingsLookupConfigured,
    clientRows,
    statusRows,
    phaseOneRows,
    phaseTwoRows,
    rejectionRows,
    intakeFields,
    documentFields,
    departmentBlocks,
    approvalFields,
    auditTrail,
    auditLoading,
    canEdit,
    canWrite,
    reload: load,
    openCase,
    save,
    fetchMaster,
    loadHoldings,
    loadAuditTrail,
    setField,
    revert,
  };
}

export type UseAccountClosure = ReturnType<typeof useAccountClosure>;
