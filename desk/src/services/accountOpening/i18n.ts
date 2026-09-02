/**
 * Typed access to the global translator, which is only typed inside `.vue`
 * templates. Falls back to the source string when called before the plugin has
 * installed `__`, and to the message itself for `{0}`-style strings, where the
 * plugin returns a `{ format }` object rather than a string.
 */

type TranslateFn = (message: string) => string | { format: (...args: string[]) => string };

export function t(message: string): string {
  const translate = (globalThis as { __?: TranslateFn }).__;
  if (typeof translate !== "function") return message;

  const result = translate(message);
  return typeof result === "string" ? result : message;
}
