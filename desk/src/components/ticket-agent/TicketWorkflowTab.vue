<template>
  <div class="flex flex-1 flex-col overflow-y-auto px-5 py-4">
    <div v-if="workflow.loading" class="flex items-center justify-center py-8">
      <Button :loading="true" variant="ghost" size="lg" />
    </div>
    <template v-else-if="data?.workflow">
      <!-- Header -->
      <div class="mb-4 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-lg font-semibold text-ink-gray-8">
            {{ data.workflow.name || __(data.workflow.doctype) }}
          </span>
          <Badge
            v-if="data.workflow.status"
            :label="data.workflow.status.label"
            :theme="data.workflow.status.color"
            variant="subtle"
          />
        </div>
        <div class="flex items-center gap-2">
          <Button
            v-if="form?.perms?.write && (!data.workflow.name || isDirty)"
            :label="data.workflow.name ? __('Save') : __('Create')"
            variant="solid"
            :loading="saveDoc.loading"
            @click="save"
          />
        </div>
      </div>

      <!-- Editable form -->
      <div v-if="formMeta.loading" class="flex items-center justify-center py-8">
        <Button :loading="true" variant="ghost" size="lg" />
      </div>
      <template v-else-if="form">
        <TabButtons
          v-if="tabButtons.length > 1"
          class="mb-4 self-start"
          :buttons="tabButtons"
          v-model="activeTab"
        />
        <template v-for="tab in visibleTabs" :key="tab.label">
          <div v-show="tab.label === activeTab" class="flex flex-col gap-5">
            <div
              v-for="(section, si) in visibleSections(tab.sections)"
              :key="si"
              class="flex flex-col gap-3"
            >
              <div
                v-if="section.label"
                class="text-sm font-medium text-ink-gray-6 border-b pb-1"
              >
                {{ section.label }}
              </div>
              <div class="grid grid-cols-2 gap-x-6 items-start">
                <div
                  v-for="(column, ci) in visibleColumns(section.columns)"
                  :key="ci"
                  class="flex flex-col gap-3"
                >
                  <FieldControl
                    v-for="field in column"
                    :key="field.fieldname"
                    :field="field"
                    :modelValue="values[field.fieldname]"
                    :disabled="isDisabled(field)"
                    :required="isRequired(field)"
                    @update:modelValue="(v) => setValue(field, v)"
                  />
                </div>
              </div>
            </div>
          </div>
        </template>
        <div
          v-show="activeTab === HISTORY_TAB"
          class="flex flex-col gap-4"
        >
          <div
            v-if="history.loading"
            class="text-base text-ink-gray-5"
          >
            {{ __("Loading…") }}
          </div>
          <div
            v-else-if="!history.data?.length"
            class="text-base text-ink-gray-5"
          >
            {{ __("Nothing has been changed yet.") }}
          </div>
          <div
            v-for="entry in history.data || []"
            :key="entry.name"
            class="flex flex-col gap-2 border-b pb-3 last:border-b-0"
          >
            <div class="flex items-center gap-2">
              <UserAvatar
                size="sm"
                :name="entry.user"
                :expand="true"
                :strong="true"
              />
              <span class="text-sm text-ink-gray-5">
                {{ dayjs(entry.timestamp).format("DD MMM YYYY, hh:mm a") }}
              </span>
            </div>
            <div class="flex flex-col gap-1 pl-8">
              <div
                v-for="change in entry.changes"
                :key="change.fieldname"
                class="text-base text-ink-gray-7"
              >
                <span class="text-ink-gray-5">{{ change.label }}:</span>
                <span v-if="change.old" class="line-through text-ink-gray-5">
                  {{ change.old }}
                </span>
                <span v-else class="text-ink-gray-5">{{ __("empty") }}</span>
                <span class="text-ink-gray-5">&rarr;</span>
                <span class="font-medium">{{ change.new || __("empty") }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </template>
    <div v-else class="flex flex-1 items-center justify-center">
      <p class="text-base text-ink-gray-5">
        {{ __("No workflow configured for this ticket category") }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { TicketSymbol } from "@/types";
import { __ } from "@/translation.ts";
import FieldControl from "@/components/ticket-agent/FieldControl.vue";
import UserAvatar from "@/components/UserAvatar.vue";
import { globalStore } from "@/stores/globalStore";
import {
  Badge,
  Button,
  TabButtons,
  call,
  createResource,
  dayjs,
  toast,
} from "frappe-ui";
import { computed, inject, reactive, ref, watch } from "vue";

const ticket = inject(TicketSymbol);
const ticketId = computed(() => String(ticket.value?.doc?.name));
const { $dialog } = globalStore();

// Not a field tab — it reports on the document rather than editing it.
const HISTORY_TAB = __("History");

const workflow = createResource({
  url: "philips_captial.api.get_ticket_workflow_doc",
  params: { ticket: ticketId.value },
  auto: true,
  cache: ["ticket_workflow", ticketId.value],
});

const data = computed(() => workflow.data);

const values = reactive<Record<string, any>>({});
const pristine = ref<Record<string, any>>({});
const activeTab = ref("");

const formMeta = createResource({
  url: "philips_captial.api.get_form_meta",
  params: { ticket: ticketId.value },
  auto: true,
  onSuccess(res: any) {
    Object.keys(values).forEach((k) => delete values[k]);
    Object.assign(values, res.values || {});
    pristine.value = { ...(res.values || {}) };
    if (!activeTab.value && res.fields?.length) {
      activeTab.value = firstTabLabel(res.fields);
    }
  },
});

// Who changed what, from Frappe's own Version rows. Lazy: the tab is a
// reference view, so it is not worth a request until someone opens it.
const history = createResource({
  url: "philips_captial.api.get_history",
  params: { ticket: ticketId.value },
  auto: false,
});

// Save is offered only for a new doc, or once a field actually differs from
// what was loaded — an untouched form has nothing to save.
const isDirty = computed(() => {
  const base = pristine.value;
  const keys = new Set([...Object.keys(base), ...Object.keys(values)]);
  for (const k of keys) {
    const a = base[k] ?? "";
    const b = values[k] ?? "";
    if (a !== b) return true;
  }
  return false;
});

const form = computed(() => formMeta.data);

// ---- layout: fields -> tabs -> sections -> columns ----
interface Section {
  label: string;
  depends_on?: string;
  columns: any[][];
}
interface Tab {
  label: string;
  sections: Section[];
}

function firstTabLabel(fields: any[]): string {
  return fields[0]?.fieldtype === "Tab Break" ? fields[0].label : __("Details");
}

const tabs = computed<Tab[]>(() => {
  const out: Tab[] = [];
  let tab: Tab | null = null;
  let section: Section | null = null;

  const startSection = (label: string, depends_on?: string) => {
    section = { label, depends_on, columns: [[]] };
    tab!.sections.push(section);
  };

  for (const f of form.value?.fields || []) {
    if (f.fieldtype === "Tab Break") {
      tab = { label: f.label, sections: [] };
      out.push(tab);
      section = null;
      continue;
    }
    if (!tab) {
      tab = { label: __("Details"), sections: [] };
      out.push(tab);
    }
    if (f.fieldtype === "Section Break") {
      startSection(f.label, f.depends_on);
      continue;
    }
    if (!section) startSection("");
    if (f.fieldtype === "Column Break") {
      // A column break starts the next column, so the fields that follow stack
      // under each other instead of continuing across the row.
      section.columns.push([]);
      continue;
    }
    section.columns[section.columns.length - 1].push(f);
  }
  return out;
});

// ---- depends_on / mandatory_depends_on evaluation ----
function evalDependsOn(expr: string | undefined): boolean {
  if (!expr) return true;
  let code = expr;
  if (code.startsWith("eval:")) code = code.slice(5);
  else return Boolean(values[code]);
  try {
    const fn = new Function("doc", `return (${code});`);
    return Boolean(fn(values));
  } catch {
    return true;
  }
}

function visibleFields(fields: any[]) {
  return fields.filter((f) => evalDependsOn(f.depends_on));
}

// Drop columns that `depends_on` has emptied, so a hidden column leaves no gap.
function visibleColumns(columns: any[][]) {
  return columns.map(visibleFields).filter((column) => column.length);
}

// A section whose every field is hidden must take its heading with it —
// otherwise a status-specific block leaves a bare title behind, e.g.
// "Reminders" on an application that was never an exception.
function visibleSections(sections: any[]) {
  return sections.filter(
    (section) =>
      evalDependsOn(section.depends_on) &&
      visibleColumns(section.columns).length
  );
}

// Likewise a tab with nothing left to show must drop its button, the way the
// Desk form does — an "Exception" tab on a rejected application opens onto an
// empty pane and reads like something failed to load.
const visibleTabs = computed<Tab[]>(() =>
  tabs.value.filter((tab) => visibleSections(tab.sections).length)
);

// History is not built from fields, so it is appended to the field tabs
// rather than derived from them.
const tabButtons = computed(() => [
  ...visibleTabs.value.map((t) => ({ label: t.label, value: t.label })),
  { label: HISTORY_TAB, value: HISTORY_TAB },
]);

// Changing the status can hide the tab currently being viewed — switching an
// application from "Approved with Exception" to "Rejected" removes Exception
// under the agent. Fall back to the first tab that is still there, otherwise
// the pane goes blank with no tab selected.
watch(visibleTabs, (available) => {
  if (!available.length || activeTab.value === HISTORY_TAB) return;
  if (!available.some((tab) => tab.label === activeTab.value)) {
    activeTab.value = available[0].label;
  }
});

// Fetch on first open, and again on re-open so a change made in another tab
// is reflected rather than served from a stale first read.
watch(activeTab, (tab) => {
  if (tab === HISTORY_TAB) history.reload();
});

// Frappe resolves `fetch_from` on save, so a link change would otherwise leave
// the fetched name blank until the doc is written. Resolve it now, the way the
// Desk form does.
async function setValue(field: any, value: any) {
  values[field.fieldname] = value;
  if (field.fieldtype !== "Link" || !form.value?.doctype) return;
  await applyFetched(field.fieldname, value);
}

async function applyFetched(fieldname: string, value: any, seen = new Set<string>()) {
  if (seen.has(fieldname)) return;
  seen.add(fieldname);

  const fetched = await call("philips_captial.api.fetch_linked_values", {
    doctype: form.value.doctype,
    fieldname,
    value: value || "",
  });

  for (const [target, fetchedValue] of Object.entries(fetched || {})) {
    const df = fieldsByName.value[target];
    // Never overwrite something the agent set in an editable field.
    if (df && !df.read_only && values[target]) continue;
    values[target] = fetchedValue ?? "";

    // A fetched link (IB -> Branch) is itself a source for further fetches,
    // so Branch Name fills in too instead of staying blank until save.
    if (df?.fieldtype === "Link") {
      await applyFetched(target, values[target], seen);
    }
  }
}

const fieldsByName = computed<Record<string, any>>(() =>
  Object.fromEntries(
    (form.value?.fields || []).map((f: any) => [f.fieldname, f])
  )
);

function isRequired(field: any): boolean {
  if (field.reqd) return true;
  if (field.mandatory_depends_on) {
    return evalDependsOn(field.mandatory_depends_on);
  }
  return false;
}

function isDisabled(field: any): boolean {
  const f = form.value;
  if (!f?.perms?.write) return true;
  // `fetch_from` alone only supplies a default; the doctype says whether the
  // value may then be edited. Locking every fetched field would stop an agent
  // correcting one the source got wrong.
  if (field.read_only) return true;
  if (
    field.permlevel &&
    !(f.write_permlevels || []).includes(field.permlevel)
  ) {
    return true;
  }
  if (field.read_only_depends_on) {
    return evalDependsOn(field.read_only_depends_on);
  }
  return false;
}

// ---- save ----
const saveDoc = createResource({
  url: "philips_captial.api.save_workflow_doc",
  onSuccess(res: any) {
    toast.success(__("Saved"));
    workflow.data = res;
    formMeta.reload();
    // The ticket's status is derived from this document, so a save here can
    // have just changed it. Without this the header badge keeps showing the
    // status the page was loaded with, which reads as the save not working.
    ticket.value?.reload?.();
  },
  onError(err: any) {
    // frappe-ui discards the server's message title while unwrapping
    // `_server_messages`, and consumes the response body, so the title has to
    // travel inside the HTML. Take the leading <h4> as the dialog heading.
    const body = (
      err?.messages?.length ? err.messages : [err?.message].filter(Boolean)
    ).join("");
    const heading = body.match(/^\s*<h4[^>]*>(.*?)<\/h4>/i);
    const title = heading ? heading[1].trim() : "";
    const html = heading ? body.slice(heading[0].length) : body;

    // Validation failures list fields that may sit on a tab the user cannot
    // see; a toast truncates them and offers no way to act. The server sends
    // formatted HTML, so render it rather than escaping it into `message`.
    if (html) {
      jumpToFirstMissingTab(html);
      $dialog({
        title: title || __("This change could not be saved"),
        html,
        size: "md",
        actions: [{ label: __("Got it"), variant: "solid" }],
      });
      return;
    }
    toast.error(__("Could not save. Please try again."));
  },
});

function save() {
  saveDoc.submit({ ticket: ticketId.value, values: { ...values } });
}

// The server names the tab each missing field belongs to; open the first one
// so the user lands where the work is.
function jumpToFirstMissingTab(html: string) {
  const match = html.match(/<b>(.+?) tab<\/b>/);
  if (!match) return;
  const label = match[1].trim();
  const target = tabs.value.find((t) => t.label === label);
  if (target) activeTab.value = target.label;
}

watch(ticketId, () => {
  workflow.reload();
  formMeta.reload();
});
</script>
