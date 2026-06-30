import { computed, ref, watchEffect } from "vue";
import { defineStore } from "pinia";
import { createResource } from "frappe-ui";

export const useTicketStatusStore = defineStore("ticketStatus", () => {
  const options = ref(["Open", "Awaiting User Response", "Closed", "Reopened", "Not Assigned", "Archived", "Requested Closure"]);
  const dropdown = computed(() =>
    options.value.map((o) => ({
      label: o,
      value: o,
    }))
  );
  const hdSettings = createResource({
    url: "frappe.client.get_value",
    cache: true,
    params: {
      doctype: "HD Settings",
      fieldname: "make_agent_status_read_only",
    },
    auto: true,
  })

  const makeAgentStatusReadOnly = computed(() => !!hdSettings.data?.make_agent_status_read_only);

  const colorMap = {
    Open: "red",
    "Awaiting User Response": "blue",
    "Awaiting Response": "indigo",
    Closed: "gray",
    Reopened: "orange",
    "Not Assigned": "yellow",
    Archived: "zinc",
    "Requested Closure": "purple",
  };

  const textColorMap = {
    Open: "!text-red-600",
    "Awaiting User Response": "!text-blue-600",
    "Awaiting Response": "!text-indigo-600",
    Closed: "!text-gray-700",
    Reopened: "!text-orange-600",
    "Not Assigned": "!text-yellow-600",
    Archived: "!text-zinc-600",
    "Requested Closure": "!text-purple-600",
  };

  const stateActive = ["Open", "Awaiting User Response", "Reopened", "Awaiting Response"];
  const stateInactive = ["Closed", "Archived", "Requested Closure"];

  return {
    colorMap,
    dropdown,
    options,
    stateActive,
    stateInactive,
    textColorMap,
    makeAgentStatusReadOnly
  };
});
