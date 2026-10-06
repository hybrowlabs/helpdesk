<template>
  <Autocomplete
    placeholder="Select an option"
    :options="options"
    :value="selection"
    @update:query="(q) => onUpdateQuery(q)"
    @change="
      (v) => {
        if (!resetInput) {
          selection = v;
        }
        emit('change', v);
      }
    "
  />
</template>

<script setup lang="ts">
import { Autocomplete } from "@/components";
import { createListResource } from "frappe-ui";
import { computed, ref } from "vue";

const emit = defineEmits(["change"]);

const props = defineProps({
  value: {
    type: String,
    required: false,
    default: "",
  },
  doctype: {
    type: String,
    required: true,
  },
  searchField: {
    type: String,
    required: false,
    default: "name",
  },
  labelField: {
    type: String,
    required: false,
    default: "name",
  },
  valueField: {
    type: String,
    required: false,
    default: "name",
  },
  pageLength: {
    type: Number,
    required: false,
    default: 100,
  },
  resetInput: {
    type: Boolean,
    required: false,
    default: false,
  },
  customFilters: {
    type: Object,
    required: false,
    default: {},
  },
});

// Two rules this control has to get right, and used to get wrong.
//
// 1. The current value is not a search term. Seeding the filter with it
//    meant a field holding RM01 opened showing only RM01 — the other
//    relationship managers existed and were permitted, but the dropdown
//    looked like a one-item list. The current value is for *display*, so
//    it selects the matching option rather than filtering the query.
// 2. People search by the name they know, not the code the system stores.
//    Searching only `name` meant typing "Arjun" matched nothing, because
//    that record is called RM02. Code and title are both searched.
//
// `orFilters` is frappe-ui's camelCase option; it is what the resource
// serialises to the server's `or_filters` (listResource.js). Spelling it
// `or_filters` here silently drops the clause and returns everything.
const searchFields = computed(() =>
  props.labelField && props.labelField !== props.searchField
    ? [props.searchField, props.labelField]
    : [props.searchField]
);

function searchClause(query: string) {
  return query
    ? searchFields.value.map((f) => [f, "like", `%${query}%`])
    : undefined;
}

const r = createListResource({
  doctype: props.doctype,
  pageLength: props.pageLength,
  auto: true,
  fields: [...new Set([props.labelField, props.searchField, props.valueField])],
  filters: { ...props.customFilters },
  onSuccess: () => {
    selection.value = props.value
      ? options.value.find((o) => o.value === props.value)
      : null;
  },
});
// A record whose title field is empty would otherwise render as a blank
// line: present, selectable, invisible. The name is always set, so it
// stands in — a visible code beats an empty row.
const options = computed(
  () =>
    r.data?.map((result) => ({
      label: result[props.labelField] || result[props.valueField],
      value: result[props.valueField],
    })) || []
);
const selection = ref(null);

function onUpdateQuery(query: string) {
  r.update({
    filters: { ...props.customFilters },
    orFilters: searchClause(query),
  });

  r.reload();
}
</script>
