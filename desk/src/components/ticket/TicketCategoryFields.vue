<template>
  <div class="flex flex-col gap-3 border-b px-6 py-3">
    <div class="flex flex-col gap-2">
      <span class="block text-sm font-medium text-gray-700">Category</span>
      <Link
        class="form-control"
        :model-value="ticket.custom_category"
        doctype="HD Category"
        :filters="categoryFilters"
        :disabled="!canEdit"
        placeholder="Select a category"
        @update:model-value="handleCategoryChange"
      />
    </div>
    <div class="flex flex-col gap-2">
      <span class="block text-sm font-medium text-gray-700">Sub Category</span>
      <Link
        class="form-control"
        :model-value="ticket.custom_sub_category"
        doctype="HD Category"
        :filters="subCategoryFilters"
        :disabled="!canEdit || !ticket.custom_category"
        :placeholder="subCategoryPlaceholder"
        @update:model-value="handleSubCategoryChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Link } from "@/components";
import { Ticket } from "@/types";
import { computed } from "vue";

interface Props {
  ticket: Ticket;
}

const props = defineProps<Props>();
const emit = defineEmits(["update"]);

// Only System Managers, Agent Managers and — on e-mail tickets — the agent the
// ticket was first assigned to may re-categorise. The server decides (see
// `helpdesk.api.category.can_change_category`) and says so on the ticket.
const canEdit = computed(() => Boolean(props.ticket.can_change_category));

// `Link` routes HD Category through the helpdesk category search, which reads
// these two filters: parents on their own, children of the picked parent.
const categoryFilters = { is_sub_category: 0 };

const subCategoryFilters = computed(() => ({
  is_sub_category: 1,
  parent_category: props.ticket.custom_category || "",
}));

const subCategoryPlaceholder = computed(() =>
  props.ticket.custom_category
    ? "Select a sub category"
    : "Select a category first"
);

function handleCategoryChange(value: string) {
  if (value === props.ticket.custom_category) return;
  emit("update", { field: "custom_category", value });
  // The sub category belongs to the category that was just replaced, so it
  // cannot stand. The server drops it too, this keeps the sidebar honest in
  // the meantime.
  if (props.ticket.custom_sub_category) {
    emit("update", { field: "custom_sub_category", value: "" });
  }
}

function handleSubCategoryChange(value: string) {
  emit("update", { field: "custom_sub_category", value });
}
</script>

<style scoped>
:deep(.form-control button) {
  border-color: transparent;
  background: white;
  gap: 0;
}

:deep(.form-control button > div) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
