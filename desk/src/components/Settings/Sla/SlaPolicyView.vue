<template>
  <div v-if="slaData.loading" class="flex items-center h-full justify-center">
    <LoadingIndicator class="w-4" />
  </div>
  <div
    v-if="!slaData.loading"
    class="sticky top-0 z-10 bg-white px-10 pt-8 pb-6"
  >
    <div class="flex items-center justify-between w-full">
      <div>
        <div class="flex items-center gap-2">
          <Button
            variant="ghost"
            icon-left="chevron-left"
            :label="slaData.service_level || 'New SLA Policy'"
            size="md"
            @click="goBack()"
            class="cursor-pointer -ml-4 hover:bg-transparent focus:bg-transparent focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:none active:bg-transparent active:outline-none active:ring-0 active:ring-offset-0 active:text-ink-gray-5 font-semibold text-ink-gray-7 text-xl hover:opacity-70 !pr-0"
          />
          <Badge
            :variant="'subtle'"
            :theme="'orange'"
            size="sm"
            label="Unsaved changes"
            v-if="isDirty"
          />
        </div>
      </div>
      <div class="flex gap-4 items-center">
        <div
          class="flex items-center justify-between gap-2 cursor-pointer"
          @click="toggleEnabled"
        >
          <Switch size="sm" :model-value="slaData.enabled" />
          <span class="text-sm text-ink-gray-7 font-medium">Enabled</span>
        </div>
        <Button
          label="Save"
          theme="gray"
          variant="solid"
          @click="saveSla()"
          :disabled="Boolean(!isDirty && slaActiveScreen.data)"
          :loading="slaData.loading || slaPolicyList.setValue.loading"
        />
      </div>
    </div>
  </div>
  <div v-if="!slaData.loading" class="overflow-y-auto px-10 pb-10">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div>
        <FormControl
          :type="'text'"
          size="sm"
          variant="subtle"
          placeholder="Name"
          label="Name"
          v-model="slaData.service_level"
          required
          @change="validateSlaData('service_level')"
          :disabled="Boolean(slaActiveScreen.data)"
        />
        <ErrorMessage :message="slaDataErrors.service_level" class="mt-2" />
      </div>
      <FormControl
        :type="'textarea'"
        size="sm"
        variant="subtle"
        placeholder="Description"
        label="Description"
        v-model="slaData.description"
      />
    </div>
    <hr class="my-8" />
    <div>
      <div class="flex flex-col gap-1">
        <span class="text-lg font-semibold text-ink-gray-8"
          >Assignment conditions</span
        >
        <span class="text-p-sm text-ink-gray-6">
          Choose which tickets are affected by this policy.
        </span>
      </div>
      <div class="mt-3">
        <div class="flex items-center justify-between">
          <Checkbox
            label="Set as default SLA"
            :model-value="slaData.default_sla"
            @update:model-value="toggleDefaultSla"
            class="text-ink-gray-6 text-base font-medium"
          />
          <div v-if="isOldSla && slaActiveScreen.data && !slaData.default_sla">
            <Popover trigger="hover" hoverDelay="0.25" placement="top-end">
              <template #target>
                <div class="text-sm text-ink-gray-6 flex gap-1 cursor-default">
                  Old Conditions
                  <FeatherIcon name="info" class="size-4" />
                </div>
              </template>
              <template #body-main>
                <div
                  class="text-sm text-ink-gray-6 p-2 bg-white rounded-md max-w-96 text-wrap whitespace-pre-wrap leading-5"
                >
                  <code>{{ slaData.condition }}</code>
                </div>
              </template>
            </Popover>
          </div>
        </div>
        <div class="mt-5" v-if="!slaData.default_sla">
          <div
            class="flex flex-col gap-3 items-center text-center text-ink-gray-7 text-sm mb-2 border border-gray-300 rounded-md p-3 py-4"
            v-if="!useNewUI"
          >
            <span class="text-p-sm">
              Conditions for this SLA were created from
              <a :href="deskUrl" target="_blank" class="underline">desk</a>
              which are not compatible with this UI, you will need to recreate
              the conditions here if you want to manage and add new conditions
              from this UI.
            </span>
            <Button
              label="I understand, add conditions"
              variant="subtle"
              theme="gray"
              @click="useNewUI = true"
            />
          </div>
          <SlaAssignmentConditions
            :conditions="slaData.condition_json"
            v-if="useNewUI"
          />
        </div>
      </div>
    </div>
    <hr class="my-8" />
    <div>
      <div class="flex flex-col gap-1">
        <span class="text-lg font-semibold text-ink-gray-8">Valid from</span>
        <span class="text-p-sm text-ink-gray-6">
          Choose how long this SLA policy will be active.
        </span>
      </div>
      <div class="mt-3.5 flex gap-5 flex-col md:flex-row">
        <div class="w-full space-y-1.5">
          <FormLabel label="From date" for="from_date" />
          <DatePicker
            v-model="slaData.start_date"
            variant="subtle"
            placeholder="11/01/2025"
            class="w-full"
            id="from_date"
            @change="validateSlaData('start_date')"
            :formatter="(date) => getFormattedDate(date)"
          >
            <template #prefix>
              <LucideCalendar class="size-4" />
            </template>
          </DatePicker>
          <ErrorMessage :message="slaDataErrors.start_date" />
        </div>
        <div class="w-full space-y-1.5">
          <FormLabel label="To date" for="to_date" />
          <DatePicker
            v-model="slaData.end_date"
            variant="subtle"
            placeholder="25/12/2025"
            class="w-full"
            id="to_date"
            @change="validateSlaData('end_date')"
            :formatter="(date) => getFormattedDate(date)"
          >
            <template #prefix>
              <LucideCalendar class="size-4" />
            </template>
          </DatePicker>
          <ErrorMessage :message="slaDataErrors.end_date" />
        </div>
      </div>
    </div>
    <hr class="my-8" />
    <div>
      <div class="flex flex-col gap-1">
        <span class="text-lg font-semibold text-ink-gray-8"
          >Employee Hierarchy Assignment</span
        >
        <span class="text-p-sm text-ink-gray-6">
          Configure automatic assignment based on employee hierarchy
        </span>
      </div>
      <div class="mt-5 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Checkbox
            label="Assign to Direct Manager"
            :model-value="slaData.custom_assign_to_direct_manager"
            @update:model-value="(val) => slaData.custom_assign_to_direct_manager = val"
            class="text-ink-gray-6 text-base font-medium"
          />
          <Checkbox
            label="Assign to HOD"
            :model-value="slaData.custom_assign_to_hod"
            @update:model-value="(val) => slaData.custom_assign_to_hod = val"
            class="text-ink-gray-6 text-base font-medium"
          />
          <Checkbox
            label="Assign to HRBP"
            :model-value="slaData.custom_assign_to_hrbp"
            @update:model-value="(val) => slaData.custom_assign_to_hrbp = val"
            class="text-ink-gray-6 text-base font-medium"
          />
          <Checkbox
            label="Assign to Manager of Raiser"
            :model-value="slaData.custom_assign_to_manager_of_raiser"
            @update:model-value="(val) => slaData.custom_assign_to_manager_of_raiser = val"
            class="text-ink-gray-6 text-base font-medium"
          />
        </div>
        
        <div v-if="hasEmployeeAssignment" class="space-y-4 p-4 bg-gray-50 rounded-lg">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormControl
              type="select"
              size="sm"
              variant="subtle"
              label="Assignment Priority"
              v-model="slaData.custom_assignment_priority"
              :options="assignmentPriorityOptions"
              placeholder="Select priority"
            />
            <FormControl
              type="select"
              size="sm"
              variant="subtle"
              label="Fallback Team"
              v-model="slaData.custom_fallback_team"
              :options="teamOptions"
              placeholder="Select fallback team"
            />
          </div>
          <Checkbox
            label="Use Assignee's Holiday List"
            :model-value="slaData.custom_use_assignee_holiday_list"
            @update:model-value="(val) => slaData.custom_use_assignee_holiday_list = val"
            class="text-ink-gray-6 text-base font-medium"
          />
          <div class="text-p-sm text-ink-gray-5 italic">
            When enabled, SLA calculations will use the assigned employee's holiday list instead of the SLA holiday list.
          </div>
        </div>
        
        <div v-if="slaData.custom_auto_assign_team && hasEmployeeAssignment"
             class="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
          <span class="font-semibold">Note:</span> Both Employee Hierarchy and Team assignment are enabled. Employee Hierarchy will take priority.
        </div>
      </div>
    </div>

    <!-- Second Level Escalation Section -->
    <hr class="my-8" v-if="hasEmployeeAssignment" />
    <div v-if="hasEmployeeAssignment">
      <div class="flex flex-col gap-1">
        <span class="text-lg font-semibold text-ink-gray-8"
          >Second Level Escalation</span
        >
        <span class="text-p-sm text-ink-gray-6">
          Configure automatic escalation when first level doesn't resolve the ticket
        </span>
      </div>
      <div class="mt-5 space-y-4">
        <Checkbox
          label="Enable Second Level Escalation"
          :model-value="slaData.custom_second_level_escalation_enabled"
          @update:model-value="(val) => slaData.custom_second_level_escalation_enabled = val"
          class="text-ink-gray-6 text-base font-medium"
        />

        <div v-if="slaData.custom_second_level_escalation_enabled" class="space-y-4 p-4 bg-gray-50 rounded-lg">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormControl
              type="select"
              size="sm"
              variant="subtle"
              label="Escalate To"
              v-model="slaData.custom_second_level_escalation_target"
              :options="secondLevelTargetOptions"
              placeholder="Select escalation target"
            />
            <FormControl
              type="number"
              size="sm"
              variant="subtle"
              label="Delay (hours after first escalation)"
              v-model="slaData.custom_second_level_escalation_delay_hours"
              placeholder="24"
            />
          </div>

          <FormControl
            v-if="slaData.custom_second_level_escalation_target === 'Specific User'"
            type="link"
            size="sm"
            variant="subtle"
            label="Select User"
            v-model="slaData.custom_second_level_escalation_user"
            doctype="HD Agent"
            placeholder="Select a user"
          />

          <FormControl
            v-if="slaData.custom_second_level_escalation_target === 'Specific Team'"
            type="select"
            size="sm"
            variant="subtle"
            label="Select Team"
            v-model="slaData.custom_second_level_escalation_team"
            :options="teamOptions"
            placeholder="Select a team"
          />

          <div class="text-p-sm text-ink-gray-5 italic">
            After the specified delay, if the ticket is still open, it will be automatically escalated to the configured target.
          </div>
        </div>
      </div>
    </div>

    <hr class="my-8" />
    <div>
      <div class="flex flex-col gap-1">
        <span class="text-lg font-semibold text-ink-gray-8"
          >Team Assignment</span
        >
        <span class="text-p-sm text-ink-gray-6">
          Configure automatic team assignment for tickets
        </span>
      </div>
      <div class="mt-5">
        <FormControl
          type="select"
          size="sm"
          variant="subtle"
          label="Auto Assign Team"
          v-model="slaData.custom_auto_assign_team"
          :options="teamOptions"
          placeholder="Select a team"
        />
      </div>
    </div>
    <hr class="my-8" />
    <div>
      <div class="flex flex-col gap-1">
        <span class="text-lg font-semibold text-ink-gray-8"
          >Response and resolution</span
        >
        <span class="text-p-sm text-ink-gray-6">
          Add time targets around support milestones like first reply and
          resolution times
        </span>
      </div>
      <div class="mt-5">
        <!-- <div class="flex gap-6">
          <div
            class="flex items-center gap-2"
            @click="onApplySlaForChange(false)"
          >
            <input
              name="apply_sla_for"
              :checked="!slaData.apply_sla_for_resolution"
              type="radio"
            />
            <div class="select-none text-ink-gray-6 text-sm font-medium">
              Apply SLA for response time
            </div>
          </div>
          <div
            class="flex items-center gap-2"
            @click="onApplySlaForChange(true)"
          >
            <input
              name="apply_sla_for"
              :checked="slaData.apply_sla_for_resolution"
              type="radio"
            />
            <div class="select-none text-ink-gray-6 text-sm font-medium">
              Apply SLA for response time and resolution time
            </div>
          </div>
        </div> -->
        <div class="mt-5">
          <SlaPriorityList />
        </div>
      </div>
    </div>
    <hr class="my-8" />
    <div>
      <div class="flex flex-col gap-1">
        <span class="text-lg font-semibold text-ink-gray-8"
          >Status details</span
        >
        <span class="text-p-sm text-ink-gray-6">
          The SLA status updates with ticket progress—fulfilled when conditions
          are met, paused when awaiting external action.
        </span>
      </div>
      <div class="mt-5">
        <SlaStatusList :statusList="slaData.statuses" />
      </div>
    </div>
    <hr class="my-8" />
    <SlaHolidays />
  </div>
  <ConfirmDialog
    v-model="showConfirmDialog.show"
    :title="showConfirmDialog.title"
    :message="showConfirmDialog.message"
    :onConfirm="showConfirmDialog.onConfirm"
    :onCancel="() => (showConfirmDialog.show = false)"
  />
