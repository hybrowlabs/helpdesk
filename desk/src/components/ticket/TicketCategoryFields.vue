<template>
  <div class="flex flex-col gap-3 border-b px-6 py-3">
    <div class="flex flex-col gap-2">
      <span class="block text-sm text-ink-gray-5">Category</span>
      <Link
        class="form-control"
        :model-value="draftCategory"
        doctype="HD Category"
        :filters="categoryFilters"
        :disabled="!canEdit"
        placeholder="Select a category"
        @update:model-value="handleCategoryChange"
      />
    </div>
    <div class="flex flex-col gap-2">
      <span class="block text-sm text-ink-gray-5">Sub Category</span>
      <Link
        class="form-control"
        :model-value="draftSubCategory"
        doctype="HD Category"
        :filters="subCategoryFilters"
        :disabled="!canEdit || !draftCategory"
        :placeholder="subCategoryPlaceholder"
        @update:model-value="handleSubCategoryChange"
      />
    </div>
    <!-- Nothing is written until Save is pressed, so the row only shows up
         once there is something to save. -->
    <div v-if="isDirty" class="flex items-center justify-end gap-2">
      <Button label="Cancel" @click="resetDraft" />
      <Button label="Save" variant="solid" @click="showConfirmDialog = true" />
    </div>

    <Dialog
      v-model="showConfirmDialog"
      :options="{ title: 'Change category' }"
    >
      <template #body-content>
        <p class="text-p-base font-medium text-gray-800">
          Are you sure you want to change the category for this ticket?
        </p>
        <p class="mt-2 text-p-base text-gray-700">
          This will also change the assignee linked to the new category, and
          this ticket will be reassigned accordingly.
        </p>
        <div class="mt-3 flex flex-col gap-1 text-p-sm text-gray-600">
          <span>Category: {{ draftCategory || "—" }}</span>
          <span>Sub Category: {{ draftSubCategory || "—" }}</span>
        </div>
      </template>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="No" @click="showConfirmDialog = false" />
          <Button label="Yes" variant="solid" @click="confirmSave" />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { Link } from "@/components";
import { Ticket } from "@/types";
import { computed, ref, watch } from "vue";

interface Props {
  ticket: Ticket;
}

const props = defineProps<Props>();
const emit = defineEmits(["update-fields"]);

// Only System Managers, Agent Managers and — on e-mail tickets — the agent the
// ticket was first assigned to may re-categorise. The server decides (see
// `helpdesk.api.category.can_change_category`) and says so on the ticket.
const canEdit = computed(() => Boolean(props.ticket.can_change_category));

// Picking a category no longer writes to the ticket: the pair is staged here
// and only sent once the agent confirms the Save.
const draftCategory = ref(props.ticket.custom_category || "");
const draftSubCategory = ref(props.ticket.custom_sub_category || "");
const showConfirmDialog = ref(false);

// Re-sync when the ticket itself changes — a save of ours landing, or someone
// else re-categorising. Every sidebar field reloads the ticket after it saves,
// which hands us a brand new ticket object, so compare the values themselves:
// a reload that brings back the same pair must not wipe a staged edit.
watch(
  () => [props.ticket.custom_category, props.ticket.custom_sub_category],
  ([category, subCategory], [prevCategory, prevSubCategory] = []) => {
    if (category === prevCategory && subCategory === prevSubCategory) return;
    draftCategory.value = category || "";
    draftSubCategory.value = subCategory || "";
    showConfirmDialog.value = false;
  }
);

const isDirty = computed(
  () =>
    canEdit.value &&
    (draftCategory.value !== (props.ticket.custom_category || "") ||
      draftSubCategory.value !== (props.ticket.custom_sub_category || ""))
);

// `Link` routes HD Category through the helpdesk category search, which reads
// these two filters: parents on their own, children of the picked parent.
const categoryFilters = { is_sub_category: 0 };

// The staged category, not the saved one — the sub category list has to follow
// what is currently in the picker above.
const subCategoryFilters = computed(() => ({
  is_sub_category: 1,
  parent_category: draftCategory.value || "",
}));

const subCategoryPlaceholder = computed(() =>
  draftCategory.value ? "Select a sub category" : "Select a category first"
);

function handleCategoryChange(value: string) {
  if (value === draftCategory.value) return;
  draftCategory.value = value;
  // The sub category belongs to the category that was just replaced, so it
  // cannot stand. The server drops it too, this keeps the sidebar honest in
  // the meantime.
  draftSubCategory.value = "";
}

function handleSubCategoryChange(value: string) {
  draftSubCategory.value = value;
}

function resetDraft() {
  draftCategory.value = props.ticket.custom_category || "";
  draftSubCategory.value = props.ticket.custom_sub_category || "";
}

function confirmSave() {
  showConfirmDialog.value = false;
  if (!isDirty.value) return;
  // Both fields go in one write: the server validates the pair together
  // (`validate_category_hierarchy`), so saving them one at a time would trip
  // over the half-updated ticket.
  emit("update-fields", {
    custom_category: draftCategory.value,
    custom_sub_category: draftSubCategory.value,
  });
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
