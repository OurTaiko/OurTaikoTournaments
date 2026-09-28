/** Accept only local application paths, including their query and fragment. */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/";
  const url = new URL(value, "https://tournaments.invalid");
  if (url.origin !== "https://tournaments.invalid" || /^\/(?:api|login)(?:\/|$)/.test(url.pathname)) return "/";
  return url.pathname + url.search + url.hash;
}
export function loginHref(returnTo: string) {
  return "/login?returnTo=" + encodeURIComponent(safeReturnTo(returnTo));
}
