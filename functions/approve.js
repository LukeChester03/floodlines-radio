// Approve the reviewed Send list. Nothing is sent here; the scheduled run drains approved entries.
export async function approveBatch({ keys }, { store, now = Date.now }) {
  const wanted = new Set(keys);
  const entries = (await store.listSendlist()).filter((e) => wanted.has(e.key) && (!e.state || e.state === "review"));
  const approvedAt = new Date(now()).toISOString();
  await Promise.all(entries.map((e) => store.updateEntry(e.key, { state: "approved", approvedAt })));
  return { approved: entries.length };
}

export function approvalSummary(entries) {
  return {
    emails: entries.length,
    stations: new Set(entries.map((e) => e.id)).size,
    songs: [...new Set(entries.map((e) => e.song))],
  };
}
