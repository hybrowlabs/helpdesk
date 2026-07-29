
import { computed, reactive, ref, toValue, watch, type MaybeRefOrGetter } from "vue";

import {
  emptyVerification,
  getVerificationFields,
  normalizeVerification,
  toDetailRows,
  validateVerification,
} from "./presenter";
import { getAccountOpeningService, isUsingMockData } from "./service";
import {
  AccountOpeningError,
  type AccountOpeningRecord,
  type VerificationDetails,
} from "./types";

function asError(cause: unknown): AccountOpeningError {
  return cause instanceof AccountOpeningError
    ? cause
    : new AccountOpeningError(
        "UNKNOWN",
        cause instanceof Error ? cause.message : String(cause)
      );
}

export function useAccountOpening(ticketId: MaybeRefOrGetter<string | number>) {
  const service = getAccountOpeningService();

  const record = ref<AccountOpeningRecord | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const creating = ref(false);
  const error = ref<AccountOpeningError | null>(null);
  const saveError = ref<AccountOpeningError | null>(null);

  const form = reactive<VerificationDetails>(emptyVerification());
  const fieldErrors = ref<Partial<Record<keyof VerificationDetails, string>>>({});

 
  let requestToken = 0;

  function resetForm(verification: VerificationDetails): void {
    Object.assign(form, verification);
    fieldErrors.value = {};
  }

  async function load(): Promise<void> {
    const id = String(toValue(ticketId) ?? "");
    if (!id) {
      record.value = null;
      return;
    }

    const token = ++requestToken;
    loading.value = true;
    error.value = null;
    saveError.value = null;

    try {
      const result = await service.fetch(id);
      if (token !== requestToken) return;

      record.value = result;
      resetForm(result ? result.verification : emptyVerification());
    } catch (cause) {
      if (token !== requestToken) return;
      record.value = null;
      error.value = asError(cause);
    } finally {
      if (token === requestToken) loading.value = false;
    }
  }

  /** Opens the case this ticket's workflow will run on. Idempotent. */
  async function openCase(): Promise<boolean> {
    const id = String(toValue(ticketId) ?? "");
    if (!id || creating.value) return false;

    creating.value = true;
    saveError.value = null;
    try {
      const result = await service.createCase(id);
      record.value = result;
      resetForm(result.verification);
      return true;
    } catch (cause) {
      saveError.value = asError(cause);
      return false;
    } finally {
      creating.value = false;
    }
  }

  async function save(): Promise<boolean> {
    const id = String(toValue(ticketId) ?? "");
    if (!id || saving.value) return false;

    const candidate = normalizeVerification(form);
    const errors = validateVerification(candidate, {
      videoVerificationRequired: videoVerificationRequired.value,
    });
    fieldErrors.value = errors;
    if (Object.keys(errors).length) return false;

    saving.value = true;
    saveError.value = null;
    try {
      const stored = await service.saveVerification(id, candidate);
      resetForm(stored);
      if (record.value) {
        record.value = {
          ...record.value,
          verification: stored,
          meta: { ...record.value.meta, lastUpdatedOn: new Date().toISOString() },
        };
      }
      return true;
    } catch (cause) {
      saveError.value = asError(cause);
      return false;
    } finally {
      saving.value = false;
    }
  }

  function revert(): void {
    resetForm(record.value?.verification ?? emptyVerification());
    saveError.value = null;
  }

  function setField(
    fieldname: keyof VerificationDetails,
    value: string | number | boolean | null
  ): void {
    const next = value === null || value === undefined ? "" : String(value);

    if (fieldname === "verificationDate") {
      form.verificationDate = next.trim() || null;
    } else if (fieldname === "clientDateOfBirth") {
      form.clientDateOfBirth = next.trim() || null;
    } else if (fieldname === "callVerificationStatus") {
      // Statuses go through the normaliser so a stray option can never put an
      // invalid enum into the form.
      form.callVerificationStatus = normalizeVerification({
        callVerificationStatus: next,
      }).callVerificationStatus;
    } else if (fieldname === "signatureVerificationStatus") {
      form.signatureVerificationStatus = normalizeVerification({
        signatureVerificationStatus: next,
      }).signatureVerificationStatus;
    } else if (fieldname === "videoVerificationStatus") {
      form.videoVerificationStatus = normalizeVerification({
        videoVerificationStatus: next,
      }).videoVerificationStatus;
    } else {
      form[fieldname] = next;
    }

    // Clear the field's error as soon as the agent edits it.
    if (fieldErrors.value[fieldname]) {
      const { [fieldname]: _cleared, ...rest } = fieldErrors.value;
      fieldErrors.value = rest;
    }
  }

  // The case the FR-10 workflow runs on. Null until an agent opens one, which
  // is the tab's first action rather than an error.
  const caseName = computed(() => record.value?.case?.name ?? "");
  const hasCase = computed(() => Boolean(record.value?.case));

  // "No application" — either nothing came back at all, or a record came back
  // with no application resolved. The Form tab still renders in the second
  // case, so the agent can enter the PAN / Client ID that will resolve one.
  const isEmpty = computed(
    () =>
      !loading.value &&
      !error.value &&
      (record.value === null || record.value.application === null)
  );

  const detailRows = computed(() =>
    record.value?.application ? toDetailRows(record.value.application) : []
  );

  // The compliance flag is decided by the server from the client's date of
  // birth; the form only reflects it. The case is authoritative — it holds the
  // date of birth the agent entered — with the vendor application as the
  // fallback for a case that has not recorded one.
  const videoVerificationRequired = computed(
    () =>
      Boolean(record.value?.case?.videoVerificationRequired) ||
      Boolean(record.value?.application?.videoVerificationRequired)
  );

  const fields = computed(() =>
    getVerificationFields({
      videoVerificationRequired: videoVerificationRequired.value,
    })
  );

  const isDirty = computed(() => {
    const saved = record.value?.verification ?? emptyVerification();
    return (Object.keys(saved) as (keyof VerificationDetails)[]).some(
      (key) => (form[key] ?? "") !== (saved[key] ?? "")
    );
  });

  // Editable as soon as a case exists, application or not — entering the
  // identifier is precisely what the agent does when there is no application.
  // Without a case there is nowhere to store the answer.
  const canEdit = computed(() => hasCase.value && !loading.value);

  watch(() => toValue(ticketId), load, { immediate: true });

  return {
    record,
    caseName,
    hasCase,
    loading,
    saving,
    creating,
    error,
    saveError,
    isEmpty,
    isMock: isUsingMockData(),
    detailRows,
    form,
    fields,
    fieldErrors,
    isDirty,
    canEdit,
    videoVerificationRequired,
    reload: load,
    openCase,
    save,
    revert,
    setField,
  };
}

export type UseAccountOpening = ReturnType<typeof useAccountOpening>;
