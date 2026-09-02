<template>
  <div class="flex flex-col gap-1">
    <label class="text-xs text-gray-600">
      {{ field.label }}
      <span v-if="field.required" class="text-red-500">*</span>
    </label>

    <!-- Link field: use helpdesk's Link picker driven by the target doctype -->
    <Link
      v-if="field.fieldtype === 'Link'"
      class="form-control"
      :doctype="field.options"
      :value="stringValue"
      :disabled="field.readonly"
      :placeholder="`Add ${field.label}`"
      @change="(v) => emitValue(v)"
    />

    <!-- Select: native select rendered from newline-separated options -->
    <FormControl
      v-else-if="field.fieldtype === 'Select'"
      type="select"
      :options="selectOptions"
      :model-value="stringValue"
      :disabled="field.readonly"
      :placeholder="`Select ${field.label}`"
      @update:model-value="(v) => emitValue(v)"
    />

    <!-- Checkbox -->
    <FormControl
      v-else-if="field.fieldtype === 'Checkbox'"
      type="checkbox"
      :model-value="!!modelValue"
      :disabled="field.readonly"
      @update:model-value="(v) => emitValue(v ? 1 : 0)"
    />

    <!-- Multi-line text -->
    <FormControl
      v-else-if="field.fieldtype === 'TextArea'"
      type="textarea"
      :rows="3"
      :model-value="stringValue"
      :disabled="field.readonly"
      :placeholder="`Add ${field.label}`"
      @change="(e) => emitValue(e.target.value)"
    />

    <!-- Date: frappe-ui renders FormControl type="date" as a DatePicker, which
         emits update:modelValue with the value rather than a DOM change event.
         Listening only for @change here left the form unaware of the new date,
         so nothing looked edited and Save stayed disabled. -->
    <FormControl
      v-else-if="field.fieldtype === 'Date'"
      type="date"
      :model-value="stringValue"
      :disabled="field.readonly"
      :placeholder="`Add ${field.label}`"
      @update:model-value="(v) => emitValue(v ?? '')"
    />

    <!-- Single-line inputs: Text / Email / Phone / Number -->
    <FormControl
      v-else
      :type="inputType"
      :model-value="stringValue"
      :disabled="field.readonly"
      :placeholder="`Add ${field.label}`"
      @change="(e) => emitValue(e.target.value)"
    />

    <ErrorMessage v-if="error" :message="error" />
    <p v-else-if="field.description" class="text-xs text-gray-500">
      {{ field.description }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { Link } from "@/components";
import { ErrorMessage, FormControl } from "frappe-ui";
import { computed } from "vue";

interface DynamicField {
  fieldname: string;
  label: string;
  fieldtype: string;
  options?: string;
  required?: 0 | 1;
  /** Hint shown under the control when there is no validation error. */
  description?: string;
  /**
   * Render the control disabled. FR-11 needs this: a closure case is worked by
   * five departments at once and the server only accepts the block the caller's
   * role owns, so an enabled input for someone else's block would take a value
   * and silently discard it. Absent means editable, so FR-10 and FR-14 are
   * unaffected.
   */
  readonly?: boolean;
}

const props = defineProps<{
  field: DynamicField;
  modelValue: string | number | boolean | null;
  error?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string | number | boolean | null): void;
}>();

const inputType = computed(() => {
  switch (props.field.fieldtype) {
    case "Email":
      return "email";
    case "Phone":
      return "tel";
    case "Number":
      return "number";
    case "Date":
      return "date";
    default:
      return "text";
  }
});

const selectOptions = computed(() => {
  const opts = (props.field.options || "")
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean)
    .map((o) => ({ label: o, value: o }));
  // Leading blank lets a non-required select be cleared.
  return props.field.required ? opts : [{ label: "", value: "" }, ...opts];
});

const stringValue = computed(() =>
  props.modelValue === null || props.modelValue === undefined
    ? ""
    : String(props.modelValue)
);

function emitValue(value: string | number | boolean | null) {
  emit("update:modelValue", value);
}
</script>

<style scoped>
:deep(.form-control input),
:deep(.form-control select),
:deep(.form-control textarea) {
  width: 100%;
}
</style>
