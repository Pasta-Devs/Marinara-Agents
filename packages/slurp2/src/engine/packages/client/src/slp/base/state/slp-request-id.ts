/** `crypto.randomUUID` exists only in a secure context; a plain-HTTP LAN Engine does not have one. */
export const newRequestId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
