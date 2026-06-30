<template>
  <div v-if="ticket.data" class="flex flex-col">
    <LayoutHeader>
      <template #left-header>
        <Breadcrumbs :items="breadcrumbs" />
      </template>
      <template #right-header>
        <CustomActions
          v-if="ticket.data._customActions"
          :actions="ticket.data._customActions"
        />
        <Button
          v-if="ticket.data.status === 'Awaiting User Response'"
          label="Resolve"
          theme="green"
          variant="solid"
          @click="triggerResolve()"
        >
          <template #prefix>
            <Icon icon="lucide:check-circle" />
          </template>
        </Button>
        <Button
          v-else-if="canCloseTicket && ticket.data.status !== 'Closed'"
          :label="hasValidResolution ? 'Close' : 'Close (Resolution Required)'"
          :variant="hasValidResolution ? 'solid' : 'outline'"
          :theme="hasValidResolution ? 'red' : 'gray'"
          :disabled="!hasValidResolution"
          :class="{ 'opacity-60': !hasValidResolution }"
          @click="triggerClose()"
        >
          <template #prefix>
            <Icon icon="lucide:check" />
          </template>
        </Button>
        <Button
          v-else-if="canRequestClosure && ticket.data.status !== 'Closed'"
          label="Request Closure"
          theme="gray"
          variant="solid"
          @click="triggerRequestClosure()"
        />
        <Button
          v-else-if="canRejectResolution"
          label="Reject Resolution"
          theme="red"
          variant="outline"
          @click="triggerRejectResolution()"
        >
          <template #prefix>
            <Icon icon="lucide:x-circle" />
          </template>
        </Button>
        <Button
          v-else-if="canReopenTicket"
          label="Reopen Ticket"
          theme="blue"
          variant="solid"
          @click="triggerReopen()"
        >
          <template #prefix>
            <Icon icon="lucide:refresh-cw" />
          </template>
        </Button>
      </template>
    </LayoutHeader>
    <div class="flex overflow-hidden h-full w-full">
      <!-- Main Ticket Comm -->
      <section class="flex flex-col flex-1 w-full md:max-w-[calc(100%-382px)]">
        <!-- show for only mobile -->
        <TicketCustomerTemplateFields v-if="isMobileView" />

        <div class="flex-1 overflow-hidden flex flex-col">
          <Tabs v-model="tabIndex" :tabs="tabs">
            <TabList />
            <TabPanel v-slot="{ tab }" class="h-full">
              <TicketResolutionSection
                v-if="tab.name === 'resolution'"
                :ticket="ticket.data"
                :ticket-id="ticketId"
                @update="
                  () => {
                    ticket.reload();
                  }
                "
              />
              <TicketConversation v-else class="grow" />
            </TabPanel>
          </Tabs>
        </div>

        <div
          v-if="showEditor"
          class="w-full p-5"
          @keydown.ctrl.enter.capture.stop="sendEmail"
          @keydown.meta.enter.capture.stop="sendEmail"
        >
          <TicketTextEditor
            ref="editor"
            v-model:attachments="attachments"
            v-model:content="editorContent"
            v-model:expand="isExpanded"
            placeholder="Type a message"
            autofocus
            @clear="() => (isExpanded = false)"
            :uploadFunction="(file:any)=>uploadFunction(file, 'HD Ticket', props.ticketId)"
          >
            <template #bottom-right>
              <Button
                label="Send"
                theme="gray"
                variant="solid"
                :disabled="$refs.editor?.editor.isEmpty || send.loading"
                :loading="send.loading"
                @click="sendEmail"
              />
            </template>
          </TicketTextEditor>
        </div>
      </section>
      <!-- Ticket Sidebar only for desktop view-->
      <TicketCustomerSidebar v-if="!isMobileView" @open="isExpanded = true" />
    </div>
    <TicketFeedback v-model:open="showFeedbackDialog" />
  </div>
</template>

<script setup lang="ts">
import { LayoutHeader, TextEditor } from "@/components";
import TicketCustomerSidebar from "@/components/ticket/TicketCustomerSidebar.vue";
import { setupCustomizations } from "@/composables/formCustomisation";
import { useScreenSize } from "@/composables/screen";
import { socket } from "@/socket";
import { useConfigStore } from "@/stores/config";
import { globalStore } from "@/stores/globalStore";
import { isContentEmpty, uploadFunction } from "@/utils";
import { Icon } from "@iconify/vue";
import { Breadcrumbs, Button, FormControl, call, createResource, toast } from "frappe-ui";
import { computed, h, onMounted, onUnmounted, provide, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useTicket } from "./data";
import { useAuthStore } from "@/stores/auth";
import { ITicket } from "./symbols";
import TicketCustomerTemplateFields from "./TicketCustomerTemplateFields.vue";
import TicketConversation from "./TicketConversation.vue";
import TicketFeedback from "./TicketFeedback.vue";
import TicketTextEditor from "./TicketTextEditor.vue";
import TicketResolutionSection from "@/components/ticket/TicketResolutionSection.vue";
import { Tabs, TabList, TabPanel } from "frappe-ui";
import { ActivityIcon, CommentIcon, EmailIcon, TicketIcon } from "@/components/icons";
import { ref as vueRef } from "vue";

