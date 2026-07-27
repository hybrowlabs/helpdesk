/**
 * Typed access to the global translator.
 *
 * `translationPlugin` installs `__` on `window` at app boot, but it is only
 * *typed* on `ComponentCustomProperties` — i.e. inside `.vue` templates. This
 * wrapper gives plain `.ts` modules the same function with a real signature,
 * and degrades to the source string if it is called before the plugin runs.
 *
 * Only placeholder-free messages go through here, so the return is always a
 * string (the plugin returns a `{ format }` object for `{0}`-style messages).
 */

type TranslateFn = (message: string) => string | { format: (...args: string[]) => string };

export function t(message: string): string {
  const translate = (globalThis as { __?: TranslateFn }).__;
  if (typeof translate !== "function") return message;

  const result = translate(message);
  return typeof result === "string" ? result : message;
}