</template>

<script setup lang="ts">
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import {
  resetSlaDataErrors,
  slaActiveScreen,
  slaData,
  slaDataErrors,
  validateSlaData,
} from "@/stores/sla";
import { convertToConditions, getFormattedDate } from "@/utils";
import {
  Badge,
  Button,
  Checkbox,
  DatePicker,
  ErrorMessage,
  FormLabel,
  LoadingIndicator,
  Popover,
  Switch,
  toast,
} from "frappe-ui";
import { inject, nextTick, onMounted, onUnmounted, ref, watch, computed } from "vue";
import SlaAssignmentConditions from "./SlaAssignmentConditions.vue";
import SlaHolidays from "./SlaHolidays.vue";
import SlaPriorityList from "./SlaPriorityList.vue";
import SlaStatusList from "./SlaStatusList.vue";
import { disableSettingModalOutsideClick } from "../settingsModal";
import { useOnboarding } from "frappe-ui/frappe";
import { FormControl, createResource } from "frappe-ui";
import { getTeamsList } from "@/api/teams";

const { updateOnboardingStep } = useOnboarding("helpdesk");

const showConfirmDialog = ref({
  show: false,
  title: "",
  message: "",
  onConfirm: () => {},
});
const isDirty = ref(false);
const initialData = ref(null);