interface P {
  ticketId: string;
}
const router = useRouter();

const props = defineProps<P>();
const ticket = useTicket(
  props.ticketId,
  true,
  null,
  (data) => {
    setupCustomizations(ticket, {
      doc: data,
      call,
      router,
      toast,
      $dialog,
      updateField,
      createToast: toast.create,
    });
  },
  () => {
    toast.error("Ticket not found");
    router.replace("/my-tickets");
  }
);
provide(ITicket, ticket);
const editor = ref(null);
const editorContent = ref("");
const attachments = ref([]);
const showFeedbackDialog = ref(false);
const isExpanded = ref(false);
const tabIndex = vueRef(0);

const { isMobileView } = useScreenSize();
const { $dialog } = globalStore();
const authStore = useAuthStore();
const { userId } = storeToRefs(authStore);

// Fallback to session user from cookie if auth store not loaded yet
const sessionUser = computed(() => {
  const cookies = new URLSearchParams(document.cookie.split("; ").join("&"));
  let _sessionUser = cookies.get("user_id");
  if (_sessionUser === "Guest") {
    _sessionUser = null;
  }
  return _sessionUser;
});

const currentUserId = computed(() => userId.value || sessionUser.value);

const send = createResource({
  url: "run_doc_method",
  debounce: 300,
  makeParams: () => ({
    dt: "HD Ticket",
    dn: props.ticketId,
    method: "create_communication_via_contact",
    args: {
      message: editorContent.value,
      attachments: attachments.value,
    },
  }),
  onSuccess: () => {
    editor.value.editor.commands.clearContent(true);
    attachments.value = [];
    isExpanded.value = false;
    ticket.reload();
  },
});

function updateField(name, value, callback = () => {}) {
  updateTicket(name, value);
  callback();
}

function sendEmail() {
  if (isContentEmpty(editorContent.value) || send.loading) {
    return;
  }
  send.submit();
}

function updateTicket(fieldname: string, value: string) {
  createResource({
    url: "frappe.client.set_value",
    params: {
      doctype: "HD Ticket",
      name: props.ticketId,
      fieldname,
      value,
    },
    auto: true,
    onSuccess: () => {
      ticket.reload();
      toast.success("Ticket updated");
    },
  });
}

const isRaiser = computed(() => {
  if (!ticket.data || !currentUserId.value) return false;
  return currentUserId.value === ticket.data.raised_by;
});

const canCloseTicket = computed(() => {
  if (!ticket.data || !currentUserId.value) return false;

  // In customer portal, user can close if they are the raised_by user
  // The backend sets raised_by to the correct user (either the person who created it,
  // or the employee for whom it was raised)
  if (ticket.data.raised_by === currentUserId.value) {
    return true;
  }

  return false;
});

const canRequestClosure = computed(() => {
  if (!ticket.data || !currentUserId.value) return false;

  // Ticket already closed - no action needed
  if (ticket.data.status === 'Closed') {
    return false;
  }

  // In customer portal, users don't request closure
  // They either can close or they can't do anything
  return false;
});

const hasValidResolution = computed(() => {
  if (!ticket.data) return false;

  // Check if resolution was submitted
  if (ticket.data.resolution_submitted) {
    return true;
  }

  // Check if resolution details exist and are not empty/default
  const resolution = ticket.data.resolution_details;
  return resolution &&
         resolution.trim() &&
         resolution.trim() !== '<p></p>' &&
         resolution.trim() !== '';
});

const canRejectResolution = computed(() => {
  if (!ticket.data || !currentUserId.value) return false;

  // Only allow rejection if ticket is Requested Closure or Closed with resolution
  if (ticket.data.status !== 'Requested Closure' && ticket.data.status !== 'Closed') {
    return false;
  }

  // Must have resolution to reject and it must have been submitted at least once
  if (!ticket.data.resolution_details || !ticket.data.resolution_details.trim()) {
    return false;
  }
  
  if (!ticket.data.resolution_ever_submitted) {
    return false;
  }

  // User can reject if they are the raised_by user
  if (ticket.data.raised_by === currentUserId.value) {
    return true;
  }

  return false;
});

