<template>
  <div class="flex gap-2 px-6 pb-1 leading-5 first:mt-3 items-baseline">
    <Tooltip :text="field.label">
      <div class="w-[106px] shrink-0 truncate text-sm text-gray-600">
        {{ field.label }}
        <span v-if="field.required" class="text-red-500"> * </span>
      </div>
    </Tooltip>
    <div
      class="-m-0.5 min-h-[28px] flex-1 items-center overflow-hidden p-0.5 text-base"
    >
      <div
        v-if="readonly"
        class="flex min-h-[28px] items-center px-2"
        :class="readonlyText ? 'text-ink-gray-8' : 'text-ink-gray-4'"
        :title="readonlyText"
      >
        <span class="truncate">{{ readonlyText || "—" }}</span>
      </div>
      <component
        v-else
        :is="component"
        :key="field.fieldname"
        class="form-control"
        :placeholder="`Add ${field.label}`"
        :model-value="transValue"
        autocomplete="off"
        v-on="
          textFields.includes(field.fieldtype)
            ? {
                blur: (event) => {
                  emitUpdate(field.fieldname, event.target.value);
                },
              }
            : {
                'update:model-value': (event) => {
                  emitUpdate(
                    field.fieldname,
                    event?.value || event?.target?.value || event
                  );
                },
              }
        "
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Autocomplete, Link } from "@/components";
import { Field, FieldValue } from "@/types";
import { createResource, FormControl, Tooltip } from "frappe-ui";
import { computed, h } from "vue";

interface P {
  field: Field;
  value: FieldValue;
  readonly?: boolean;
}

interface R {
  fieldname: Field["fieldname"];
  value: FieldValue;
}

interface E {
  (event: "change", value: R);
}

const props = defineProps<P>();
const emit = defineEmits<E>();

const textFields = ["Long Text", "Small Text", "Text", "Text Editor", "Data"];

const component = computed(() => {
  if (props.field.url_method) {
    return h(Autocomplete, {
      options: apiOptions.data,
    });
  } else if (props.field.fieldtype === "Link" && props.field.options) {
    return h(Link, {
      doctype: props.field.options,
      hideMe: true,
    });
  } else if (props.field.fieldtype === "Select") {
    return h(Autocomplete, {
      options: props.field.options
        .split("\n")
        .map((o) => ({ label: o, value: o })),
    });
  } else if (props.field.fieldtype === "Check") {
    return h(Autocomplete, {
      options: [
        {
          label: "Yes",
          value: 1,
        },
        {
          label: "No",
          value: 0,
        },
      ],
    });
  } else if (textFields.includes(props.field.fieldtype)) {
    return h(FormControl, {
      type: "textarea",
    });
  } else {
    return h(FormControl);
  }
});

const apiOptions = createResource({
  url: props.field.url_method,
  auto: !!props.field.url_method && !props.readonly,
  transform: (data) => {
    if (!data?.length) return [];
    return (
      data?.map((o) => ({
        label: o,
        value: o,
      })) || []
    );
  },
});

const transValue = computed(() => {
  if (props.field.fieldtype === "Check") {
    return props.value ? "Yes" : "No";
  }
  return props.value;
});

// What a read-only field shows: Yes / No for a check, nothing for an empty
// value (the template falls back to a dash).
const readonlyText = computed(() => {
  const value = transValue.value;
  return value === null || value === undefined ? "" : String(value);
});

function emitUpdate(fieldname: Field["fieldname"], value: FieldValue) {
  emit("change", { fieldname, value });
}
</script>
<style scoped>
:deep(.form-control input:not([type="checkbox"])),
:deep(.form-control select),
:deep(.form-control textarea),
:deep(.form-control button) {
  border-color: transparent;
  background: white;
}

:deep(.form-control button) {
  gap: 0;
}
:deep(.form-control [type="checkbox"]) {
  margin-left: 9px;
  cursor: pointer;
}

:deep(.form-control button > div) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.form-control button svg) {
  color: white;
  width: 0;
}
</style>
