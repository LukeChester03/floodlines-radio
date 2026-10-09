// What the band should see about the Gmail connection, from the server's gmail/status doc.
export function gmailBanner(status) {
  if (!status?.connected) return { kind: "not-connected", text: "Gmail isn't connected, so sending is paused." };
  if (status.needsReconnect) return { kind: "reconnect", text: `Gmail needs reconnecting, so sending is paused. Sending from ${status.connected}.` };
  return { kind: "connected", text: `Sending from ${status.connected}` };
}
