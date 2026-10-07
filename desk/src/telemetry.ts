import { createResource } from "frappe-ui";

const APP = "helpdesk";

// The pulse client is served by pulse itself and loaded at runtime, so it does
// not depend on this app's (or the site's) framework version. `client_url` comes
// from the server config; the constant is only a fallback.
const DEFAULT_PULSE_CLIENT_URL =
  "https://pulse.m.frappe.cloud/assets/pulse/js/pulse_client.js";

type PulseBootConfig = {
  enabled: boolean;
  host?: string;
  client_url?: string;
  key?: string;
  site?: string;
  user?: string | null;
  team?: string | null;
  site_age?: number;
};

interface PulseClient {
  init: () => Promise<boolean>;
  capture: (
    event: string,
    app?: string,
    props?: Record<string, unknown>
  ) => void;
  flush: () => Promise<void> | undefined;
  stop: () => void;
}

let client: PulseClient | null = null;
let enabled = false;
// Events captured while the remote client module is still importing.
let pending: [string, Record<string, unknown>][] = [];

const telemetryConfig = createResource({
  url: "frappe.utils.telemetry.pulse.client.boot_config",
  cache: "pulse_boot_config",
  onSuccess: (config: PulseBootConfig) => init(config),
});

export async function init(config: PulseBootConfig) {
  if (!config?.enabled || client) return;

  // Buffer from here on: captures during the import window would otherwise be lost.
  enabled = true;

  try {
    // A runtime variable (not a literal) so the bundler leaves this as a real
    // runtime import of the remote module instead of trying to bundle it.
    const url = config.client_url || DEFAULT_PULSE_CLIENT_URL;
    const mod = await import(/* @vite-ignore */ url);

    client = new mod.PulseClient({
      host: config.host,
      apiKey: config.key,
      site: config.site,
      enabled: true,
      user: config.user,
      team: config.team,
    });
    await client.init();

    pending.forEach(([event, props]) => client!.capture(event, APP, props));
    pending = [];
  } catch {
    // Remote client unreachable: drop the provider instead of buffering forever.
    enabled = false;
    client = null;
    pending = [];
  }
}

interface CaptureOptions {
  data: {
    user?: string;
    [key: string]: string | number | boolean | object | undefined;
  };
}

export function capture(event: string, options: CaptureOptions = { data: {} }) {
  if (!enabled) return;

  const props = (options?.data || {}) as Record<string, unknown>;
  if (client) {
    client.capture(event, APP, props);
  } else {
    pending.push([event, props]);
  }
}

export function telemetryPlugin() {
  telemetryConfig.fetch();
}
