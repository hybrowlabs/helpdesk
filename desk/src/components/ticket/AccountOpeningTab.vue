<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Sub-tab switcher: Details (read-only) / Form (editable) -->
    <div class="flex items-center justify-between gap-3 border-b px-6 py-3">
      <div class="flex items-center gap-2">
        <TabButtons v-if="hasCase" v-model="activeSubTab" :buttons="subTabs" />
        <Tooltip v-if="hasCase" :text="t('Account opening case')">
          <Badge variant="subtle" theme="blue" size="sm" :label="caseName" />
        </Tooltip>
        <!-- Only the Details sub-tab is dummy: the case and everything saved on
             it are real. Labelled accordingly so nobody reads the badge as
             "nothing here is saved". -->
        <Tooltip
          v-if="isMock"
          :text="t('The application shown on Details is dummy data — the vendor lookup is not configured yet. Everything you enter on Form is saved for real. Set VITE_ACCOUNT_OPENING_SOURCE=api once the vendor endpoint exists.')"
        >
          <Badge variant="subtle" theme="orange" size="sm" :label="t('Mock application')" />
        </Tooltip>
        <!-- Which unique identifier resolved this record upstream. -->
        <Tooltip v-if="identifierLabel" :text="t('The application was looked up with this identifier')">
          <Badge variant="subtle" theme="gray" size="sm" :label="identifierLabel" />
        </Tooltip>
      </div>

      <!-- The case's workflow state and Actions live in the ticket header, not
           here: two copies of the same control would drift out of sync. -->
      <div v-if="hasCase" class="flex items-center gap-2">
        <Tooltip :text="refreshTooltip">
          <!-- span keeps the tooltip alive while the button is disabled -->
          <span>
            <Button
              :label="t('Fetch')"
              :loading="loading"
              :disabled="refreshDisabled"
              @click="reload"
            >
              <template #prefix>
                <FeatherIcon name="refresh-cw" class="h-4 w-4" />
              </template>
            </Button>
          </span>
        </Tooltip>

        <template v-if="activeSubTab === 'form'">
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
        </template>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-4">
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

      <!-- No case opened against this ticket yet. The workflow runs on the case,
           so until one exists there is nothing to record against. -->
      <div
        v-else-if="!hasCase"
        class="flex flex-col items-center justify-center gap-2 py-16 text-center"
      >
        <FeatherIcon name="file-plus" class="h-6 w-6 text-gray-400" />
        <p class="text-base font-medium text-gray-800">
          {{ t("No account opening case yet") }}
        </p>
        <p class="max-w-md text-p-sm text-gray-600">
          {{
            t(
              "Open a case to record the client's details, the signature and call or video verification, and to drive the account opening workflow."
            )
          }}
        </p>
        <Button
          class="mt-2"
          :label="t('Open account opening case')"
          variant="solid"
          :loading="creating"
          @click="onOpenCase"
        />
      </div>

      <!-- Empty: only on Details. The Form tab stays available so the agent can
           enter the PAN / Client ID that will resolve an application. -->
      <div
        v-else-if="isEmpty && activeSubTab === 'details'"
        class="flex flex-col items-center justify-center gap-2 py-16 text-center"
      >
        <FeatherIcon name="file-text" class="h-6 w-6 text-gray-400" />
        <p class="text-base font-medium text-gray-800">
          {{ t("No account opening application") }}
        </p>
        <p class="max-w-md text-p-sm text-gray-600">
          {{
            t(
              "Enter the client's PAN Number on the Form tab, save, then press Fetch to load their application."
            )
          }}
        </p>
        <Button
          class="mt-2"
          :label="t('Go to Form')"
          variant="solid"
          @click="activeSubTab = 'form'"
        />
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
        <div
          v-if="isEmpty"
          class="flex items-start gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-2"
        >
          <FeatherIcon name="info" class="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <p class="text-p-sm text-blue-900">
            {{
              t(
                "No application is linked yet. Enter the PAN Number (or Client ID), press Save, then press Fetch."
              )
            }}
          </p>
        </div>

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

const emit = defineEmits<{ (e: "updated"): void }>();

const activeSubTab = ref<"details" | "form">("details");
const subTabs = computed(() => [
  { label: t("Details"), value: "details" },
  { label: t("Form"), value: "form" },
]);

const {
  record,
  caseName,
  hasCase,
  loading,
  saving,
  creating,
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
  openCase,
  save,
  revert,
  setField,
} = useAccountOpening(() => props.ticketId);

const identifierLabel = computed(() => {
  const identifier = record.value?.meta?.identifier;
  if (!identifier?.value) return "";

  const kind = identifier.kind === "pan" ? t("PAN") : t("Client ID");
  return `${kind} ${identifier.value}`;
});

// Refetching would silently throw away unsaved edits, so it waits.
const refreshDisabled = computed(() => loading.value || saving.value || isDirty.value);

const refreshTooltip = computed(() =>
  isDirty.value
    ? t("Save or discard your changes before refreshing")
    : t("Fetch the latest application details")
);

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

async function onOpenCase(): Promise<void> {
  if (await openCase()) {
    toast.success(t("Account opening case opened"));
    // The header's Actions menu is driven by the case name, which it resolves
    // independently — it has to be told the case now exists.
    emit("updated");
    activeSubTab.value = "form";
    return;
  }
  toast.error(saveError.value?.message || t("Could not open the account opening case"));
}

async function onSave(): Promise<void> {
  if (await save()) {
    toast.success(t("Verification details saved"));
    emit("updated");
    return;
  }

  if (Object.keys(fieldErrors.value).length) {
    toast.error(t("Please fix the highlighted fields"));
    return;
  }
  toast.error(saveError.value?.message || t("Could not save verification details"));
}
</script>