const useNewUI = ref(true);
const isOldSla = ref(false);

const slaPolicyList = inject<any>("slaPolicyList");
const deskUrl = `${window.location.origin}/app/hd-service-level-agreement/${slaActiveScreen.value.data?.name}`;

// Team options - will be fetched from API
const teamOptions = ref([]);

const assignmentPriorityOptions = [
  { label: "Direct Manager First", value: "Direct Manager First" },
  { label: "HOD First", value: "HOD First" },
  { label: "HRBP First", value: "HRBP First" },
  { label: "Round Robin", value: "Round Robin" },
];

const secondLevelTargetOptions = [
  { label: "Manager of Assignee", value: "Manager of Assignee" },
  { label: "Manager of HRBP", value: "Manager of HRBP" },
  { label: "Manager of HOD", value: "Manager of HOD" },
  { label: "Specific User", value: "Specific User" },
  { label: "Specific Team", value: "Specific Team" },
];

const hasEmployeeAssignment = computed(() => {
  return (
    slaData.value.custom_assign_to_direct_manager ||
    slaData.value.custom_assign_to_hod ||
    slaData.value.custom_assign_to_hrbp ||
    slaData.value.custom_assign_to_manager_of_raiser
  );
});

const getSlaData = createResource({
  url: "helpdesk.api.sla.get_sla",
  params: {
    docname: slaActiveScreen.value.data?.name,
  },
  onSuccess(data) {
    const fulfilledOn =
      data.sla_fulfilled_on?.map((item) => {
        return {
          ...item,
          sla_behavior: "Fulfilled",
        };
      }) || [];
    const pauseOn =
      data.pause_sla_on?.map((item) => {
        return {
          ...item,
          sla_behavior: "Paused",
        };
      }) || [];

    const condition_json = JSON.parse(data.condition_json || "[]");

    const newData = {
      ...data,
      statuses: [...pauseOn, ...fulfilledOn],
      loading: false,
      condition_json: condition_json,
      // Add custom fields with defaults
      custom_assign_to_direct_manager: data.custom_assign_to_direct_manager || false,
      custom_assign_to_hod: data.custom_assign_to_hod || false,
      custom_assign_to_hrbp: data.custom_assign_to_hrbp || false,
      custom_assign_to_manager_of_raiser: data.custom_assign_to_manager_of_raiser || false,
      custom_assignment_priority: data.custom_assignment_priority || "Direct Manager First",
      custom_fallback_team: data.custom_fallback_team || "",
      custom_use_assignee_holiday_list: data.custom_use_assignee_holiday_list || false,
      custom_auto_assign_team: data.custom_auto_assign_team || "",
      // Second level escalation fields
      custom_second_level_escalation_enabled: data.custom_second_level_escalation_enabled || false,
      custom_second_level_escalation_target: data.custom_second_level_escalation_target || "",
      custom_second_level_escalation_user: data.custom_second_level_escalation_user || "",
      custom_second_level_escalation_team: data.custom_second_level_escalation_team || "",
      custom_second_level_escalation_delay_hours: data.custom_second_level_escalation_delay_hours || 24,
    };
    slaData.value = newData;
    slaData.value.apply_sla_for_resolution = true;
    initialData.value = JSON.stringify(newData);
    const conditionsAvailable = slaData.value.condition?.length > 0;
    const conditionsJsonAvailable = slaData.value.condition_json?.length > 0;
    if (conditionsAvailable && !conditionsJsonAvailable) {
      useNewUI.value = false;
      isOldSla.value = true;
    } else {
      useNewUI.value = true;
      isOldSla.value = false;
    }
  },
});

