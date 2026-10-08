<template>
  <div class="flex flex-col">
    <LayoutHeader>
      <template #left-header>
        <div class="text-lg-medium text-ink-gray-9">{{ __("Reports") }}</div>
      </template>
    </LayoutHeader>

    <div class="flex-1 overflow-y-auto px-5 py-4">
      <div v-if="reports.loading" class="text-base text-ink-gray-5">
        {{ __("Loading...") }}
      </div>

      <div
        v-else-if="!reports.data?.length"
        class="flex flex-col items-center justify-center gap-2 py-20"
      >
        <LucideFileBarChart class="h-8 w-8 text-ink-gray-4" />
        <div class="text-base text-ink-gray-6">
          {{ __("No reports available") }}
        </div>
        <div class="text-p-sm text-ink-gray-5">
          {{ __("You don't have access to any reports yet.") }}
        </div>
      </div>

      <template v-else>
        <!-- One report today, several later: the search is what keeps the
             page usable once the list outgrows a glance. -->
        <FormControl
          v-model="query"
          type="text"
          class="mb-3 max-w-sm"
          :placeholder="__('Search reports')"
        >
          <template #prefix>
            <LucideSearch class="h-4 w-4 text-ink-gray-5" />
          </template>
        </FormControl>

        <div v-if="!filtered.length" class="py-10 text-center text-p-sm text-ink-gray-5">
          {{ __("No reports match {0}", [query]) }}
        </div>

        <div v-else class="flex flex-col gap-1">
          <button
            v-for="report in filtered"
            :key="report.name"
            class="flex items-center justify-between rounded px-3 py-2.5 text-left hover:bg-surface-gray-2"
            @click="openReport(report)"
          >
            <div class="flex items-center gap-3">
              <LucideFileBarChart class="h-4 w-4 text-ink-gray-6" />
              <div class="flex flex-col">
                <span class="text-base text-ink-gray-8">{{ report.label }}</span>
                <span v-if="report.ref_doctype" class="text-p-sm text-ink-gray-5">
                  {{ __(report.ref_doctype) }}
                </span>
              </div>
            </div>
            <LucideExternalLink class="h-4 w-4 text-ink-gray-5" />
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import LayoutHeader from "@/components/LayoutHeader.vue";
import { permittedReports as reports } from "@/components/layouts/layoutSettings";
import { __ } from "@/translation";
import { FormControl } from "frappe-ui";
import { computed, onMounted, ref } from "vue";
import LucideExternalLink from "~icons/lucide/external-link";
import LucideFileBarChart from "~icons/lucide/file-bar-chart";
import LucideSearch from "~icons/lucide/search";

interface PermittedReport {
  name: string;
  label: string;
  ref_doctype: string | null;
  report_type: string;
}

const query = ref("");

// The sidebar normally loads this first; fetch here too so the page works
// when it is opened directly by URL.
onMounted(() => {
  if (!reports.data) reports.fetch();
});

// Matches the report's own name and the doctype it reports on, which is how
// an agent who knows "the application one" will look for it.
const filtered = computed<PermittedReport[]>(() => {
  const term = query.value.trim().toLowerCase();
  const all = (reports.data || []) as PermittedReport[];
  if (!term) return all;
  return all.filter((r) =>
    `${r.label} ${r.ref_doctype || ""}`.toLowerCase().includes(term)
  );
});

// Reports render in the desk, which this SPA is not part of: a new tab keeps
// the agent's helpdesk state intact.
function openReport(report: PermittedReport) {
  const path =
    report.report_type === "Report Builder" && report.ref_doctype
      ? `/app/${slug(report.ref_doctype)}/view/report`
      : `/app/query-report/${encodeURIComponent(report.name)}`;
  window.open(path, "_blank", "noopener");
}

function slug(text: string) {
  return text.toLowerCase().replace(/ /g, "-");
}
</script>
