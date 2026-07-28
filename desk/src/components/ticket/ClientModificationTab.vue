<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="flex items-center justify-between gap-3 border-b px-6 py-3">
      <div class="flex items-center gap-2">
        <TabButtons v-if="hasCase" v-model="activeSubTab" :buttons="subTabs" />
        <Tooltip v-if="hasCase" :text="t('Modification case')">
          <Badge variant="subtle" theme="blue" size="sm" :label="caseName" />
        </Tooltip>
        <Tooltip
          v-if="hasCase && !hasClient && !loading"
          :text="t('Enter the Trading Account Number on the Case tab and press Fetch')"
        >
          <Badge variant="subtle" theme="gray" size="sm" :label="t('Not fetched')" />
        </Tooltip>
      </div>

      <!-- The case's workflow state and Actions live in the ticket header,
           alongside Account Opening's — not repeated here. -->
      <div v-if="hasCase" class="flex items-center gap-2">
        <Tooltip :text="fetchTooltip">
          <span>
            <Button
              :label="t('Fetch')"
              :loading="fetching"
              :disabled="!form.tradingAccountNumber.trim() || saving"
              @click="onFetch"
            >
              <template #prefix>
                <FeatherIcon name="download-cloud" class="h-4 w-4" />
              </template>
            </Button>
          </span>
        </Tooltip>

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
        :aria-label="t('Loading modification case')"
      >
        <div v-for="n in 8" :key="n" class="flex flex-col gap-1.5 pb-2">
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
        <p class="text-base font-medium text-gray-800">{{ errorTitle }}</p>
        <p class="max-w-md text-p-sm text-gray-600">{{ error.message }}</p>
        <Button class="mt-2" :label="t('Try again')" @click="reload" />
      </div>

      <!-- No case opened against this ticket yet -->
      <div
        v-else-if="!hasCase"
        class="flex flex-col items-center justify-center gap-2 py-16 text-center"
      >
        <FeatherIcon name="file-plus" class="h-6 w-6 text-gray-400" />
        <p class="text-base font-medium text-gray-800">
          {{ t("No modification case yet") }}
        </p>
        <p class="max-w-md text-p-sm text-gray-600">
          {{
            t(
              "Open a case to record the modification request, its verification calls, and the Maker / Checker review."
            )
          }}
        </p>
        <Button
          class="mt-2"
          :label="t('Open modification case')"
          variant="solid"
          :loading="creating"
          @click="onOpenCase"
        />
      </div>

      <!-- Client: master data, read-only -->
      <template v-else-if="activeSubTab === 'client'">
        <div
          v-if="!hasClient"
          class="flex flex-col items-center justify-center gap-2 py-16 text-center"
        >
          <FeatherIcon name="user" class="h-6 w-6 text-gray-400" />
          <p class="text-base font-medium text-gray-800">
            {{ t("Client details not fetched yet") }}
          </p>
          <p class="max-w-md text-p-sm text-gray-600">
            {{
              t(
                "Enter the Trading Account Number on the Case tab and press Fetch to auto-fill the client's details."
              )
            }}
          </p>
          <Button
            class="mt-2"
            :label="t('Go to Case')"
            variant="solid"
            @click="activeSubTab = 'case'"
          />
        </div>

        <div v-else class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <div
            v-for="row in clientRows"
            :key="row.key"
            class="flex flex-col gap-0.5 border-b border-gray-100 pb-2"
          >
            <span class="text-xs text-gray-500">{{ row.label }}</span>
            <span class="text-base text-gray-800">{{ row.value }}</span>
          </div>
        </div>
      </template>

      <!-- Case: the editable CSS block -->
      <div v-else-if="activeSubTab === 'case'" class="flex flex-col gap-4">
        <div
          v-if="!form.signatureVerified"
          class="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2"
        >
          <FeatherIcon name="edit-3" class="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p class="text-p-sm text-amber-900">
            {{
              t(
                "Signature verification is the first mandatory step — the case cannot move to call verification until it is confirmed."
              )
            }}
          </p>
        </div>

        <div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <DynamicFormField
            v-for="field in cssFields"
            :key="field.fieldname"
            :field="field"
            :model-value="form[field.fieldname]"
            :error="fieldErrors[field.fieldname]"
            @update:model-value="(v) => setField(field.fieldname, v)"
          />
        </div>
      </div>

      <!-- Processing: Maker / Checker, mostly stamped -->
      <div v-else class="flex flex-col gap-5">
        <div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <div
            v-for="row in progressRows"
            :key="row.key"
            class="flex flex-col gap-0.5 border-b border-gray-100 pb-2"
          >
            <span class="text-xs text-gray-500">{{ row.label }}</span>
            <span class="text-base text-gray-800">{{ row.value }}</span>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-x-8 gap-y-4">
          <DynamicFormField
            v-for="field in accOpFields"
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
import { t } from "@/services/accountOpening";
import { useClientModification } from "@/services/clientModification";
import { Badge, Button, FeatherIcon, TabButtons, Tooltip, toast } from "frappe-ui";
import { computed, ref } from "vue";

const props = defineProps<{
  ticketId: string | number;
}>();

const emit = defineEmits<{ (e: "updated"): void }>();

const activeSubTab = ref<"client" | "case" | "processing">("case");
const subTabs = computed(() => [
  { label: t("Client"), value: "client" },
  { label: t("Case"), value: "case" },
  { label: t("Processing"), value: "processing" },
]);

const {
  caseName,
  hasCase,
  creating,
  form,
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
  reload,
  openCase,
  save,
  fetchMaster,
  setField,
  revert,
} = useClientModification(() => props.ticketId);

const errorTitle = computed(() => {
  switch (error.value?.code) {
    case "PERMISSION_DENIED":
      return t("You don't have access to this case");
    case "VALIDATION":
      return t("Not a modification case");
    default:
      return t("Could not load the modification case");
  }
});

const fetchTooltip = computed(() =>
  form.tradingAccountNumber.trim()
    ? t("Auto-fill the client's details from the master record")
    : t("Enter the Trading Account Number first")
);

async function onOpenCase(): Promise<void> {
  if (await openCase()) {
    toast.success(t("Modification case opened"));
    emit("updated");
    return;
  }
  toast.error(saveError.value?.message || t("Could not open the modification case"));
}

async function onFetch(): Promise<void> {
  if (await fetchMaster()) {
    toast.success(t("Client details fetched"));
    activeSubTab.value = "client";
    return;
  }

  // No client and no error means the lookup is simply not configured yet.
  toast.error(
    saveError.value?.message ||
      t("No client master record found for this trading account number")
  );
}

async function onSave(): Promise<void> {
  if (await save()) {
    toast.success(t("Modification case saved"));
    emit("updated");
    return;
  }

  if (Object.keys(fieldErrors.value).length) {
    toast.error(t("Please fix the highlighted fields"));
    return;
  }
  toast.error(saveError.value?.message || t("Could not save the modification case"));
}
</script>