if (slaActiveScreen.value.data && slaActiveScreen.value.fetchData) {
  slaData.value.loading = true;
  getSlaData.submit();
} else {
  disableSettingModalOutsideClick.value = true;
}

const goBack = () => {
  const confirmDialogInfo = {
    show: true,
    title: "Unsaved changes",
    message: "Are you sure you want to go back? Unsaved changes will be lost.",
    onConfirm: goBack,
  };
  if (isDirty.value && !showConfirmDialog.value.show) {
    showConfirmDialog.value = confirmDialogInfo;
    return;
  }
  if (!slaActiveScreen.value.data && !showConfirmDialog.value.show) {
    showConfirmDialog.value = confirmDialogInfo;
    return;
  }
  // Workaround fix for settings modal not closing after going back
  setTimeout(() => {
    slaActiveScreen.value = {
      screen: "list",
      data: null,
      fetchData: true,
    };
  }, 250);
  showConfirmDialog.value.show = false;
};

const checkDuplicateConditionResource = createResource({
  url: "helpdesk.api.sla.check_duplicate_sla_condition",
  onSuccess(result) {
    if (result?.exists) {
      showConfirmDialog.value = {
        show: true,
        title: "Duplicate SLA Condition",
        message:
          "SLA policy already exists for this condition. Check Day wise Time condition. At same time you cannot apply same condition.",
        onConfirm: () => {
          showConfirmDialog.value.show = false;
        },
      };
    } else {
      proceedWithSave();
    }
  },
});

