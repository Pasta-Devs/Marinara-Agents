// Quartermaster — client-side fetch helpers for the package's own privileged
// routes (server.mjs). QM is the shared namespace concatenated files use to
// talk to each other, the way Beholder's src/*.js share BH.

const QM = {};

async function qmRequest(path, options) {
  const response = await fetch(`/api/quartermaster${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((body && body.error) || `Request failed (${response.status})`);
  }
  return body;
}

QM.listItems = (chatId, ownerId) =>
  qmRequest(`/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}`, { method: "GET" });

QM.addItem = (chatId, ownerId, item) =>
  qmRequest(`/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/items`, {
    method: "POST",
    body: JSON.stringify(item),
  });

QM.updateItem = (chatId, ownerId, itemId, patch) =>
  qmRequest(
    `/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/items/${encodeURIComponent(itemId)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );

QM.deleteItem = (chatId, ownerId, itemId) =>
  qmRequest(
    `/inventory/${encodeURIComponent(chatId)}/${encodeURIComponent(ownerId)}/items/${encodeURIComponent(itemId)}`,
    { method: "DELETE" },
  );
