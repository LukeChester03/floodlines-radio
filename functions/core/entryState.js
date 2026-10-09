// What a client may write to sendlist entries: only `state` (approved or review) plus the who/when stamp.
export function entryStateWrites(keys, state, user, now = new Date()) {
  if (state !== "approved" && state !== "review") throw new Error(`Clients can't set state ${state}`);
  return keys.map(k => ({
    path: `sendlist/${k}`,
    data: { state, updatedAt: now.toISOString(), updatedBy: user?.email || null },
  }));
}