const saveSla = async () => {
  await nextTick();

  const validationErrors = validateSlaData(undefined, !useNewUI.value);

  if (Object.values(validationErrors).some((error) => error)) {
    toast.error(
      "Invalid fields, check if all are filled in and values are correct."
    );
    return;
  }

  if (useNewUI.value && slaData.value.condition_json?.length > 0) {
    const schedulePayload = (slaData.value.support_and_resolution || []).map(
      ({ workday, start_time, end_time }) => ({ workday, start_time, end_time })
    );
    checkDuplicateConditionResource.submit({
      condition_json: JSON.stringify(slaData.value.condition_json),
      support_and_resolution: JSON.stringify(schedulePayload),
      exclude_name: slaActiveScreen.value.data?.name || null,
    });
    return;
  }

  proceedWithSave();
};

const proceedWithSave = () => {
  if (slaActiveScreen.value.data) {
    if (isOldSla.value && useNewUI.value) {
      showConfirmDialog.value = {
        show: true,
        title: "Confirm overwrite",
        message:
          "Your old conditions will be overwritten. Are you sure you want to save?",
        onConfirm: () => {
          updateSla();
          showConfirmDialog.value.show = false;
        },
      };
      return;
    }
    updateSla();
  } else {
    createSla();
  }
};

const createSla = () => {
  const fulfilledOn = slaData.value.statuses.filter(
    (status) => status.sla_behavior === "Fulfilled"
  );
  const pauseOn = slaData.value.statuses.filter(
    (status) => status.sla_behavior === "Paused"
  );
  slaPolicyList.insert.submit(
    {
      ...slaData.value,
      sla_fulfilled_on: fulfilledOn,
      pause_sla_on: pauseOn,
      condition: convertToConditions({
        conditions: slaData.value.condition_json,
        fieldPrefix: "doc",
      }),
      condition_json: JSON.stringify(slaData.value.condition_json),
    },
    {
      onSuccess(data) {
        toast.success("SLA policy created");
        slaActiveScreen.value.data = data;
        slaActiveScreen.value.screen = "view";
        getSlaData.submit({
          docname: data.name,
        });
        updateOnboardingStep("setup_sla", true);
      },
    }
  );
};

