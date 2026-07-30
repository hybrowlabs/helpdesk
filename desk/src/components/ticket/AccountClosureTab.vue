<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="flex items-center justify-between gap-3 border-b px-6 py-3">
      <div class="flex items-center gap-2">
        <TabButtons v-if="hasCase" v-model="activeSubTab" :buttons="subTabs" />
        <Tooltip v-if="hasCase" :text="t('Closure case')">
          <Badge variant="subtle" theme="blue" size="sm" :label="caseName" />
        </Tooltip>
        <Tooltip v-if="hasCase && form.complianceRequired" :text="form.complianceRequiredReason">
          <Badge variant="subtle" theme="orange" size="sm" :label="t('Compliance required')" />
        </Tooltip>
        <Tooltip
          v-if="hasCase && !form.documentsValidated"
          :text="t('Every applicable document must be attached before the case can be forwarded')"
        >
          <Badge variant="subtle" theme="red" size="sm" :label="t('Documents incomplete')" />
        </Tooltip>
      </div>

      <!-- The case's workflow state and Actions live in the ticket header,
           alongside Account Opening's and Client Modification's — not here. -->
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

        <Tooltip :text="holdingsTooltip">
          <span>
            <Button
              :label="t('Holdings')"
              :loading="fetchingHoldings"
              :disabled="!holdingsLookupConfigured || saving"
              @click="onFetchHoldings"
            >
              <template #prefix>
                <FeatherIcon name="bar-chart-2" class="h-4 w-4" />
              </template>
            </Button>
          </span>
        </Tooltip>

        <Button v-if="isDirty" :label="t('Discard')" :disabled="saving" @click="revert" />
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
        :aria-label="t('Loading closure case')"
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
        <p class="text-base font-medium text-gray-800">{{ t("No closure case yet") }}</p>
        <p class="max-w-md text-p-sm text-gray-600">
          {{
            t(
              "One case covers the trading, NSDL and CDSL accounts together, whether shares are held or the holding is NIL."
            )
          }}
        </p>
        <Button
          class="mt-2"
          :label="t('Open closure case')"
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

      <!-- Case: intake, documents, signature -->
      <div v-else-if="activeSubTab === 'case'" class="flex flex-col gap-6">
        <div
          v-if="form.signatureVerificationStatus !== 'Verified'"
          class="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2"
        >
          <FeatherIcon name="edit-3" class="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p class="text-p-sm text-amber-900">
            {{
              t(
                "Signature verification is mandatory — the case cannot be entered in Tech+ Center until it is verified."
              )
            }}
          </p>
        </div>

        <div>
          <h3 class="mb-3 text-base font-medium text-gray-800">{{ t("Case Entry") }}</h3>
          <div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <DynamicFormField
              v-for="field in intakeFields"
              :key="field.fieldname"
              :field="scoped(field)"
              :model-value="form[field.fieldname]"
              :error="fieldErrors[field.fieldname]"
              @update:model-value="(v) => setField(field.fieldname, v)"
            />
          </div>
        </div>

        <div>
          <h3 class="mb-3 text-base font-medium text-gray-800">
            {{ t("Documents and Signature") }}
          </h3>
          <div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <DynamicFormField
              v-for="field in documentFields"
              :key="field.fieldname"
              :field="scoped(field)"
              :model-value="form[field.fieldname]"
              :error="fieldErrors[field.fieldname]"
              @update:model-value="(v) => setField(field.fieldname, v)"
            />
          </div>
        </div>
      </div>

      <!-- Phase 1: five departments, each owned by its own role -->
      <div v-else-if="activeSubTab === 'phase1'" class="flex flex-col gap-5">
        <div
          class="flex items-start gap-2 rounded border px-3 py-2"
          :class="
            form.departmentalConfirmationsComplete
              ? 'border-green-200 bg-green-50'
              : 'border-blue-200 bg-blue-50'
          "
        >
          <FeatherIcon
            :name="form.departmentalConfirmationsComplete ? 'check-circle' : 'users'"
            class="mt-0.5 h-4 w-4 shrink-0"
            :class="form.departmentalConfirmationsComplete ? 'text-green-600' : 'text-blue-600'"
          />
          <p
            class="text-p-sm"
            :class="form.departmentalConfirmationsComplete ? 'text-green-900' : 'text-blue-900'"
          >
            {{
              form.departmentalConfirmationsComplete
                ? t("All five departments have confirmed — the approval chain can begin.")
                : t(
                    "All five departments act in parallel. The approval chain does not begin until every one of them has confirmed."
                  )
            }}
          </p>
        </div>

        <div
          v-for="block in departmentBlocks"
          :key="block.key"
          class="rounded border border-gray-200 p-4"
        >
          <div class="mb-1 flex items-center justify-between gap-2">
            <h3 class="text-base font-medium text-gray-800">{{ block.label }}</h3>
            <div class="flex items-center gap-2">
              <Badge
                variant="subtle"
                size="sm"
                :theme="statusTheme(form[block.statusField])"
                :label="String(form[block.statusField] || 'Pending')"
              />
              <Badge
                v-if="!canWrite(block.statusField)"
                variant="subtle"
                theme="gray"
                size="sm"
                :label="t('Read only')"
              />
            </div>
          </div>
          <p class="mb-3 text-p-sm text-gray-600">{{ block.duty }}</p>

          <div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <DynamicFormField
              v-for="field in block.fields"
              :key="field.fieldname"
              :field="scoped(field, block.statusField)"
              :model-value="form[field.fieldname]"
              :error="fieldErrors[field.fieldname]"
              @update:model-value="(v) => setField(field.fieldname, v)"
            />
          </div>

          <p v-if="form[block.confirmedByField]" class="mt-3 text-xs text-gray-500">
            {{ confirmedLine(block) }}
          </p>
        </div>
      </div>

      <!-- Phase 2: the approval chain, mostly stamped -->
      <div v-else-if="activeSubTab === 'phase2'" class="flex flex-col gap-5">
        <div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <div
            v-for="row in phaseTwoRows"
            :key="row.key"
            class="flex flex-col gap-0.5 border-b border-gray-100 pb-2"
          >
            <span class="text-xs text-gray-500">{{ row.label }}</span>
            <span class="text-base text-gray-800">{{ row.value }}</span>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <DynamicFormField
            v-for="field in approvalFields"
            :key="field.fieldname"
            :field="scoped(field)"
            :model-value="form[field.fieldname]"
            :error="fieldErrors[field.fieldname]"
            @update:model-value="(v) => setField(field.fieldname, v)"
          />
        </div>

        <div v-if="isRejected" class="rounded border border-red-200 bg-red-50 p-4">
          <h3 class="mb-1 text-base font-medium text-red-900">{{ t("Rejection") }}</h3>
          <p class="mb-3 text-p-sm text-red-800">
            {{
              t(
                "The rejection email is sent manually by the team, with RM, CSS and IB in CC. Record here that it has gone out."
              )
            }}
          </p>
          <div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div
              v-for="row in rejectionRows"
              :key="row.key"
              class="flex flex-col gap-0.5 border-b border-red-100 pb-2"
            >
              <span class="text-xs text-red-700">{{ row.label }}</span>
              <span class="text-base text-red-900">{{ row.value }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Status: everything the workflow and the controller stamped -->
      <div v-else-if="activeSubTab === 'status'" class="flex flex-col gap-6">
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

        <div>
          <h3 class="mb-3 text-base font-medium text-gray-800">
            {{ t("Departmental Confirmations") }}
          </h3>
          <div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div
              v-for="row in phaseOneRows"
              :key="row.key"
              class="flex flex-col gap-0.5 border-b border-gray-100 pb-2"
            >
              <span class="text-xs text-gray-500">{{ row.label }}</span>
              <span class="text-base text-gray-800">{{ row.value }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Audit: FR-11.15 -->
      <div v-else class="flex flex-col gap-3">
        <div
          v-if="auditLoading"
          class="flex flex-col gap-2"
          role="status"
          :aria-label="t('Loading audit trail')"
        >
          <div v-for="n in 6" :key="n" class="h-9 animate-pulse rounded bg-gray-100" />
        </div>

        <div
          v-else-if="!auditTrail.length"
          class="flex flex-col items-center justify-center gap-2 py-16 text-center"
        >
          <FeatherIcon name="list" class="h-6 w-6 text-gray-400" />
          <p class="text-base font-medium text-gray-800">{{ t("No audit rows yet") }}</p>
          <p class="max-w-md text-p-sm text-gray-600">
            {{
              t(
                "Departmental actions, approvals and signature checks are recorded here as they happen."
              )
            }}
          </p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-p-sm">
            <thead class="border-b text-xs uppercase text-gray-500">
              <tr>
                <th class="py-2 pr-4">{{ t("When") }}</th>
                <th class="py-2 pr-4">{{ t("Type") }}</th>
                <th class="py-2 pr-4">{{ t("Action") }}</th>
                <th class="py-2 pr-4">{{ t("Change") }}</th>
                <th class="py-2">{{ t("User") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in auditTrail" :key="row.name" class="border-b border-gray-100">
                <td class="whitespace-nowrap py-2 pr-4 text-gray-600">
                  {{ formatDate(row.actionDate) }} {{ row.actionTime }}
                </td>
                <td class="whitespace-nowrap py-2 pr-4">{{ row.historyType }}</td>
                <td class="py-2 pr-4 text-gray-800">{{ row.action }}</td>
                <td class="whitespace-nowrap py-2 pr-4 text-gray-600">
                  {{ row.previousStatus || "—" }} → {{ row.newStatus || "—" }}
                </td>
                <td class="whitespace-nowrap py-2 text-gray-600">{{ row.user }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import DynamicFormField from "@/components/ticket/DynamicFormField.vue";
import { t } from "@/services/accountOpening";
import {
  useAccountClosure,
  type ClosureField,
  type DepartmentBlock,
} from "@/services/accountClosure";
import { formatDate } from "@/services/accountClosure/presenter";
import { Badge, Button, FeatherIcon, TabButtons, Tooltip, toast } from "frappe-ui";
import { computed, ref, watch } from "vue";

const props = defineProps<{
  ticketId: string | number;
}>();

const emit = defineEmits<{ (e: "updated"): void }>();

type SubTab = "client" | "case" | "phase1" | "phase2" | "status" | "audit";

const activeSubTab = ref<SubTab>("case");
const subTabs = computed(() => [
  { label: t("Client"), value: "client" },
  { label: t("Case"), value: "case" },
  { label: t("Phase 1"), value: "phase1" },
  { label: t("Phase 2"), value: "phase2" },
  { label: t("Status"), value: "status" },
  { label: t("Audit"), value: "audit" },
]);

const {
  caseName,
  hasCase,
  creating,
  form,
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
  reload,
  openCase,
  save,
  fetchMaster,
  loadHoldings,
  loadAuditTrail,
  setField,
  revert,
} = useAccountClosure(() => props.ticketId);

// The trail is only fetched when its tab is first opened, and refreshed after a
// save invalidates it.
watch(activeSubTab, (tab) => {
  if (tab === "audit") void loadAuditTrail();
});

/**
 * The server drops a field the caller's role does not own, so an enabled input
 * for one is worse than no input: it would take a value and silently discard it.
 * `ownershipKey` lets a whole departmental block follow its status field, which
 * is the field the role actually gates.
 */
function scoped(field: ClosureField, ownershipKey?: string) {
  return { ...field, readonly: !canWrite(ownershipKey ?? field.fieldname) };
}

function confirmedLine(block: DepartmentBlock): string {
  return t("Confirmed by {0} on {1}")
    .replace("{0}", String(form[block.confirmedByField] ?? ""))
    .replace("{1}", formatDate(form[block.confirmationDateField] as string | null));
}

function statusTheme(status: unknown): "green" | "red" | "orange" {
  switch (String(status || "")) {
    case "Confirmed":
    case "Approved":
      return "green";
    case "Rejected":
      return "red";
    default:
      return "orange";
  }
}

const errorTitle = computed(() => {
  switch (error.value?.code) {
    case "PERMISSION_DENIED":
      return t("You don't have access to this case");
    case "VALIDATION":
      return t("Not an account closure case");
    default:
      return t("Could not load the closure case");
  }
});

const fetchTooltip = computed(() =>
  form.tradingAccountNumber.trim()
    ? t("Auto-fill the client's details from the master record")
    : t("Enter the Trading Account Number first")
);

const holdingsTooltip = computed(() =>
  holdingsLookupConfigured.value
    ? t("Pull the debit balance and holding valuation from the back office")
    : t("No back-office source is configured in Account Closure Settings")
);

async function onOpenCase(): Promise<void> {
  if (await openCase()) {
    toast.success(t("Closure case opened"));
    emit("updated");
    return;
  }
  toast.error(saveError.value?.message || t("Could not open the closure case"));
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

async function onFetchHoldings(): Promise<void> {
  if (await loadHoldings()) {
    toast.success(t("Holdings and balances fetched"));
    activeSubTab.value = "status";
    return;
  }

  toast.error(saveError.value?.message || t("No holdings found for this case"));
}

async function onSave(): Promise<void> {
  if (await save()) {
    toast.success(t("Closure case saved"));
    if (activeSubTab.value === "audit") void loadAuditTrail(true);
    emit("updated");
    return;
  }

  if (Object.keys(fieldErrors.value).length) {
    toast.error(t("Please fix the highlighted fields"));
    return;
  }
  toast.error(saveError.value?.message || t("Could not save the closure case"));
}
</script>
