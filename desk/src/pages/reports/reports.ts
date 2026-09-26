export type ReportStatus = "live" | "awaiting-api" | "in-development";

export interface ReportCard {
  title: string;
  description: string;
  fr: string;
  status: ReportStatus;
  // What PhillipCapital still owe us before the card can go live. Shown on the
  // card so the demo doubles as the ask list.
  blockedOn?: string;
}

export interface ReportGroup {
  title: string;
  subtitle: string;
  reports: ReportCard[];
}

export const statusMeta: Record<
  ReportStatus,
  { label: string; theme: "green" | "orange" | "blue" }
> = {
  live: { label: "Connected", theme: "green" },
  "awaiting-api": { label: "Awaiting API", theme: "orange" },
  "in-development": { label: "In development", theme: "blue" },
};

export const reportGroups: ReportGroup[] = [
  {
    title: "PhillipCapital systems",
    subtitle:
      "Reports that already exist in Classplus and Tech+ Center. The helpdesk reads them over your API rather than keeping a second copy of the data.",
    reports: [
      {
        title: "Account Opening Lookup",
        description:
          "Pulls a client's account opening record by PAN or client code, straight into the ticket.",
        fr: "FR-10.4, FR-10.5",
        status: "live",
      },
      {
        title: "AOF Tracker Report",
        description:
          "Account opening details for a date range, the way the AOF Tracker Report shows them in Classplus.",
        fr: "FR-10.3",
        status: "awaiting-api",
        blockedOn: "An endpoint that returns AOF tracker rows for a date range.",
      },
      {
        title: "E-Assist KYC Completed",
        description:
          "The list of KYC forms clients have completed online, so an agent can pick one up without leaving the ticket.",
        fr: "FR-10.7",
        status: "awaiting-api",
        blockedOn: "An endpoint that lists completed E-Assist KYC forms.",
      },
      {
        title: "KYC Client PDF",
        description:
          "View and download the client's KYC PDF from the ticket itself.",
        fr: "FR-10.8",
        status: "awaiting-api",
        blockedOn: "An endpoint that returns the KYC PDF for a client.",
      },
      {
        title: "Client Modification Report",
        description:
          "Case tracking data by date. The detailed report stays in Classplus; the helpdesk only reads the tracking figures.",
        fr: "FR-14.5",
        status: "awaiting-api",
        blockedOn:
          "An endpoint for the Classplus Offline Client Modification Report.",
      },
    ],
  },
  {
    title: "MIS & Operational Monitoring",
    subtitle:
      "Built inside the helpdesk from your own case data, for the weekly HOD review. Filterable by executive, user, team, department, process type, date range, workflow type and status, with Excel and CSV export.",
    reports: [
      {
        title: "Executive-wise Workload",
        description: "Open, pending and closed cases per executive.",
        fr: "FR-17.4",
        status: "in-development",
      },
      {
        title: "Workflow Status",
        description: "Where every live case currently sits in its workflow.",
        fr: "FR-17.4",
        status: "in-development",
      },
      {
        title: "Pending Approval",
        description: "Cases waiting on an approver, and how long they have waited.",
        fr: "FR-17.4",
        status: "in-development",
      },
      {
        title: "Department Performance",
        description: "Volume and average resolution time per department.",
        fr: "FR-17.4",
        status: "in-development",
      },
      {
        title: "Weekly HOD Review",
        description: "The single sheet the weekly HOD review meeting runs on.",
        fr: "FR-17.6",
        status: "in-development",
      },
      {
        title: "Transmission Monitoring",
        description: "Death transmission cases by stage, claimant and age.",
        fr: "FR-17.4",
        status: "in-development",
      },
      {
        title: "Account Closure Monitoring",
        description:
          "Closure cases across departmental confirmations and the approval chain.",
        fr: "FR-17.4",
        status: "in-development",
      },
      {
        title: "Stock Transfer Monitoring",
        description: "Stock transfer cases, DIS status and target DP.",
        fr: "FR-17.4",
        status: "in-development",
      },
      {
        title: "Modification Workflow",
        description:
          "Modification cases by maker and checker level, with pending counts.",
        fr: "FR-17.4",
        status: "in-development",
      },
      {
        title: "Executive Productivity",
        description: "Cases handled, average handling time and rejection rate.",
        fr: "FR-17.4",
        status: "in-development",
      },
    ],
  },
];