const updateSla = () => {
  const fulfilledOn = slaData.value.statuses.filter(
    (status) => status.sla_behavior === "Fulfilled"
  );
  const pauseOn = slaData.value.statuses.filter(
    (status) => status.sla_behavior === "Paused"
  );

  slaPolicyList.setValue.submit(
    {
      ...slaData.value,
      name: slaActiveScreen.value.data.name,
      sla_fulfilled_on: fulfilledOn,
      pause_sla_on: pauseOn,
      condition: useNewUI.value
        ? convertToConditions({
            conditions: slaData.value.condition_json,
            fieldPrefix: "doc",
          })
        : slaData.value.condition,
      condition_json: useNewUI.value
        ? JSON.stringify(slaData.value.condition_json)
        : null,
    },
    {
      onSuccess() {
        getSlaData.submit();
        toast.success("SLA policy updated");
        slaPolicyList.reload();
      },
    }
  );
};

const toggleEnabled = () => {
  if (slaData.value.default_sla) {
    toast.error("SLA set as default cannot be disabled");
    return;
  }
  slaData.value.enabled = !slaData.value.enabled;
};

const toggleDefaultSla = () => {
  slaData.value.default_sla = !slaData.value.default_sla;
  if (slaData.value.default_sla) {
    slaData.value.enabled = true;
  }
};

const onApplySlaForChange = (applyForResolution: boolean) => {
  slaData.value.apply_sla_for_resolution = applyForResolution;
  nextTick(() => {
    validateSlaData("priorities");
  });
};

watch(
  slaData,
  (newVal) => {
    if (!initialData.value) return;
    isDirty.value = JSON.stringify(newVal) != initialData.value;
    if (isDirty.value) {
      disableSettingModalOutsideClick.value = true;
    } else {
      disableSettingModalOutsideClick.value = false;
    }
  },
  { deep: true }
);

// Auto-populate assignment priority when hierarchy checkboxes are ticked
watch(
  () => slaData.value.custom_assign_to_direct_manager,
  (newVal, oldVal) => {
    if (newVal && !oldVal) {
      slaData.value.custom_assignment_priority = "Direct Manager First";
    }
  }
);

watch(
  () => slaData.value.custom_assign_to_hod,
  (newVal, oldVal) => {
    if (newVal && !oldVal) {
      slaData.value.custom_assignment_priority = "HOD First";
    }
  }
);

watch(
  () => slaData.value.custom_assign_to_hrbp,
  (newVal, oldVal) => {
    if (newVal && !oldVal) {
      slaData.value.custom_assignment_priority = "HRBP First";
    }
  }
);

const beforeUnloadHandler = (event) => {
  if (!isDirty.value) return;
  event.preventDefault();
  event.returnValue = true;
};

// Fetch teams resource
const teamsResource = createResource({
  url: "helpdesk.api.team.get_list",
  auto: true,
  onSuccess(data) {
    if (data && Array.isArray(data)) {
      teamOptions.value = data.map(team => ({
        label: typeof team === 'string' ? team : team.name,
        value: typeof team === 'string' ? team : team.name
      }));
    }
  }
});

onMounted(() => {
  addEventListener("beforeunload", beforeUnloadHandler);
  
  // Fetch teams if not already loaded
  if (!teamsResource.data && !teamsResource.loading) {
    teamsResource.fetch();
  }
});

onUnmounted(() => {
  removeEventListener("beforeunload", beforeUnloadHandler);
  resetSlaDataErrors();
  disableSettingModalOutsideClick.value = false;
});
</script>
<style scoped>
input[type="radio"] {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  border: 2px solid #c5c2c2;
  border-radius: 50%;
  outline: none;
  transition: all 0.2s ease;
  background-color: white;
}

input[type="radio"]:checked {
  background-color: black;
  border: 2px solid #000;
}

input[type="radio"]:checked::after {
  content: "";
  background-color: #fff;
}

input[type="radio"]:focus {
  outline: none !important;
  box-shadow: none !important;
}
</style>
