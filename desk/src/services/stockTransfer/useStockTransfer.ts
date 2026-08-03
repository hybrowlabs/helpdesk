/**
 * Stock Transfer — state for one ticket.
 *
 * Mirrors `useClientModification`: loading / saving / error owned here, the
 * component only renders it. The securities grid is held alongside the form
 * because it saves in the same round trip.
 */
import { computed, reactive, ref, toValue, watch, type MaybeRefOrGetter } from "vue";

import { AccountOpeningError } from "../accountOpening";
import {
  createCase,
  fetchCase,
  fetchClientMaster,
  fetchSecurities,
  saveCase,
} from "./api";
import {
  emptyForm,
  emptySecurity,
  getConfirmationFields,
  getDocumentFields,
  getProcessingFields,
  getRequestFields,
  getTargetFields,
  normalizeForm,
  toClientRows,
  toStatusRows,
  validateForm,
  validateSecurities,
} from "./presenter";
import type {
  TransferClient,
  TransferForm,
  TransferRecord,
  TransferSecurity,
} from "./types";

function asError(cause: unknown): AccountOpeningError {
  return cause instanceof AccountOpeningError
    ? cause
    : new AccountOpeningError(
        "UNKNOWN",
        cause instanceof Error ? cause.message : String(cause)
      );
}