const canReopenTicket = computed(() => {
  if (!ticket.data || !currentUserId.value) return false;

  // Only allow reopening of closed or resolved tickets without resolution
  if (ticket.data.status !== 'Closed' && ticket.data.status !== 'Requested Closure') {
    return false;
  }

  // If there's a resolution, use reject resolution instead
  if (ticket.data.resolution_details && ticket.data.resolution_details.trim()) {
    return false;
  }

  // User can reopen if they are the raised_by user
  if (ticket.data.raised_by === currentUserId.value) {
    return true;
  }

  return false;
});

async function triggerClose() {
  console.log('[triggerClose] Called. Current status:', ticket.data.status);
  console.log('[triggerClose] Resolution details:', ticket.data.resolution_details);

  // Validate that resolution exists before allowing close
  const hasResolution = ticket.data.resolution_details &&
                       ticket.data.resolution_details.trim() &&
                       ticket.data.resolution_details.trim() !== '<p></p>';

  console.log('[triggerClose] hasResolution:', hasResolution);

  // Check if resolution details are already filled
  if (hasResolution) {
    // Resolution details exist, directly close the ticket
    console.log('[triggerClose] Has resolution, closing directly');
    try {
      await call("frappe.client.set_value", {
        doctype: "HD Ticket",
        name: props.ticketId,
        fieldname: "status",
        value: "Closed",
      });
      console.log('[triggerClose] Ticket closed successfully');
      toast.success("Ticket closed successfully");
      ticket.reload();
    } catch (err) {
      console.error('[triggerClose] Error closing ticket:', err);
      toast.error(err.message || "Failed to close ticket");
    }
    return;
  }

  $dialog({
    title: "Close Ticket",
    message: "Please provide resolution details to close this ticket.",
    actions: [],
    render: ({ close }) => {
      const notes = ref("");
      const isLoading = ref(false);
      const error = ref("");

      return h("div", { class: "flex flex-col gap-3" }, [
        error.value && h("div", {
          class: "text-red-600 text-sm p-2 bg-red-50 border border-red-200 rounded"
        }, error.value),
        h(FormControl, {
          type: "textarea",
          placeholder: "Describe how this ticket was resolved...",
          rows: 4,
          modelValue: notes.value,
          "onUpdate:modelValue": (v: string) => {
            notes.value = v;
            error.value = "";
          },
        }),
        h("div", { class: "flex gap-2 justify-end" }, [
          h(
            Button,
            {
              variant: "subtle",
              label: "Cancel",
              onClick: close,
            },
            {}
          ),
          h(
            Button,
            {
              variant: "solid",
              theme: "red",
              label: "Close Ticket",
              loading: isLoading.value,
              onClick: async () => {
                if (!notes.value.trim()) {
                  error.value = "Resolution details are required";
                  return;
                }

                try {
                  isLoading.value = true;
                  await call("helpdesk.helpdesk.doctype.hd_ticket.ticket_closure_workflow.mark_as_resolved", {
                    ticket_id: props.ticketId,
                    resolution_notes: notes.value,
                  });
                  toast.success("Ticket closed successfully");
                  ticket.reload();
                  close();
                } catch (err) {
                  error.value = err.message || "Failed to close ticket";
                } finally {
                  isLoading.value = false;
                }
              },
            },
            {}
          ),
        ]),
      ]);
    },
  });
}

function triggerResolve() {
  $dialog({
    title: "Resolve Ticket",
    message: "Provide detailed resolution information below.",
    actions: [],
    render: ({ close }) => {
      const resolutionDetails = ref(`Resolution Summary

Issue: Brief description of the problem

Solution:
- Step 1: What was done
- Step 2: Additional actions taken

Result: Issue resolved successfully

Notes: Any additional information...`);
      const isLoading = ref(false);
      const error = ref("");

      return h("div", { class: "flex flex-col gap-3" }, [
        error.value && h("div", {
          class: "text-red-600 text-sm p-2 bg-red-50 border border-red-200 rounded"
        }, error.value),
        h("div", { class: "text-sm text-gray-600 mb-2" }, "Provide detailed resolution information."),
        h(FormControl, {
          type: "textarea",
          placeholder: "Provide detailed resolution information...",
          rows: 8,
          modelValue: resolutionDetails.value,
          "onUpdate:modelValue": (v: string) => {
            resolutionDetails.value = v;
            error.value = "";
          },
        }),
        h("div", { class: "flex gap-2 justify-end mt-4" }, [
          h(
            Button,
            {
              variant: "subtle",
              label: "Cancel",
              onClick: close,
            },
            {}
          ),
          h(
            Button,
            {
              variant: "solid",
              theme: "green",
              label: "Resolve Ticket",
              loading: isLoading.value,
              onClick: async () => {
                if (!resolutionDetails.value.trim() || resolutionDetails.value.trim() === "<p></p>") {
                  error.value = "Resolution details are required";
                  return;
                }

                try {
                  isLoading.value = true;
                  await call("helpdesk.helpdesk.doctype.hd_ticket.ticket_closure_workflow.mark_as_resolved", {
                    ticket_id: props.ticketId,
                    resolution_notes: resolutionDetails.value,
                  });
                  toast.success("Ticket resolved successfully");
                  ticket.reload();
                  close();
                } catch (err) {
                  error.value = err.message || "Failed to resolve ticket";
                } finally {
                  isLoading.value = false;
                }
              },
            },
            {}
          ),
        ]),
      ]);
    },
  });
}

