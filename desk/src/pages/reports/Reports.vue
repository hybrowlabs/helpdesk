<template>
  <div class="flex flex-col">
    <LayoutHeader>
      <template #left-header>
        <div class="text-lg-medium text-ink-gray-9">{{ __("Reports") }}</div>
      </template>
    </LayoutHeader>

    <div class="flex-1 overflow-y-auto px-5 py-4">
      <div
        v-if="reports.loading"
        class="text-base text-ink-gray-5"
      >
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

      <div v-else class="flex flex-col gap-1">
        <button
          v-for="report in reports.data"
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
    </div>
  </div>
</template>

<script setup lang="ts">
import LayoutHeader from "@/components/LayoutHeader.vue";
import { permittedReports as reports } from "@/components/layouts/layoutSettings";
import { __ } from "@/translation";
import LucideExternalLink from "~icons/lucide/external-link";
import LucideFileBarChart from "~icons/lucide/file-bar-chart";

interface PermittedReport {
  name: string;
  label: string;
  ref_doctype: string | null;
  report_type: string;
}

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
