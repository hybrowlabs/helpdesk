import { createResource } from "frappe-ui";
import { ref } from "vue";
import LucideBookOpen from "~icons/lucide/book-open";
import LucideUsers from "~icons/lucide/users";
import LucideTicket from "~icons/lucide/ticket";
import LucideLayoutDashboard from "~icons/lucide/layout-dashboard";
import LucideFileBarChart from "~icons/lucide/file-bar-chart";
import { OrganizationsIcon } from "../icons";
import PhoneIcon from "../icons/PhoneIcon.vue";
import LucideHome from "~icons/lucide/home";
import { __ } from "@/translation";

/**
 * Shared rather than local to Sidebar.vue: the command palette opens it too, and
 * the palette is the discovery surface for the shortcut system.
 */
export const showShortcutsModal = ref(false);

/**
 * Reports this user may open. Shared by the sidebar and the command palette so
 * neither offers a Reports entry that lands on an empty page. One resource, so
 * the list is fetched once rather than per surface.
 */
export const permittedReports = createResource({
  url: "helpdesk.api.report.get_permitted_reports",
  cache: "permittedReports",
  auto: true,
});

export const agentPortalSidebarOptions = [
  {
    label: __("Home"),
    icon: LucideHome,
    to: "Home",
  },
  {
    label: __("Dashboard"),
    icon: LucideLayoutDashboard,
    to: "Dashboard"
  },
  {
    label: __("Tickets"),
    icon: LucideTicket,
    to: "TicketsAgent",
  },
  {
    label: __("Knowledge Base"),
    icon: LucideBookOpen,
    to: "AgentKnowledgeBase",
  },
  {
    label: __("Customers"),
    icon: OrganizationsIcon,
    to: "CustomerList",
  },
  {
    label: __("Contacts"),
    icon: LucideUsers,
    to: "ContactList",
  },
  {
    label: __("Call Logs"),
    icon: PhoneIcon,
    to: "CallLogs",
  },
  {
    label: __("Reports"),
    icon: LucideFileBarChart,
    to: "Reports",
  },
];

export const customerPortalSidebarOptions = [
  {
    label: __("Tickets"),
    icon: LucideTicket,
    to: "TicketsCustomer",
  },
  {
    label: __("Knowledge Base"),
    icon: LucideBookOpen,
    to: "CustomerKnowledgeBase",
  },
];
