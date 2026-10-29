// Real Gmail over REST. Only ever runs inside deployed functions; tests and the emulator use fakeTransport.
import { randomUUID } from "node:crypto";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export function assertDeployed(env = process.env) {
  if (!env.K_SERVICE || env.FUNCTIONS_EMULATOR === "true" || env.NODE_ENV === "test") {
    throw new Error("Real Gmail is disabled outside deployed functions");
  }
}

const authError = (message) => Object.assign(new Error(message), { code: "auth" });
const b64url = (s) => Buffer.from(s).toString("base64url");
const header = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString("base64")}?=`);

const wrap = (buf) => buf.toString("base64").replace(/.{76}/g, "$&\r\n");

function filenameParams(name) {
  if (/^[\x20-\x7e]*$/.test(name)) return `filename="${name.replace(/["\\]/g, "\\$&")}"`;
  return `filename="${header(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

const leaf = (type, buf, extra = []) => [`Content-Type: ${type}`, ...extra, "Content-Transfer-Encoding: base64", "", wrap(Buffer.from(buf))];

function multipart(type, parts) {
  const boundary = `=_floodlines_${randomUUID()}`;
  return [`Content-Type: multipart/${type}; boundary="${boundary}"`, "", ...parts.flatMap((p) => [`--${boundary}`, ...p]), `--${boundary}--`, ""];
}

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot", "'": "#39" }[c]};`);

// The body, with the signature (and its inline logo) when there is one.
function bodyPart(msg) {
  const body = msg.body ?? "";
  const { signature, logo } = msg;
  if (!signature) return leaf("text/plain; charset=UTF-8", body);
  const text = leaf("text/plain; charset=UTF-8", `${body}\n\n${signature.text}`);
  const html = leaf("text/html; charset=UTF-8", `${escapeHtml(body).replace(/\r\n|\r|\n/g, "<br>")}<br><br>${signature.html}`);
  if (!logo) return multipart("alternative", [text, html]);
  const image = leaf(logo.mimeType, logo.data, ["Content-ID: <logo@floodlines>", `Content-Disposition: inline; ${filenameParams(logo.name)}`]);
  return multipart("alternative", [text, multipart("related", [html, image])]);
}

export function rawMessage(msg) {
  const lines = [`From: ${msg.from}`, `To: ${msg.to}`, `Subject: ${header(msg.subject ?? "")}`];
  if (msg.inReplyTo) lines.push(`In-Reply-To: ${msg.inReplyTo}`, `References: ${msg.inReplyTo}`);
  lines.push("MIME-Version: 1.0");
  if (!msg.attachments?.length) return b64url([...lines, ...bodyPart(msg)].join("\r\n"));
  const files = msg.attachments.map((a) => leaf(a.mimeType, a.data, [`Content-Disposition: attachment; ${filenameParams(a.name)}`]));
  return b64url([...lines, ...multipart("mixed", [bodyPart(msg), ...files])].join("\r\n"));
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
