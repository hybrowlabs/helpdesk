<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Sub-tab switcher: Details (read-only) / Form (editable) -->
    <div class="flex items-center justify-between gap-3 border-b px-6 py-3">
      <div class="flex items-center gap-2">
        <TabButtons v-model="activeSubTab" :buttons="subTabs" />
        <Tooltip
          v-if="isMock"
          :text="t('Showing dummy data. Set VITE_ACCOUNT_OPENING_SOURCE=api to use the live service.')"
        >
          <Badge variant="subtle" theme="orange" size="sm" :label="t('Mock data')" />
        </Tooltip>
      </div>

      <div v-if="activeSubTab === 'form'" class="flex items-center gap-2">
        <Button
          v-if="isDirty"
          :label="t('Discard')"
          :disabled="saving"
          @click="revert"
        />
        <Button
          :label="t('Save')"
          variant="solid"
          :loading="saving"
          :disabled="!canEdit || !isDirty"
          @click="onSave"
        />
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-4">
      <!-- Loading -->
      <div
        v-if="loading"
        class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2"
        role="status"
        :aria-label="t('Loading account opening details')"
      >
        <div v-for="n in 10" :key="n" class="flex flex-col gap-1.5 pb-2">
          <div class="h-2.5 w-24 animate-pulse rounded bg-gray-200" />
          <div class="h-4 w-40 animate-pulse rounded bg-gray-100" />
        </div>
      </div>

      <!-- Error -->
      <div
        v-else-if="error"
        class="flex flex-col items-center justify-center gap-2 py-16 text-center"
      >
        <FeatherIcon name="alert-circle" class="h-6 w-6 text-red-500" />
        <p class="text-base font-medium text-gray-800">
          {{ errorTitle }}
        </p>
        <p class="max-w-md text-p-sm text-gray-600">
          {{ error.message }}
        </p>
        <Button class="mt-2" :label="t('Try again')" @click="reload" />
      </div>

      <!-- Empty -->
      <div
        v-else-if="isEmpty"
        class="flex flex-col items-center justify-center gap-2 py-16 text-center"
      >
        <FeatherIcon name="file-text" class="h-6 w-6 text-gray-400" />
        <p class="text-base font-medium text-gray-800">
          {{ t("No account opening application") }}
        </p>
        <p class="max-w-md text-p-sm text-gray-600">
          {{ t("This ticket is not linked to an account opening application yet.") }}
        </p>
        <Button class="mt-2" :label="t('Refresh')" @click="reload" />
      </div>

      <!-- Details: two-column read-only layout -->
      <div
        v-else-if="activeSubTab === 'details'"
        class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2"
      >
        <div
          v-for="row in detailRows"
          :key="row.key"
          class="flex flex-col gap-0.5 border-b border-gray-100 pb-2"
        >
          <span class="text-xs text-gray-500">{{ row.label }}</span>
          <span class="text-base text-gray-800">{{ row.value }}</span>
        </div>
      </div>

      <!-- Form: editable verification fields -->
      <div v-else class="flex flex-col gap-4">
        <!-- Compliance rule, stated where the agent has to act on it. -->
        <div
          v-if="videoVerificationRequired"
          class="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2"
        >
          <FeatherIcon name="video" class="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p class="text-p-sm text-amber-900">
            {{
              t(
                "This client is 70 or above, so video verification is required — a call alone is not enough."
              )
            }}
          </p>
        </div>

        <div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <DynamicFormField
            v-for="field in fields"
            :key="field.fieldname"
            :field="field"
            :model-value="form[field.fieldname]"
            :error="fieldErrors[field.fieldname]"
            @update:model-value="(v) => setField(field.fieldname, v)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import DynamicFormField from "@/components/ticket/DynamicFormField.vue";
import { t, useAccountOpening } from "@/services/accountOpening";
import { Badge, Button, FeatherIcon, TabButtons, Tooltip, toast } from "frappe-ui";
import { computed, ref } from "vue";

const props = defineProps<{
  ticketId: string | number;
}>();

const activeSubTab = ref<"details" | "form">("details");
const subTabs = computed(() => [
  { label: t("Details"), value: "details" },
  { label: t("Form"), value: "form" },
]);

const {
  loading,
  saving,
  error,
  saveError,
  isEmpty,
  isMock,
  detailRows,
  form,
  fields,
  fieldErrors,
  isDirty,
  canEdit,
  videoVerificationRequired,
  reload,
  save,
  revert,
  setField,
} = useAccountOpening(() => props.ticketId);

const errorTitle = computed(() => {
  switch (error.value?.code) {
    case "PERMISSION_DENIED":
      return t("You don't have access to this application");
    case "NOT_FOUND":
      return t("Application not found");
    default:
      return t("Could not load account opening details");
  }
});

async function onSave(): Promise<void> {
  if (await save()) {
    toast.success(t("Verification details saved"));
    return;
  }

  if (Object.keys(fieldErrors.value).length) {
    toast.error(t("Please fix the highlighted fields"));
    return;
  }
  toast.error(saveError.value?.message || t("Could not save verification details"));
}
</script>
