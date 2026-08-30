import { ref } from "vue";
import { createResource } from "frappe-ui";

const APP = "helpdesk";
const SITENAME = window.location.hostname;
const POSTHOG_SCRIPT_SRC = "/assets/frappe/js/lib/posthog.js";

interface PosthogInstance {
  init?: (projectId: string, options: Record<string, unknown>) => void;
  identify?: (id: string) => void;
  capture?: (event: string, options?: Record<string, unknown>) => void;
  startSessionRecording?: () => void;
  stopSessionRecording?: () => void;
  sessionRecordingStarted?: () => boolean;
  __loaded?: boolean;
}

declare global {
  interface Window {
    posthog?: PosthogInstance;
  }
}

type PosthogSettings = {
  posthog_project_id: string;
  posthog_host: string;
  enable_telemetry: boolean;
  telemetry_site_age: number;
};

const telemetry = ref({
  enabled: false,
  project_id: "",
  host: "",
});

let posthogScriptPromise: Promise<void> | null = null;

const posthogSettings = createResource({
  url: "helpdesk.api.telemetry.get_posthog_settings",
  cache: "posthog_settings",
  onSuccess: (ps: PosthogSettings) => init(ps),
});

function isTelemetryEnabled(ps?: PosthogSettings) {
  const settings = ps || posthogSettings.data;
  if (!settings) return false;

  return Boolean(
    settings.enable_telemetry &&
      settings.posthog_project_id &&
      settings.posthog_host
  );
}

function loadPosthog() {
  if (window.posthog?.init) return Promise.resolve();

  if (!posthogScriptPromise) {
    posthogScriptPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = POSTHOG_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });
  }

  return posthogScriptPromise;
}

export async function init(ps: PosthogSettings) {
  if (!isTelemetryEnabled(ps)) return;

  await loadPosthog();

  const posthog = window.posthog;
  if (!posthog?.init) return;

  telemetry.value.enabled = true;
  telemetry.value.project_id = ps.posthog_project_id;
  telemetry.value.host = ps.posthog_host;

  posthog.init(ps.posthog_project_id, {
    api_host: ps.posthog_host,
    autocapture: false,
    person_profiles: "identified_only",
    disable_session_recording: true,
    advanced_disable_decide: true,
    loaded: (ph: PosthogInstance) => {
      window.posthog = ph;
      ph.identify?.(SITENAME);
    },
  });
}

interface CaptureOptions {
  data: {
    user?: string;
    [key: string]: string | number | boolean | object | undefined;
  };
}

export function capture(
  event: string,
  options: CaptureOptions = { data: { user: "" } }
) {
  if (!isTelemetryEnabled()) return;
  window.posthog?.capture?.(`${APP}_${event}`, options);
}

export function recordSession() {
  if (!telemetry.value.enabled) return;
  if (window.posthog?.__loaded) {
    window.posthog.startSessionRecording?.();
  }
}

export function stopSession() {
  if (!telemetry.value.enabled) return;
  if (window.posthog?.__loaded && window.posthog.sessionRecordingStarted?.()) {
    window.posthog.stopSessionRecording?.();
  }
}

export function posthogPlugin(app: any) {
  app.config.globalProperties.posthog = window.posthog;
  if (!window.posthog?.__loaded) posthogSettings.fetch();
}