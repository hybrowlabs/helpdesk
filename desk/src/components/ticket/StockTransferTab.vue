<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="flex items-center justify-between gap-3 border-b px-6 py-3">
      <div class="flex items-center gap-2">
        <TabButtons v-if="hasCase" v-model="activeSubTab" :buttons="subTabs" />
        <Tooltip v-if="hasCase" :text="t('Stock transfer case')">
          <Badge variant="subtle" theme="blue" size="sm" :label="caseName" />
        </Tooltip>
        <Tooltip
          v-if="hasCase && usingPlaceholderData"
          :text="
            t(
              'The client master and holdings came from placeholder data, not the client\'s systems.'
            )
          "
        >
          <Badge variant="subtle" theme="orange" size="sm" :label="t('Placeholder data')" />
        </Tooltip>
        <Tooltip
          v-if="hasCase && !hasClient && !loading"
          :text="t('Enter the Trading Account Number on the Request tab and press Fetch')"
        >
          <Badge variant="subtle" theme="gray" size="sm" :label="t('Not fetched')" />
        </Tooltip>
      </div>

      <!-- The case's workflow state and Actions live in the ticket header,
           alongside the other flows' — not repeated here. -->
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
        :aria-label="t('Loading stock transfer case')"
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
          {{ t("No stock transfer case yet") }}
        </p>
        <p class="max-w-md text-p-sm text-gray-600">
          {{
            t(
              "Open a case to record the transfer instruction, the securities moving, the client confirmation and the depository execution."
            )
          }}
        </p>
        <Button
          class="mt-2"
          :label="t('Open stock transfer case')"
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
                "Enter the Trading Account Number on the Request tab and press Fetch to auto-fill the client's details."
              )
            }}
          </p>
          <Button
            class="mt-2"
            :label="t('Go to Request')"
            variant="solid"
            @click="activeSubTab = 'request'"
          />
        </div>

        <div v-else class="flex flex-col gap-4">
          <div
            v-if="usingPlaceholderData"
            class="flex items-start gap-2 rounded border border-orange-200 bg-orange-50 px-3 py-2"
          >
            <FeatherIcon name="alert-triangle" class="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
            <p class="text-p-sm text-orange-900">
              {{
                t(
                  "This is placeholder data, not the client's records. It will be replaced once the client's lookup endpoint is available."
                )
              }}
            </p>
          </div>

          <div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div
              v-for="row in clientRows"
              :key="row.key"
              class="flex flex-col gap-0.5 border-b border-gray-100 pb-2"
            >
              <span class="text-xs text-gray-500">{{ row.label }}</span>
              <span class="text-base text-gray-800">{{ row.value }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Request: the transfer instruction and where it is going -->
      <div v-else-if="activeSubTab === 'request'" class="flex flex-col gap-5">
        <div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <DynamicFormField
            v-for="field in requestFields"
            :key="field.fieldname"
            :field="field"
            :model-value="form[field.fieldname]"
            :error="fieldErrors[field.fieldname]"
            @update:model-value="(v) => setField(field.fieldname, v)"
          />
        </div>

        <div class="border-t pt-4">
          <p class="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
            {{ t("Target Account") }}
          </p>
          <div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <DynamicFormField
              v-for="field in targetFields"
              :key="field.fieldname"
              :field="field"
              :model-value="form[field.fieldname]"
              :error="fieldErrors[field.fieldname]"
              @update:model-value="(v) => setField(field.fieldname, v)"
            />
          </div>
        </div>
      </div>

      <!-- Securities: the grid, plus the compliance rule it drives -->
      <div v-else-if="activeSubTab === 'securities'" class="flex flex-col gap-4">
        <div
          v-if="form.complianceRequired"
          class="flex items-start gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-2"
        >
          <FeatherIcon name="shield" class="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <div class="text-p-sm text-blue-900">
            <p class="font-medium">{{ t("This case needs a compliance review") }}</p>
            <p v-for="reason in complianceReasons" :key="reason">{{ reason }}</p>
          </div>
        </div>

        <div class="flex items-center justify-between gap-3">
          <div class="flex items-baseline gap-4 text-p-sm text-gray-600">
            <span>
              {{ t("Total quantity") }}:
              <span class="font-medium text-gray-800">{{ formatNumber(draftQuantity) }}</span>
            </span>
            <span>
              {{ t("Total value") }}:
              <span class="font-medium text-gray-800">{{ formatNumber(draftValue) }}</span>
            </span>
          </div>
          <div class="flex items-center gap-2">
            <Button
              :label="t('Fetch holdings')"
              :loading="fetchingSecurities"
              :disabled="!form.dematAccountNumber.trim() || saving"
              @click="onFetchSecurities"
            >
              <template #prefix>
                <FeatherIcon name="download-cloud" class="h-4 w-4" />
              </template>
            </Button>
            <Button :label="t('Add line')" :disabled="saving" @click="addSecurity">
              <template #prefix>
                <FeatherIcon name="plus" class="h-4 w-4" />
              </template>
            </Button>
          </div>
        </div>

        <div
          v-if="!securities.length"
          class="flex flex-col items-center justify-center gap-2 rounded border border-dashed py-12 text-center"
        >
          <FeatherIcon name="layers" class="h-6 w-6 text-gray-400" />
          <p class="text-base font-medium text-gray-800">{{ t("No securities yet") }}</p>
          <p class="max-w-md text-p-sm text-gray-600">
            {{
              t(
                "Fetch the holdings for the demat account, or add each line by hand. The transfer cannot be confirmed with the client until at least one line is recorded."
              )
            }}
          </p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[720px] text-left text-base">
            <thead>
              <tr class="border-b text-xs uppercase tracking-wide text-gray-500">
                <th class="py-2 pr-3 font-medium">{{ t("ISIN") }}</th>
                <th class="py-2 pr-3 font-medium">{{ t("Security") }}</th>
                <th class="py-2 pr-3 text-right font-medium">{{ t("Quantity") }}</th>
                <th class="py-2 pr-3 text-right font-medium">{{ t("Market Value") }}</th>
                <th class="w-10 py-2" />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, index) in securities"
                :key="row.name || `new-${index}`"
                class="border-b border-gray-100 align-top"
              >
                <td class="py-2 pr-3">
                  <input
                    :value="row.isin"
                    class="w-36 rounded border border-gray-300 px-2 py-1 text-base uppercase focus:border-gray-500 focus:outline-none"
                    :class="{ 'border-red-400': securityErrors[index] }"
                    :placeholder="t('INE002A01018')"
                    @input="
                      (e) =>
                        setSecurityField(index, 'isin', (e.target as HTMLInputElement).value)
                    "
                  />
                  <p v-if="securityErrors[index]" class="mt-1 text-xs text-red-600">
                    {{ securityErrors[index] }}
                  </p>
                </td>
                <td class="py-2 pr-3">
                  <input
                    :value="row.securityName"
                    class="w-full rounded border border-gray-300 px-2 py-1 text-base focus:border-gray-500 focus:outline-none"
                    @input="
                      (e) =>
                        setSecurityField(
                          index,
                          'securityName',
                          (e.target as HTMLInputElement).value
                        )
                    "
                  />
                </td>
                <td class="py-2 pr-3">
                  <input
                    :value="row.quantity"
                    type="number"
                    min="0"
                    step="any"
                    class="w-28 rounded border border-gray-300 px-2 py-1 text-right text-base focus:border-gray-500 focus:outline-none"
                    @input="
                      (e) =>
                        setSecurityField(index, 'quantity', (e.target as HTMLInputElement).value)
                    "
                  />
                </td>
                <td class="py-2 pr-3">
                  <input
                    :value="row.marketValue"
                    type="number"
                    min="0"
                    step="any"
                    class="w-32 rounded border border-gray-300 px-2 py-1 text-right text-base focus:border-gray-500 focus:outline-none"
                    @input="
                      (e) =>
                        setSecurityField(
                          index,
                          'marketValue',
                          (e.target as HTMLInputElement).value
                        )
                    "
                  />
                </td>
                <td class="py-2">
                  <Button
                    variant="ghost"
                    :aria-label="t('Remove line')"
                    :disabled="saving"
                    @click="removeSecurity(index)"
                  >
                    <template #icon>
                      <FeatherIcon name="trash-2" class="h-4 w-4 text-gray-500" />
                    </template>
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Verification: DIS paperwork, signature, confirmation call -->
      <div v-else-if="activeSubTab === 'verification'" class="flex flex-col gap-5">
        <div
          v-if="form.signatureVerificationStatus !== 'Verified'"
          class="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2"
        >
          <FeatherIcon name="edit-3" class="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p class="text-p-sm text-amber-900">
            {{
              t(
                "Signature verification is the first mandatory step — the client cannot be called until the signature on the DIS is confirmed."
              )
            }}
          </p>
        </div>

        <div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <DynamicFormField
            v-for="field in documentFields"
            :key="field.fieldname"
            :field="field"
            :model-value="form[field.fieldname]"
            :error="fieldErrors[field.fieldname]"
            @update:model-value="(v) => setField(field.fieldname, v)"
          />
        </div>

        <div class="border-t pt-4">
          <p class="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
            {{ t("Client Confirmation") }}
          </p>
          <div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <DynamicFormField
              v-for="field in confirmationFields"
              :key="field.fieldname"
              :field="field"
              :model-value="form[field.fieldname]"
              :error="fieldErrors[field.fieldname]"
              @update:model-value="(v) => setField(field.fieldname, v)"
            />
          </div>
        </div>
      </div>

      <!-- Processing: compliance, execution, outcome -->
      <div v-else class="flex flex-col gap-5">
        <div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <div
            v-for="row in statusRows"
            :key="row.key"
            class="flex flex-col gap-0.5 border-b border-gray-100 pb-2"
          >
            <span class="text-xs text-gray-500">{{ row.label }}</span>
            <span class="text-base text-gray-800">{{ row.value }}</span>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <DynamicFormField
            v-for="field in processingFields"
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
import { formatNumber, useStockTransfer } from "@/services/stockTransfer";
import { Badge, Button, FeatherIcon, TabButtons, Tooltip, toast } from "frappe-ui";
import { computed, ref } from "vue";

