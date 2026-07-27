
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

  const isEmpty = computed(
    () => !loading.value && !error.value && record.value === null
  );

  const detailRows = computed(() =>
    record.value ? toDetailRows(record.value.application) : []
  );

  // The compliance flag is decided by the server from the client's age; the
  // form only reflects it.
  const videoVerificationRequired = computed(() =>
    Boolean(record.value?.application.videoVerificationRequired)
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

  const canEdit = computed(() => Boolean(record.value) && !loading.value);

  watch(() => toValue(ticketId), load, { immediate: true });

  return {
    record,
    loading,
    saving,
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
    save,
    revert,
    setField,
  };
}

export type UseAccountOpening = ReturnType<typeof useAccountOpening>;