export function useStockTransfer(ticketId: MaybeRefOrGetter<string | number>) {
  // Null until a case has been opened against this ticket.
  const caseRecord = ref<TransferRecord | null>(null);
  const client = ref<TransferClient | null>(null);
  const creating = ref(false);
  const saved = ref<TransferForm>(emptyForm());
  const form = reactive<TransferForm>(emptyForm());
  const savedSecurities = ref<TransferSecurity[]>([]);
  const securities = ref<TransferSecurity[]>([]);

  const loading = ref(false);
  const saving = ref(false);
  const fetching = ref(false);
  const fetchingSecurities = ref(false);
  const error = ref<AccountOpeningError | null>(null);
  const saveError = ref<AccountOpeningError | null>(null);
  const fieldErrors = ref<Partial<Record<keyof TransferForm, string>>>({});
  const securityErrors = ref<Record<number, string>>({});

  // Guards against a slow response for a previous ticket landing after the
  // agent has navigated on.
  let requestToken = 0;

  function applyForm(next: TransferForm, rows: TransferSecurity[]): void {
    saved.value = next;
    Object.assign(form, next);
    savedSecurities.value = rows;
    securities.value = rows.map((row) => ({ ...row }));
    fieldErrors.value = {};
    securityErrors.value = {};
  }

  function applyRecord(record: TransferRecord): void {
    caseRecord.value = record;
    client.value = record.client;
    applyForm(record.form, record.securities);
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
        caseRecord.value = null;
        client.value = null;
        applyForm(emptyForm(), []);
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
    const errors = validateForm(candidate);
    const rowErrors = validateSecurities(securities.value);
    fieldErrors.value = errors;
    securityErrors.value = rowErrors;
    if (Object.keys(errors).length || Object.keys(rowErrors).length) return false;

    saving.value = true;
    saveError.value = null;
    try {
      applyRecord(await saveCase(name, candidate, securities.value));
      return true;
    } catch (cause) {
      saveError.value = asError(cause);
      return false;
    } finally {
      saving.value = false;
    }
  }

  /** Auto-fill the source account's master record. */
  async function fetchMaster(): Promise<boolean> {
    const name = caseRecord.value?.name;
    const account = form.tradingAccountNumber.trim();
    if (!name || !account || fetching.value) return false;

    fetching.value = true;
    saveError.value = null;
    try {
      const record = await fetchClientMaster(name, account);
      applyRecord(record);
      return Boolean(record.client);
    } catch (cause) {
      saveError.value = asError(cause);
      return false;
    } finally {
      fetching.value = false;
    }
  }

  /** Pull the holdings. Replaces the grid, so the tab confirms first. */
  async function loadSecurities(): Promise<boolean> {
    const name = caseRecord.value?.name;
    if (!name || fetchingSecurities.value) return false;

    fetchingSecurities.value = true;
    saveError.value = null;
    try {
      const record = await fetchSecurities(name);
      applyRecord(record);
      return record.securities.length > 0;
    } catch (cause) {
      saveError.value = asError(cause);
      return false;
    } finally {
      fetchingSecurities.value = false;
    }
  }

  function setField(fieldname: keyof TransferForm, value: unknown): void {
    if (fieldname === "isThirdPartyTransfer") {
      form.isThirdPartyTransfer = Boolean(value);
    } else {
      (form as Record<string, unknown>)[fieldname] =
        value === null || value === undefined ? "" : String(value);
    }

    if (fieldErrors.value[fieldname]) {
      const { [fieldname]: _cleared, ...rest } = fieldErrors.value;
      fieldErrors.value = rest;
    }
  }

  function addSecurity(): void {
    securities.value = [...securities.value, emptySecurity()];
  }

  function removeSecurity(index: number): void {
    securities.value = securities.value.filter((_row, i) => i !== index);
    securityErrors.value = {};
  }

  function setSecurityField(
    index: number,
    key: keyof TransferSecurity,
    value: unknown
  ): void {
    const rows = [...securities.value];
    const row = { ...rows[index] };

    if (key === "quantity" || key === "marketValue") {
      row[key] = Number(value) || 0;
    } else if (key === "isin") {
      row.isin = String(value ?? "").toUpperCase();
    } else if (key === "securityName") {
      row.securityName = String(value ?? "");
    }

    rows[index] = row;
    securities.value = rows;

    if (securityErrors.value[index]) {
      const { [index]: _cleared, ...rest } = securityErrors.value;
      securityErrors.value = rest;
    }
  }

  function revert(): void {
    applyForm(saved.value, savedSecurities.value);
    saveError.value = null;
  }

  const securitiesDirty = computed(() => {
    if (securities.value.length !== savedSecurities.value.length) return true;
    return securities.value.some((row, index) => {
      const original = savedSecurities.value[index];
      return (
        row.isin !== original.isin ||
        row.securityName !== original.securityName ||
        row.quantity !== original.quantity ||
        row.marketValue !== original.marketValue
      );
    });
  });

  const isDirty = computed(
    () =>
      securitiesDirty.value ||
      (Object.keys(saved.value) as (keyof TransferForm)[]).some(
        (key) => (form[key] ?? "") !== (saved.value[key] ?? "")
      )
  );

  // The grid totals update as the agent types; the server recomputes them on
  // save, so these are a preview rather than the number of record.
  const draftQuantity = computed(() =>
    securities.value.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)
  );
  const draftValue = computed(() =>
    securities.value.reduce((sum, row) => sum + (Number(row.marketValue) || 0), 0)
  );

  const hasCase = computed(() => caseRecord.value !== null);
  const caseName = computed(() => caseRecord.value?.name ?? "");
  const workflowState = computed(() => caseRecord.value?.workflowState ?? "");
  const hasClient = computed(() => client.value !== null);
  const usingPlaceholderData = computed(
    () => caseRecord.value?.meta.usingPlaceholderData ?? false
  );
  const clientRows = computed(() => (client.value ? toClientRows(client.value) : []));
  const statusRows = computed(() => toStatusRows(saved.value));
  const requestFields = computed(() => getRequestFields());
  const targetFields = computed(() => getTargetFields(form));
  const documentFields = computed(() => getDocumentFields());
  const confirmationFields = computed(() => getConfirmationFields());
  const processingFields = computed(() => getProcessingFields());
  const canEdit = computed(() => hasCase.value && !loading.value);

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
    securities,
    loading,
    saving,
    fetching,
    fetchingSecurities,
    error,
    saveError,
    fieldErrors,
    securityErrors,
    isDirty,
    hasClient,
    usingPlaceholderData,
    clientRows,
    statusRows,
    requestFields,
    targetFields,
    documentFields,
    confirmationFields,
    processingFields,
    draftQuantity,
    draftValue,
    canEdit,
    reload: load,
    openCase,
    save,
    fetchMaster,
    loadSecurities,
    setField,
    addSecurity,
    removeSecurity,
    setSecurityField,
    revert,
  };
}

export type UseStockTransfer = ReturnType<typeof useStockTransfer>;