const props = defineProps<{
  ticketId: string | number;
}>();

const emit = defineEmits<{ (e: "updated"): void }>();

const activeSubTab = ref<
  "client" | "request" | "securities" | "verification" | "processing"
>("request");
const subTabs = computed(() => [
  { label: t("Client"), value: "client" },
  { label: t("Request"), value: "request" },
  { label: t("Securities"), value: "securities" },
  { label: t("Verification"), value: "verification" },
  { label: t("Processing"), value: "processing" },
]);

const {
  caseName,
  hasCase,
  creating,
  form,
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
  reload,
  openCase,
  save,
  fetchMaster,
  loadSecurities,
  setField,
  addSecurity,
  removeSecurity,
  setSecurityField,
  revert,
} = useStockTransfer(() => props.ticketId);

const errorTitle = computed(() => {
  switch (error.value?.code) {
    case "PERMISSION_DENIED":
      return t("You don't have access to this case");
    case "VALIDATION":
      return t("Not a stock transfer case");
    default:
      return t("Could not load the stock transfer case");
  }
});

const fetchTooltip = computed(() =>
  form.tradingAccountNumber.trim()
    ? t("Auto-fill the client's details from the master record")
    : t("Enter the Trading Account Number first")
);

const complianceReasons = computed(() =>
  form.complianceRequiredReason.split("\n").filter(Boolean)
);

