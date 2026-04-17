<template>
  <div class="flex flex-col h-full">
    <div
      v-if="loading"
      class="flex items-center h-full justify-center"
    >
      <LoadingIndicator class="w-4" />
    </div>
    <div
      v-if="!loading"
      class="flex items-center justify-between sticky top-0 z-10 bg-white px-10 pt-8 pb-4"
    >
      <div>
        <div class="flex items-center gap-2">
          <Button
            variant="ghost"
            icon-left="chevron-left"
            :label="holidayData.holiday_list_name || 'New Holiday List'"
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
      <div class="flex gap-2 items-center">
        <Button
          label="Save"
          theme="gray"
          variant="solid"
          @click="saveHoliday()"
          :disabled="Boolean(!isDirty && holidayListActiveScreen.data)"
          :loading="saveLoading"
        />
      </div>
    </div>

    <div v-if="!loading" class="px-10 pb-8 overflow-y-scroll h-full">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
        <div>
          <FormControl
            type="text"
            size="sm"
            variant="subtle"
            placeholder="Holiday List Name"
            label="Holiday List Name"
            v-model="holidayData.holiday_list_name"
            required
            @change="checkDirty"
          />
          <ErrorMessage
            :message="errors.holiday_list_name"
            class="mt-2"
          />
        </div>
        <div>
          <FormControl
            type="text"
            size="sm"
            variant="subtle"
            placeholder="Description"
            label="Description"
            v-model="holidayData.description"
            @change="checkDirty"
          />
        </div>
        <div>
          <label class="block text-sm text-gray-700 mb-1">From Date <span class="text-red-500">*</span></label>
          <DatePicker
            v-model="holidayData.from_date"
            variant="subtle"
            placeholder="Start date"
            class="w-full"
            @update:model-value="checkDirty"
          />
          <ErrorMessage
            :message="errors.from_date"
            class="mt-2"
          />
        </div>
        <div>
          <label class="block text-sm text-gray-700 mb-1">To Date <span class="text-red-500">*</span></label>
          <DatePicker
            v-model="holidayData.to_date"
            variant="subtle"
            placeholder="End date"
            class="w-full"
            @update:model-value="checkDirty"
          />
          <ErrorMessage
            :message="errors.to_date"
            class="mt-2"
          />
        </div>
      </div>

      <!-- Holidays table -->
      <div class="mt-8">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-medium text-gray-700">Holidays</h3>
          <Button
            label="Add Holiday"
            variant="subtle"
            size="sm"
            icon-left="plus"
            @click="addHoliday"
          />
        </div>
        <div v-if="holidayData.holidays.length === 0" class="text-sm text-gray-400 text-center py-6 border border-dashed rounded-lg">
          No holidays added yet.
        </div>
        <div v-else class="border rounded-lg overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="text-left px-3 py-2 text-gray-600 font-medium">Date</th>
                <th class="text-left px-3 py-2 text-gray-600 font-medium">Description</th>
                <th class="w-10"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(h, idx) in holidayData.holidays" :key="idx" class="border-t">
                <td class="px-3 py-2">
                  <DatePicker
                    v-model="h.holiday_date"
                    variant="subtle"
                    placeholder="Date"
                    class="w-full"
                    @update:model-value="checkDirty"
                  />
                </td>
                <td class="px-3 py-2">
                  <FormControl
                    type="text"
                    size="sm"
                    variant="subtle"
                    v-model="h.description"
                    placeholder="e.g. New Year"
                    @change="checkDirty"
                  />
                </td>
                <td class="px-3 py-2">
                  <Button
                    icon="x"
                    variant="ghost"
                    size="sm"
                    @click="removeHoliday(idx)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
  <ConfirmDialog
    v-model="showConfirmDialog"
    title="Unsaved changes"
    message="Are you sure you want to go back? Unsaved changes will be lost."
    :onConfirm="confirmGoBack"
    :onCancel="() => (showConfirmDialog = false)"
  />
</template>

<script setup lang="ts">
import {
  holidayListActiveScreen,
} from "@/stores/holidayList";
import {
  Button,
  createResource,
  DatePicker,
  FormControl,
  LoadingIndicator,
  toast,
  Badge,
  ErrorMessage
} from "frappe-ui";
import { inject, onMounted, onUnmounted, ref, reactive } from "vue";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import dayjs from "dayjs";

const isDirty = ref(false);
const initialData = ref(null);
const loading = ref(false);
const saveLoading = ref(false);
const showConfirmDialog = ref(false);

const holidayList = inject<any>("holidayList");

const holidayData = reactive({
  holiday_list_name: "",
  description: "",
  from_date: null as string | null,
  to_date: null as string | null,
  holidays: [] as { holiday_date: string; description: string; weekly_off: number }[],
});

