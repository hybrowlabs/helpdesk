<template>
  <div class="rounded-md border px-2 border-gray-300 text-sm">
    <div
      class="grid p-2 px-4 items-center"
      :style="{
        gridTemplateColumns,
      }"
      v-if="slaData.priorities?.length !== 0"
    >
      <div
        v-for="column in columns"
        :key="column.key"
        class="text-gray-600 overflow-hidden whitespace-nowrap text-ellipsis"
        :class="{
          'ml-2':
            column.key === 'response_time' ||
            column.key === 'resolution_time'
        }"
      >
        {{ column.label }}
        <span v-if="column.isRequired" class="text-red-500">*</span>
      </div>
    </div>
    <hr v-if="slaData.priorities?.length !== 0" />
    <SlaPriorityListItem
      v-for="(row, index) in slaData.priorities"
      :key="row.priority"
      :row="row"
      :columns="columns"
      :isLast="index === slaData.priorities.length - 1"
    />
    <div
      v-if="slaData.priorities?.length === 0"
      class="text-center p-4 text-gray-600"
    >
      No priorities in the list
    </div>
  </div>
  <div
    class="flex items-center justify-between mt-2.5"
    v-if="
      slaData.priorities.length !== priorityOptions.length ||
      slaDataErrors.default_priority ||
      slaDataErrors.priorities
    "
  >
    <!-- <div>
      <Button
        v-if="slaData.priorities.length !== priorityOptions.length"
        variant="subtle"
        label="Add row"
        @click="addRow"
        icon-left="plus"
      />
    </div> -->
    <ErrorMessage
      :message="slaDataErrors.default_priority || slaDataErrors.priorities"
    />
  </div>
</template>

<script setup lang="ts">
import { Button, createResource } from "frappe-ui";
import SlaPriorityListItem from "./SlaPriorityListItem.vue";
import { computed, provide, reactive } from "vue";
import {
  slaActiveScreen,
  slaData,
  slaDataErrors,
  validateSlaData,
} from "@/stores/sla";
import { watchDebounced } from "@vueuse/core";
import { getGridTemplateColumnsForTable } from "@/utils";

createResource({
  url: "frappe.client.get_list",
  params: {
    doctype: "HD Ticket Priority",
    fields: ["name"],
    order_by: "integer_value desc",
  },
  auto: true,
  onSuccess(data) {
    priorityOptions.push(
      ...data.map((p) => {
        return {
          label: p.name,
          value: p.name,
        };
      })
    );
    if (!slaActiveScreen.value.data) {
      slaData.value.priorities = [{
        priority: "Medium",
        resolution_time: 60 * 60,
        response_time: 60 * 60,
        default_priority: true
      }];
    }
  },
});

const priorityOptions = reactive([]);

provide("priorityOptions", priorityOptions);

const addRow = () => {
  slaData.value.priorities.push({
    priority: "Medium",
    resolution_time: 60 * 60,
    response_time: 60 * 60,
    default_priority: true
  });
};

const columns = computed(() => [
  {
    label: "First response time",
    key: "response_time",
    isRequired: true,
  },
  {
    label: "Resolution time",
    key: "resolution_time",
    isRequired: true,
  }
]);

const gridTemplateColumns = computed(() => {
  // return getGridTemplateColumnsForTable(columns.value.filter((c) => c));
  return getGridTemplateColumnsForTable(columns.value);
});

provide("gridTemplateColumns", gridTemplateColumns);

watchDebounced(
  () => [...slaData.value.priorities],
  () => {
    validateSlaData("priorities");
  },
  { deep: true, debounce: 300 }
);
</script>