async function onOpenCase(): Promise<void> {
  if (await openCase()) {
    toast.success(t("Stock transfer case opened"));
    emit("updated");
    return;
  }
  toast.error(saveError.value?.message || t("Could not open the stock transfer case"));
}

async function onFetch(): Promise<void> {
  if (await fetchMaster()) {
    toast.success(t("Client details fetched"));
    activeSubTab.value = "client";
    return;
  }

  toast.error(
    saveError.value?.message ||
      t("No client master record found for this trading account number")
  );
}

async function onFetchSecurities(): Promise<void> {
  // The fetch replaces the grid, so unsaved lines would be lost silently.
  if (securities.value.length && !window.confirm(t("Replace the securities listed below?"))) {
    return;
  }

  if (await loadSecurities()) {
    toast.success(t("Holdings fetched"));
    emit("updated");
    return;
  }

  toast.error(
    saveError.value?.message || t("No holdings found for this demat account number")
  );
}

async function onSave(): Promise<void> {
  if (await save()) {
    toast.success(t("Stock transfer case saved"));
    emit("updated");
    return;
  }

  if (
    Object.keys(fieldErrors.value).length ||
    Object.keys(securityErrors.value).length
  ) {
    toast.error(t("Please fix the highlighted fields"));
    return;
  }
  toast.error(saveError.value?.message || t("Could not save the stock transfer case"));
}
</script>