function triggerRequestClosure() {
  $dialog({
    title: "Request Closure",
    message: "Request that this ticket be closed by providing resolution details.",
    actions: [],
    render: ({ close }) => {
      const notes = ref("");
      const isLoading = ref(false);
      const error = ref("");

      return h("div", { class: "flex flex-col gap-3" }, [
        error.value && h("div", {
          class: "text-red-600 text-sm p-2 bg-red-50 border border-red-200 rounded"
        }, error.value),
        h(FormControl, {
          type: "textarea",
          placeholder: "Describe how this ticket was resolved...",
          rows: 4,
          modelValue: notes.value,
          "onUpdate:modelValue": (v: string) => {
            notes.value = v;
            error.value = "";
          },
        }),
        h("div", { class: "flex gap-2 justify-end" }, [
          h(
            Button,
            {
              variant: "subtle",
              label: "Cancel",
              onClick: close,
            },
            {}
          ),
          h(
            Button,
            {
              variant: "solid",
              theme: "gray",
              label: "Request Closure",
              loading: isLoading.value,
              onClick: async () => {
                if (!notes.value.trim()) {
                  error.value = "Resolution details are required";
                  return;
                }

                try {
                  isLoading.value = true;
                  await call("helpdesk.helpdesk.doctype.hd_ticket.ticket_closure_workflow.request_closure", {
                    ticket_id: props.ticketId,
                    resolution_notes: notes.value,
                  });
                  toast.success("Closure request submitted successfully");
                  ticket.reload();
                  close();
                } catch (err) {
                  error.value = err.message || "Failed to submit closure request";
                } finally {
                  isLoading.value = false;
                }
              },
            },
            {}
          ),
        ]),
      ]);
    },
  });
}

function triggerRejectResolution() {
  $dialog({
    title: "Reject Resolution",
    message: "Please explain why this resolution doesn't solve your issue.",
    actions: [],
    render: ({ close }) => {
      const reason = ref("");
      const isLoading = ref(false);
      const error = ref("");

      return h("div", { class: "flex flex-col gap-3" }, [
        error.value && h("div", {
          class: "text-red-600 text-sm p-2 bg-red-50 border border-red-200 rounded"
        }, error.value),
        h("div", { class: "text-sm text-gray-600 mb-2" }, "Explain why the provided resolution doesn't solve your issue."),
        h(FormControl, {
          type: "textarea",
          placeholder: "The resolution provided doesn't solve my issue because...",
          rows: 4,
          modelValue: reason.value,
          "onUpdate:modelValue": (v: string) => {
            reason.value = v;
            error.value = "";
          },
        }),
        h("div", { class: "flex gap-2 justify-end" }, [
          h(
            Button,
            {
              variant: "subtle",
              label: "Cancel",
              onClick: close,
            },
            {}
          ),
          h(
            Button,
            {
              variant: "solid",
              theme: "red",
              label: "Reject Resolution",
              loading: isLoading.value,
              onClick: async () => {
                if (!reason.value.trim()) {
                  error.value = "Please provide a reason for rejection";
                  return;
                }

                try {
                  isLoading.value = true;
                  await call("pw_helpdesk.customizations.ticket_closure_workflow.reject_resolution", {
                    ticket_id: props.ticketId,
                    rejection_reason: reason.value,
                  });
                  toast.success("Resolution rejected and ticket reopened");
                  ticket.reload();
                  close();
                } catch (err) {
                  error.value = err.message || "Failed to reject resolution";
                } finally {
                  isLoading.value = false;
                }
              },
            },
            {}
          ),
        ]),
      ]);
    },
  });
}

