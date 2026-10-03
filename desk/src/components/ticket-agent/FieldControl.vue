<template>
  <div v-if="field.fieldtype === 'Check'" class="flex flex-col gap-1 py-1">
    <div class="flex items-center gap-2">
      <FormControl
        type="checkbox"
        :label="field.label"
        :modelValue="Boolean(Number(modelValue))"
        :disabled="disabled"
        @update:modelValue="(v: boolean) => emit('update:modelValue', v ? 1 : 0)"
      />
    </div>
    <!-- A tick box states a choice but not its consequence. "Copy IB on
         Emails" is the case this exists for: the description is where the
         agent learns that unticking it changes who receives the mail. -->
    <p v-if="field.description" class="text-xs text-ink-gray-5 pl-5">
      {{ field.description }}
    </p>
  </div>
  <div v-else class="flex flex-col gap-1">
    <FormLabel :label="field.label" :required="required" />
    <template v-if="field.fieldtype === 'Link'">
      <SearchComplete
        :key="`${modelValue}|${filterKey}`"
        :doctype="field.options"
        :value="String(modelValue || '')"
        :labelField="field.title_field || 'name'"
        :customFilters="linkFilters"
        :disabled="disabled || !!filtersUnresolved"
        @change="(o: any) => emit('update:modelValue', o?.value || '')"
      />
      <!-- Says which field has to be set first, rather than leaving a
           disabled control the agent cannot explain. -->
      <p v-if="filtersUnresolved" class="text-xs text-ink-gray-5">
        {{ __("Select {0} first", [unresolvedLabel]) }}
      </p>
    </template>
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
  // The whole form's current values. A link field may restrict itself by
  // another field — Sub Broker, RM and Trader show only the people at the
  // branch on this application — and that filter has to be resolved against
  // what the form holds now, not against what was last saved.
  doc?: Record<string, any>;
  // The form's field list, for naming the field a restriction waits on.
  fields?: any[];
}>();

const emit = defineEmits<{ "update:modelValue": [value: any] }>();

// Only Table MultiSelect. A plain Table is rows of columns, not a list of
// links: rendering one here showed the agent its child rows' identities —
// Email Queue hashes such as "53vcj30687" — in an editable picker. The
// server no longer sends plain Tables; this keeps the control honest about
// what it can actually display.
const isMultiLink = computed(
  () => props.field.fieldtype === "Table MultiSelect"
);

// A link field's own restriction, resolved against the open form.
//
// Frappe stores this as `link_filters`: a JSON list of
// [doctype, fieldname, operator, value], where a value of "eval:<expr>" is
// an expression over the document (frappe/form/controls/link.js:691). Only
// the shapes this form actually uses are supported — a plain value, and
// `doc.<field>` — rather than running the expression. Evaluating arbitrary
// server-supplied JavaScript in the agent's browser is not something a
// picker needs to do, and the Desk's `frappe.utils.eval` is not available
// here anyway.
//
// A filter whose source field is empty leaves the picker *unresolved*
// rather than unfiltered, for the same reason the Desk sends a sentinel:
// an empty value is read by the server as "no filter" and returns the whole
// master. So the clause is kept, carrying the literal the expression itself
// falls back to, and the control is disabled on top — the list comes back
// empty and nothing can be picked from it either way. The label names the
// field to fill in first, so a disabled control is not a mystery.
const linkFilters = computed<Record<string, any>>(() => resolvedFilters.value.filters);
const filtersUnresolved = computed(() => resolvedFilters.value.unresolved);

const resolvedFilters = computed<{
  filters: Record<string, any>;
  unresolved: string | null;
}>(() => {
  const raw = props.field.link_filters;
  if (!raw) return { filters: {}, unresolved: null };

  let parsed: any[];
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return { filters: {}, unresolved: null };
  }
  if (!Array.isArray(parsed)) return { filters: {}, unresolved: null };

  const out: Record<string, any> = {};
  for (const row of parsed) {
    if (!Array.isArray(row) || row.length < 4) continue;
    const [, fieldname, operator, rawValue] = row;
    let value = rawValue;
    let source: string | null = null;

    if (typeof value === "string" && value.startsWith("eval:")) {
      const expr = value.slice(5).trim();
      const match = expr.match(/^doc\.([a-z0-9_]+)/i);
      source = match ? match[1] : null;
      const resolved = source ? props.doc?.[source] : undefined;

      if (resolved === undefined || resolved === null || resolved === "") {
        // The expression's own fallback — the `|| '...'` the server wrote
        // into link_filters. Sending it keeps the clause restrictive; an
        // empty value would be read as "no filter" and return everything.
        const fallback = expr.match(/\|\|\s*'([^']*)'/);
        return {
          filters: fallback ? { [fieldname]: fallback[1] } : {},
          unresolved: source,
        };
      }
      value = resolved;
    }

    if (value === undefined || value === null || value === "") {
      return { filters: {}, unresolved: source };
    }
    out[fieldname] = operator === "=" ? value : [operator, value];
  }
  return { filters: out, unresolved: null };
});

// The human name of the field that has to be set first. The resolver knows
// it only as a fieldname ("branch"); the agent knows it by its label, so the
// parent passes the form's field list down for the lookup.
const unresolvedLabel = computed(() => {
  const source = filtersUnresolved.value;
  if (!source) return "";
  const df = (props.fields || []).find((f: any) => f.fieldname === source);
  return df?.label || source.replace(/_/g, " ");
});

// SearchComplete reads `customFilters` when it builds its list resource and
// when the search box changes, so a filter that changes afterwards — the
// agent picks a different branch — would leave the stale list in place until
// they typed something. Keying the control on the resolved filter remounts
// it, which is the one thing guaranteed to re-query.
const filterKey = computed(() => JSON.stringify(linkFilters.value));

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
