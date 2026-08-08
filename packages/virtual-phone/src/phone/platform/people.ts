import { phoneRequest } from "./api";

export interface RememberPersonInput {
  name: string;
  handle?: string;
  bio?: string;
  phoneLabel?: string;
  source: string;
  firstMessage?: string;
}

/** Make someone introduced by an app available to the rest of the phone. */
export async function rememberPerson(phoneId: string, input: RememberPersonInput) {
  const name = input.name.trim();
  if (!name) return null;
  return phoneRequest<{ contact: { id: string; name: string } }>(
    `/phones/${encodeURIComponent(phoneId)}/contacts`,
    { method: "POST", body: JSON.stringify({ ...input, name }) },
  );
}
