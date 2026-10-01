<template>
  <div v-if="field.fieldtype === 'Check'" class="flex items-center gap-2 py-1">
    <FormControl
      type="checkbox"
      :label="field.label"
      :modelValue="Boolean(Number(modelValue))"
      :disabled="disabled"
      @update:modelValue="(v: boolean) => emit('update:modelValue', v ? 1 : 0)"
    />
  </div>
  <div v-else class="flex flex-col gap-1">
    <FormLabel :label="field.label" :required="required" />
    <SearchComplete
      v-if="field.fieldtype === 'Link'"
      :key="String(modelValue)"
      :doctype="field.options"
      :value="String(modelValue || '')"
      :labelField="field.title_field || 'name'"
      :disabled="disabled"
      @change="(o: any) => emit('update:modelValue', o?.value || '')"
    />
    <div v-else-if="isMultiLink" class="flex flex-col gap-1.5">
      <SearchMultiSelect
        :options="linkOptions"
        :modelValue="selectedValues"
        :placeholder="__('Select {0}', [field.label])"
        @update:modelValue="(v: string[]) => emit('update:modelValue', v)"
      />
      <!-- The picker only reports a count; list the actual selections. -->
      <div v-if="selectedValues.length" class="flex flex-wrap gap-1.5">
        <Button
          v-for="v in selectedValues"
          :key="v"
          :label="v"
          size="sm"
          variant="subtle"
          :disabled="disabled"
          @click="removeValue(v)"
        >
          <template #suffix>
            <LucideX v-if="!disabled" class="h-3 w-3" />
          </template>
        </Button>
      </div>
    </div>
    <FileUploader
      v-else-if="field.fieldtype === 'Attach'"
      @success="(file: any) => emit('update:modelValue', file.file_url)"
    >
      <template v-slot="{ progress, uploading, openFileSelector }">
        <!-- Attached: show the file as a removable row, not a bare link. -->
        <div
          v-if="modelValue && !uploading"
          class="flex items-center gap-2 rounded border border-outline-gray-2 bg-surface-gray-1 px-2 py-1.5"
        >
          <LucidePaperclip class="h-4 w-4 shrink-0 text-ink-gray-5" />
          <a
            :href="String(modelValue)"
            target="_blank"
            class="flex-1 truncate text-sm text-ink-gray-8 hover:underline"
          >
            {{ String(modelValue).split("/").pop() }}
          </a>
          <Button
            v-if="!disabled"
            variant="ghost"
            size="sm"
            :label="__('Replace')"
            @click="openFileSelector"
          />
          <Button
            v-if="!disabled"
            variant="ghost"
            size="sm"
            :tooltip="__('Remove')"
            @click="emit('update:modelValue', '')"
          >
            <template #icon>
              <LucideX class="h-4 w-4 text-ink-gray-6" />
            </template>
          </Button>
        </div>
        <Button
          v-else
          :label="uploading ? __('Uploading {0}%', [progress]) : __('Upload')"
          :loading="uploading"
          :disabled="disabled"
          @click="openFileSelector"
        >
          <template #prefix>
            <LucideUpload class="h-4 w-4" />
          </template>
        </Button>
      </template>
    </FileUploader>
    <FormControl
      v-else-if="field.fieldtype === 'Select'"
      type="select"
      :options="selectOptions"
      :modelValue="modelValue"
      :disabled="disabled"
      @update:modelValue="(v: string) => emit('update:modelValue', v)"
    />
    <FormControl
      v-else-if="field.fieldtype === 'Date'"
      type="date"
      :modelValue="modelValue"
      :disabled="disabled"
      @update:modelValue="(v: string) => emit('update:modelValue', v)"
    />
    <FormControl
      v-else-if="field.fieldtype === 'Time'"
      type="time"
      :modelValue="timeValue"
      :disabled="disabled"
      @update:modelValue="(v: string) => emit('update:modelValue', v)"
    />
    <FormControl
      v-else-if="field.fieldtype === 'Datetime'"
      type="datetime"
      :modelValue="modelValue"
      :disabled="disabled"
      @update:modelValue="(v: string) => emit('update:modelValue', v)"
    />
    <FormControl
      v-else-if="field.fieldtype === 'Int' || field.fieldtype === 'Float'"
      type="number"
      :modelValue="modelValue"
      :disabled="disabled"
      @update:modelValue="(v: string) => emit('update:modelValue', v)"
    />
    <FormControl
      v-else-if="field.fieldtype === 'Small Text' || field.fieldtype === 'Text'"
      type="textarea"
      :modelValue="modelValue"
      :disabled="disabled"
      @update:modelValue="(v: string) => emit('update:modelValue', v)"
    />
    <FormControl
      v-else
      type="text"
      :modelValue="modelValue"
      :disabled="disabled"
      @update:modelValue="(v: string) => emit('update:modelValue', v)"
    />
    <p v-if="field.description" class="text-xs text-ink-gray-5">
      {{ field.description }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { __ } from "@/translation.ts";
import { SearchComplete } from "@/components";
import SearchMultiSelect from "@/components/SearchMultiSelect.vue";
import LucideX from "~icons/lucide/x";
import LucidePaperclip from "~icons/lucide/paperclip";
import LucideUpload from "~icons/lucide/upload";
import {
  Button,
  FileUploader,
  FormControl,
  FormLabel,
  createResource,
} from "frappe-ui";
import { computed } from "vue";

const props = defineProps<{
  field: Record<string, any>;
  modelValue: any;
  disabled?: boolean;
  required?: boolean;
}>();

const emit = defineEmits<{ "update:modelValue": [value: any] }>();

const isMultiLink = computed(
  () =>
    props.field.fieldtype === "Table MultiSelect" ||
    props.field.fieldtype === "Table"
);

// Frappe stores a Time with microseconds ("12:35:59.620237"), while the
// picker's canonical value is HH:mm or HH:mm:ss. An unrecognised value is
// shown as blank, which reads as "no time recorded" rather than "a time this
// control cannot display". Trim to seconds; Frappe parses that back as-is.
const timeValue = computed(() => {
  const raw = String(props.modelValue ?? "");
  const match = raw.match(/^(\d{2}:\d{2}(?::\d{2})?)/);
  return match ? match[1] : "";
});

const selectOptions = computed(() =>
  String(props.field.options || "")
    .split("\n")
    .map((o: string) => ({ label: o ? __(o) : o, value: o }))
);

// Options for multi-link fields, via the permission-checked search API
const linkSearch = createResource({
  url: "philips_captial.api.search_link",
  params: { doctype: props.field.child_link_doctype },
  auto: isMultiLink.value,
});

const linkOptions = computed(
  () =>
    (linkSearch.data || []).map((r: { value: string; label: string }) => ({
      value: r.value,
      label: r.label,
    })) || []
);

const selectedValues = computed<string[]>(() =>
  Array.isArray(props.modelValue) ? props.modelValue : []
);

function removeValue(value: string) {
  emit(
    "update:modelValue",
    selectedValues.value.filter((v) => v !== value)
  );
}
</script>