const errors = reactive({
  holiday_list_name: "",
  from_date: "",
  to_date: ""
});

// Load holiday data if editing
if (holidayListActiveScreen.value.data?.name) {
  loading.value = true;
  createResource({
    url: "helpdesk.api.holidays.get_holiday_details",
    params: {
      holiday_name: holidayListActiveScreen.value.data.name,
    },
    onSuccess(data) {
      holidayData.holiday_list_name = data.holiday_list_name;
      holidayData.description = data.description || "";
      holidayData.from_date = data.from_date;
      holidayData.to_date = data.to_date;
      holidayData.holidays = (data.holidays || []).map((h: any) => ({
        holiday_date: h.holiday_date,
        description: h.description || "",
        weekly_off: h.weekly_off || 0,
      }));
      initialData.value = JSON.stringify(holidayData);
      loading.value = false;
    },
    auto: true
  });
} else {
  initialData.value = JSON.stringify(holidayData);
}

const checkDirty = () => {
  isDirty.value = JSON.stringify(holidayData) !== initialData.value;
};

const validate = () => {
  let isValid = true;
  errors.holiday_list_name = "";
  errors.from_date = "";
  errors.to_date = "";

  if (!holidayData.holiday_list_name?.trim()) {
    errors.holiday_list_name = "Holiday list name is required";
    isValid = false;
  }
  if (!holidayData.from_date) {
    errors.from_date = "From date is required";
    isValid = false;
  }
  if (!holidayData.to_date) {
    errors.to_date = "To date is required";
    isValid = false;
  }
  if (holidayData.from_date && holidayData.to_date) {
    if (new Date(holidayData.from_date) > new Date(holidayData.to_date)) {
      errors.to_date = "To date must be after from date";
      isValid = false;
    }
  }
  return isValid;
};

const addHoliday = () => {
  holidayData.holidays.push({
    holiday_date: "",
    description: "",
    weekly_off: 0,
  });
  checkDirty();
};

const removeHoliday = (idx: number) => {
  holidayData.holidays.splice(idx, 1);
  checkDirty();
};

const goBack = () => {
  if (isDirty.value) {
    showConfirmDialog.value = true;
    return;
  }
  confirmGoBack();
};

const confirmGoBack = () => {
  showConfirmDialog.value = false;
  holidayListActiveScreen.value = {
    screen: "list",
    data: null,
  };
};

const saveHoliday = () => {
  if (!validate()) {
    toast.error("Please fill in all required fields");
    return;
  }

  saveLoading.value = true;

  const payload = {
    holiday_list_name: holidayData.holiday_list_name,
    from_date: holidayData.from_date ? dayjs(holidayData.from_date).format("YYYY-MM-DD") : null,
    to_date: holidayData.to_date ? dayjs(holidayData.to_date).format("YYYY-MM-DD") : null,
    description: holidayData.description,
    holidays: holidayData.holidays
      .filter((h) => h.holiday_date)
      .map((h) => ({
        holiday_date: dayjs(h.holiday_date).format("YYYY-MM-DD"),
        description: h.description || "",
        weekly_off: h.weekly_off || 0,
      })),
  };

  if (holidayListActiveScreen.value.data) {
    createResource({
      url: "helpdesk.api.holidays.update_holiday",
      params: {
        holiday_name: holidayListActiveScreen.value.data.name,
        holiday_data: payload,
      },
      onSuccess() {
        toast.success("Holiday list updated");
        holidayList.reload();
        isDirty.value = false;
        initialData.value = JSON.stringify(holidayData);
        saveLoading.value = false;
        holidayListActiveScreen.value = { screen: "list", data: null };
      },
      onError(error) {
        toast.error(error.message || "Failed to update holiday list");
        saveLoading.value = false;
      },
      auto: true,
    });
  } else {
    createResource({
      url: "helpdesk.api.holidays.create_holiday",
      params: {
        holiday_data: payload,
      },
      onSuccess() {
        toast.success("Holiday list created");
        holidayList.reload();
        isDirty.value = false;
        saveLoading.value = false;
        holidayListActiveScreen.value = { screen: "list", data: null };
      },
      onError(error) {
        toast.error(error.message || "Failed to create holiday list");
        saveLoading.value = false;
      },
      auto: true,
    });
  }
};

const beforeUnloadHandler = (event) => {
  if (!isDirty.value) return;
  event.preventDefault();
  event.returnValue = "";
};

onMounted(() => window.addEventListener("beforeunload", beforeUnloadHandler));
onUnmounted(() => window.removeEventListener("beforeunload", beforeUnloadHandler));
</script>
