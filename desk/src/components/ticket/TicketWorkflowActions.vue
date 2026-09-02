<template>
  <div v-if="hasWorkflow || loadFailed" class="flex items-center gap-2">
    <!-- A failed load says so rather than rendering nothing: an invisible
         component is indistinguishable from a broken one. -->
    <Tooltip v-if="loadFailed" :text="error?.message ?? ''">
      <Badge
        theme="red"
        variant="subtle"
        size="lg"
        :label="t('Workflow unavailable')"
      />
    </Tooltip>

    <template v-else>
      <!-- Current workflow state. Distinct from the ticket's own status
           control beside it: that is helpdesk's lifecycle, this is FR-10's. -->
      <Tooltip :text="stateTooltip">
        <Badge
          :theme="badgeTheme"
          variant="subtle"
          size="lg"
          :label="state"
        />
      </Tooltip>

      <Dropdown v-if="hasActions" :options="actionOptions" placement="right">
        <template #default="{ open }">
          <Button :label="t('Actions')" :loading="applying">
            <template #prefix>
              <FeatherIcon name="zap" class="h-4 w-4" />
            </template>
            <template #suffix>
              <FeatherIcon
                :name="open ? 'chevron-up' : 'chevron-down'"
                class="h-4"
              />
            </template>
          </Button>
        </template>
      </Dropdown>
    </template>
  </div>
</template>

<script setup lang="ts">
import { t, useTicketWorkflow } from "@/services/accountOpening";
import type { WorkflowStyle, WorkflowTransition } from "@/services/accountOpening";
import {
  Badge,
  Button,
  Dropdown,
  FeatherIcon,
  Tooltip,
  toast,
  type DropdownProps,
} from "frappe-ui";
import { computed, h } from "vue";

const props = defineProps<{
  /** The record the workflow runs on — a case name, e.g. "AO0001" or "MO0001". */
  ticketId: string | number;
  /**
   * The case DocType: "Account Opening" (FR-10) or "Client Modification"
   * (FR-14). Defaults to HD Ticket server-side, which no flow uses any more.
   */
  doctype?: string;
}>();

const emit = defineEmits<{
  (e: "updated", status: string | undefined): void;
}>();

const {
  state,
  style,
  transitions,
  hasWorkflow,
  hasActions,
  loading,
  applying,
  error,
  apply,
  reload,
} = useTicketWorkflow(
  () => props.ticketId,
  () => props.doctype
);

// Which transitions are available depends on the *case's own fields* — FR-10
// gates "Start Call Verification" on `signature_verification_status`, for
// instance. Saving the Data tab changes those fields without changing the case
// name, so the composable's watch (which keys on name + doctype) does not
// re-fire and the menu would keep showing the pre-save options until the page
// was reloaded. The parent calls this after any save that touches the case.
defineExpose({ reload });

// Only when there is genuinely nothing to show and a retry is not in flight —
// a failed *action* keeps the badge, since the state is still known.
const loadFailed = computed(
  () => Boolean(error.value) && !hasWorkflow.value && !loading.value
);

const BADGE_THEMES: Record<WorkflowStyle, "gray" | "blue" | "green" | "orange" | "red"> = {
  "": "gray",
  Inverse: "gray",
  Primary: "blue",
  Info: "blue",
  Success: "green",
  Warning: "orange",
  Danger: "red",
};

const badgeTheme = computed(() => BADGE_THEMES[style.value] ?? "gray");

// Drives both FR-10 (HD Ticket) and FR-14 (Client Modification), so the label
// cannot name either flow.
const stateTooltip = computed(() => t("Workflow state"));

async function onAction(transition: WorkflowTransition): Promise<void> {
  const result = await apply(transition.action);

  if (result) {
    toast.success(
      `${t("Workflow updated")} — ${result.state ?? transition.nextState}`
    );
    emit("updated", result.status);
    return;
  }

  toast.error(error.value?.message || t("Could not apply the workflow action"));
}


const actionOptions = computed(
  () =>
    transitions.value.map((transition) =>
      transition.allowed
        ? {
            label: transition.action,
            onClick: () => onAction(transition),
          }
        : {
            label: transition.action,
            component: () =>
              h(
                Tooltip,
                { text: transition.blockedReason ?? "" },
                () =>
                  h(
                    "div",
                    {
                      class:
                        "flex h-7 w-full cursor-not-allowed items-center rounded px-2 text-base text-ink-gray-4",
                    },
                    [
                      h(FeatherIcon, {
                        name: "lock",
                        class: "mr-2 h-4 w-4 shrink-0",
                      }),
                      h(
                        "span",
                        { class: "whitespace-nowrap" },
                        transition.action
                      ),
                    ]
                  )
              ),
          }
    ) as unknown as DropdownProps["options"]
);
</script>
