// Real Gmail over REST. Only ever runs inside deployed functions; tests and the emulator use fakeTransport.
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export function assertDeployed(env = process.env) {
  if (!env.K_SERVICE || env.FUNCTIONS_EMULATOR === "true" || env.NODE_ENV === "test") {
    throw new Error("Real Gmail is disabled outside deployed functions");
  }
}

const authError = (message) => Object.assign(new Error(message), { code: "auth" });
const b64url = (s) => Buffer.from(s).toString("base64url");
const header = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString("base64")}?=`);

export function rawMessage(msg) {
  const lines = [`From: ${msg.from}`, `To: ${msg.to}`, `Subject: ${header(msg.subject ?? "")}`];
  if (msg.inReplyTo) lines.push(`In-Reply-To: ${msg.inReplyTo}`, `References: ${msg.inReplyTo}`);
  lines.push("MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "");
  lines.push(Buffer.from(msg.body ?? "").toString("base64").replace(/.{76}/g, "$&\r\n"));
  return b64url(lines.join("\r\n"));
}

export function gmailTransport({ clientId, clientSecret, refreshToken }) {
  assertDeployed();
  let token;

  async function accessToken() {
    if (token) return token;
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (body.error === "invalid_grant" || res.status === 400 || res.status === 401) throw authError(body.error_description ?? "Gmail authorisation expired");
      throw new Error(`Token refresh failed (${res.status})`);
    }
    return (token = body.access_token);
  }

  async function call(path, init = {}) {
    const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" } });
    if (res.status === 401) throw authError("Gmail rejected the token");
    if (!res.ok) throw Object.assign(new Error(`Gmail ${res.status}`), { status: res.status });
    return res.json();
  }

  return {
    async send(msg) {
      assertDeployed();
      const body = { raw: rawMessage(msg) };
      if (msg.threadId) body.threadId = msg.threadId;
      const out = await call("/messages/send", { method: "POST", body: JSON.stringify(body) });
      return { messageId: out.id, threadId: out.threadId };
    },

    async listNewMessages(cursor) {
      assertDeployed();
      if (!cursor) return { messages: [], nextCursor: (await call("/profile")).historyId };
      let hist;
      try {
        hist = await call(`/history?startHistoryId=${encodeURIComponent(cursor)}&historyTypes=messageAdded`);
      } catch (e) {
        if (e.status === 404) return { messages: [], nextCursor: (await call("/profile")).historyId }; // cursor too old
        throw e;
      }
      const ids = [...new Set((hist.history ?? []).flatMap((h) => (h.messagesAdded ?? []).map((m) => m.message.id)))];
      const messages = [];
      for (const id of ids) {
        const m = await call(`/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=In-Reply-To&metadataHeaders=References&metadataHeaders=Auto-Submitted&metadataHeaders=X-Autoreply&metadataHeaders=Precedence`);
        const headers = Object.fromEntries((m.payload?.headers ?? []).map((h) => [h.name.toLowerCase(), h.value]));
        messages.push({ id: m.id, threadId: m.threadId, from: headers.from, subject: headers.subject, headers });
      }
      return { messages, nextCursor: hist.historyId ?? cursor };
    },
  };
}
