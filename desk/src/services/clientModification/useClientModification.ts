/**
 * FR-14 Client Modification — state for one ticket.
 *
 * Mirrors `useAccountOpening`: loading / saving / error owned here, the
 * component only renders it.
 */
import { computed, reactive, ref, toValue, watch, type MaybeRefOrGetter } from "vue";

import { AccountOpeningError } from "../accountOpening";
import { createCase, fetchCase, fetchClientMaster, saveCase } from "./api";
import {
  emptyForm,
  getAccOpFields,
  getCssFields,
  normalizeForm,
  toClientRows,
  toProgressRows,
  validateForm,
} from "./presenter";
import type {
  ModificationClient,
  ModificationForm,
  ModificationRecord,
} from "./types";

function asError(cause: unknown): AccountOpeningError {
  return cause instanceof AccountOpeningError
    ? cause
    : new AccountOpeningError(
        "UNKNOWN",
        cause instanceof Error ? cause.message : String(cause)
      );
}

export function useClientModification(ticketId: MaybeRefOrGetter<string | number>) {
  // Null until a case has been opened against this ticket.
  const caseRecord = ref<ModificationRecord | null>(null);
  const client = ref<ModificationClient | null>(null);
  const creating = ref(false);
  const saved = ref<ModificationForm>(emptyForm());
  const form = reactive<ModificationForm>(emptyForm());

  const loading = ref(false);
  const saving = ref(false);
  const fetching = ref(false);
  const error = ref<AccountOpeningError | null>(null);
  const saveError = ref<AccountOpeningError | null>(null);
  const fieldErrors = ref<Partial<Record<keyof ModificationForm, string>>>({});

  // Guards against a slow response for a previous ticket landing after the
  // agent has navigated on — same approach as useAccountOpening.
  let requestToken = 0;

  function applyForm(next: ModificationForm): void {
    saved.value = next;
    Object.assign(form, next);
    fieldErrors.value = {};
  }

  function applyRecord(record: ModificationRecord): void {
    caseRecord.value = record;
    client.value = record.client;
    applyForm(record.form);
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
        applyForm(emptyForm());
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
    fieldErrors.value = errors;
    if (Object.keys(errors).length) return false;

    saving.value = true;
    saveError.value = null;
    try {
      applyRecord(await saveCase(name, candidate));
      return true;
    } catch (cause) {
      saveError.value = asError(cause);
      return false;
    } finally {
      saving.value = false;
    }
  }

  /** FR-14.14 — auto-fill from the client master. */
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

  function setField(fieldname: keyof ModificationForm, value: unknown): void {
    if (fieldname === "signatureVerified") {
      form.signatureVerified = Boolean(value);
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

  const isDirty = computed(() =>
    (Object.keys(saved.value) as (keyof ModificationForm)[]).some(
      (key) => (form[key] ?? "") !== (saved.value[key] ?? "")
    )
  );

  const hasCase = computed(() => caseRecord.value !== null);
  const caseName = computed(() => caseRecord.value?.name ?? "");
  const workflowState = computed(() => caseRecord.value?.workflowState ?? "");
  const hasClient = computed(() => client.value !== null);
  const clientRows = computed(() => (client.value ? toClientRows(client.value) : []));
  const progressRows = computed(() => toProgressRows(saved.value));
  const cssFields = computed(() => getCssFields(form));
  const accOpFields = computed(() => getAccOpFields());
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
    loading,
    saving,
    fetching,
    error,
    saveError,
    fieldErrors,
    isDirty,
    hasClient,
    clientRows,
    progressRows,
    cssFields,
    accOpFields,
    canEdit,
    reload: load,
    openCase,
    save,
    fetchMaster,
    setField,
    revert,
  };
}

export type UseClientModification = ReturnType<typeof useClientModification>;
