export const CSRF_HEADER = "x-marinara-csrf";
// Deliberately a public presence marker, not an authentication secret. Browser
// scripts can read bundled constants, so DNS-rebinding defense belongs at the
// server's Host boundary rather than in a randomized client header value.
export const CSRF_HEADER_VALUE = "1";
//# sourceMappingURL=security.js.map