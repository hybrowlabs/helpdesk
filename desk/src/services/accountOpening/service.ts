/**
 * Account Opening — service resolution.
 *
 * The only place that decides whether the app talks to mock data or the live
 * backend. Consumers call `getAccountOpeningService()` and never reference a
 * concrete adapter.
 *
 * The live provider is the default. `VITE_ACCOUNT_OPENING_SOURCE=mock` at build
 * time swaps in the fixture adapter, which exists for working offline and for
 * exercising the empty and error branches — it is not a product mode.
 *
 * Kept separate from `index.ts` so the composable can import the resolver
 * without cycling through the barrel.
 */
import { HttpAccountOpeningService } from "./api";
import { MockAccountOpeningService } from "./mock";
import type { AccountOpeningService } from "./types";

export type AccountOpeningSource = "mock" | "api";

const DEFAULT_SOURCE: AccountOpeningSource = "api";

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
