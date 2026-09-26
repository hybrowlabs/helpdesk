<template>
  <div class="flex flex-col overflow-hidden">
    <LayoutHeader>
      <template #left-header>
        <div class="text-lg-medium text-ink-gray-9">{{ __("Reports") }}</div>
      </template>
    </LayoutHeader>

    <div class="overflow-y-auto px-5 py-6 sm:px-10">
      <div class="mx-auto flex max-w-5xl flex-col gap-10">
        <div
          v-for="group in reportGroups"
          :key="group.title"
          class="flex flex-col gap-1"
        >
          <span class="text-lg-semibold text-ink-gray-8">
            {{ __(group.title) }}
          </span>
          <span class="text-p-sm text-ink-gray-6 max-w-3xl">
            {{ __(group.subtitle) }}
          </span>

          <div class="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div
              v-for="report in group.reports"
              :key="report.title"
              class="flex flex-col gap-2 rounded-md border border-outline-gray-2 p-4"
            >
              <div class="flex items-start justify-between gap-3">
                <span class="text-base-medium text-ink-gray-8">
                  {{ __(report.title) }}
                </span>
                <Badge
                  :theme="statusMeta[report.status].theme"
                  variant="subtle"
                  size="sm"
                  :label="__(statusMeta[report.status].label)"
                />
              </div>

              <span class="text-p-sm text-ink-gray-6">
                {{ __(report.description) }}
              </span>

              <span
                v-if="report.blockedOn"
                class="text-p-sm text-ink-gray-5 border-t border-outline-gray-1 pt-2 mt-1"
              >
                {{ __("Needs from PhillipCapital") }}:
                {{ __(report.blockedOn) }}
              </span>

              <span class="text-p-sm text-ink-gray-4 mt-auto pt-1">
                {{ report.fr }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Badge, usePageMeta } from "frappe-ui";
import LayoutHeader from "@/components/LayoutHeader.vue";
import { reportGroups, statusMeta } from "./reports";
import { __ } from "@/translation";

usePageMeta(() => ({ title: __("Reports") }));
</script>
