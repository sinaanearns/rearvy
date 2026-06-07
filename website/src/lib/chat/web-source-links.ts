import { normalizeHttpUrl } from "./url-normalization";

export function normalizeWebSourceUrl(value: string) {
  return normalizeHttpUrl(value);
}