function triggerReopen() {
  $dialog({
    title: "Reopen Ticket",
    message: "Please provide a reason for reopening this ticket.",
    actions: [],
    render: ({ close }) => {
      const reason = ref("");
      const isLoading = ref(false);
      const error = ref("");

      return h("div", { class: "flex flex-col gap-3" }, [
        error.value && h("div", {
          class: "text-red-600 text-sm p-2 bg-red-50 border border-red-200 rounded"
        }, error.value),
        h("div", { class: "text-sm text-gray-600 mb-2" }, "Explain why this ticket needs to be reopened."),
        h(FormControl, {
          type: "textarea",
          placeholder: "The resolution provided doesn't solve my issue because...",
          rows: 4,
          modelValue: reason.value,
          "onUpdate:modelValue": (v: string) => {
            reason.value = v;
            error.value = "";
          },
        }),
        h("div", { class: "flex gap-2 justify-end" }, [
          h(
            Button,
            {
              variant: "subtle",
              label: "Cancel",
              onClick: close,
            },
            {}
          ),
          h(
            Button,
            {
              variant: "solid",
              theme: "blue",
              label: "Reopen Ticket",
              loading: isLoading.value,
              onClick: async () => {
                if (!reason.value.trim()) {
                  error.value = "Please provide a reason for reopening";
                  return;
                }

                try {
                  isLoading.value = true;
                  await call("helpdesk.helpdesk.doctype.hd_ticket.ticket_closure_workflow.reopen_ticket", {
                    ticket_id: props.ticketId,
                    reopen_reason: reason.value,
                  });
                  toast.success("Ticket reopened successfully");
                  ticket.reload();
                  close();
                } catch (err) {
                  error.value = err.message || "Failed to reopen ticket";
                } finally {
                  isLoading.value = false;
                }
              },
            },
            {}
          ),
        ]),
      ]);
    },
  });
}

const setValue = createResource({
  url: "frappe.client.set_value",
  debounce: 300,
  makeParams: (params) => {
    return {
      doctype: "HD Ticket",
      name: props.ticketId,
      fieldname: params.fieldname,
      value: params.value,
    };
  },
  onSuccess: () => {
    showFeedbackDialog.value = false;
    ticket.reload();
  },
});

const breadcrumbs = computed(() => {
  let items = [{ label: "Tickets", route: { name: "TicketsCustomer" } }];
  items.push({
    label: ticket.data?.subject,
    route: { name: "TicketCustomer" },
  });
  return items;
});

const tabs = computed(() => {
  const baseTabs = [
    {
      name: "conversation",
      label: "Conversation",
      icon: ActivityIcon,
    },
  ];
  
  // Only show Resolution tab if ticket has been replied to or is in later stages
  const allowedStatuses = ["Awaiting User Response", "Requested Closure", "Closed", "Reopened"];
  if (ticket.data && allowedStatuses.includes(ticket.data.status)) {
    baseTabs.push({
      name: "resolution",
      label: "Resolution",
      icon: TicketIcon,
    });
  }
  
  return baseTabs;
});

const showEditor = computed(() => ticket.data.status !== "Closed");

// this handles whether the ticket was raised and then was closed without any reply from the agent.
const { isFeedbackMandatory } = useConfigStore();
const showFeedback = computed(() => {
  const hasAgentCommunication = ticket.data?.communications?.some(
    (c) => c.sender !== ticket.data.raised_by
  );
  return hasAgentCommunication && isFeedbackMandatory;
});

onMounted(() => {
  document.title = props.ticketId;
  socket.on("helpdesk:ticket-update", (ticketID) => {
    if (ticketID === Number(props.ticketId)) {
      ticket.reload();
    }
  });
});

// Debug button visibility
watch(
  () => ticket.data,
  (val) => {
    if (val) {
      console.log('=== TICKET CUSTOMER DEBUG ===');
      console.log('userId (from store):', userId.value);
      console.log('sessionUser (from cookie):', sessionUser.value);
      console.log('currentUserId (computed):', currentUserId.value);
      console.log('Ticket raised_by:', val.raised_by);
      console.log('Ticket custom_raise_for_employee:', val.custom_raise_for_employee);
      console.log('Ticket status:', val.status);
      console.log('isRaiser:', isRaiser.value);
      console.log('canCloseTicket:', canCloseTicket.value);
      console.log('canRequestClosure:', canRequestClosure.value);
      console.log('=============================');
    }
  },
  { deep: true, immediate: true }
);

onUnmounted(() => {
  document.title = "Helpdesk";
  socket.off("helpdesk:ticket-update");
});
</script>
