/**
 * Account Opening — service resolution.
 *
 * The only place that decides whether the app talks to mock data or the live
 * backend. Consumers call `getAccountOpeningService()` and never reference a
 * concrete adapter.
 *
 * Switching to the real API:
 *   1. Ship the `pc_helpdesk` endpoints (see
 *      `pc_helpdesk/customizations/api/account_opening.py`).
 *   2. Set `VITE_ACCOUNT_OPENING_SOURCE=api` in the desk build environment,
 *      or flip `DEFAULT_SOURCE` below.
 * No component, type, or presenter change is required.
 *
 * Kept separate from `index.ts` so the composable can import the resolver
 * without cycling through the barrel.
 */
import { HttpAccountOpeningService } from "./api";
import { MockAccountOpeningService } from "./mock";
import type { AccountOpeningService } from "./types";

export type AccountOpeningSource = "mock" | "api";

const DEFAULT_SOURCE: AccountOpeningSource = "mock";

function configuredSource(): AccountOpeningSource {
  const fromEnv = import.meta.env?.VITE_ACCOUNT_OPENING_SOURCE;
  return fromEnv === "api" || fromEnv === "mock" ? fromEnv : DEFAULT_SOURCE;
}

let instance: AccountOpeningService | null = null;

export function getAccountOpeningService(): AccountOpeningService {
  if (!instance) {
    instance =
      configuredSource() === "api"
        ? new HttpAccountOpeningService()
        : new MockAccountOpeningService();
  }
  return instance;
}

/** Override the adapter — for tests or a runtime demo toggle. */
export function setAccountOpeningService(
  service: AccountOpeningService | null
): void {
  instance = service;
}

export function isUsingMockData(): boolean {
  return configuredSource() === "mock";
}
