const addr = (s) => String(s ?? "").trim().toLowerCase();

// null when the entry may go out, otherwise the reason it must not.
export function canSend(entry, station, sends) {
  if (!station?.email || addr(station.email) !== addr(entry.to)) return "Station email does not match the recipient";
  if (station.rec?.dnc) return "Station is marked do-not-contact";
  if (station.rec?.bounced) return "This address has bounced";
  if (entry.kind === "pitch" && sends.some((s) => s.id === entry.id && s.song === entry.song && s.kind === "pitch")) {
    return "Already pitched for this song";
  }
  return null;
}

const LOGO_CID = "cid:logo@floodlines";
const LOGO_TYPES = ["image/png", "image/jpeg", "image/gif"];
const MAX_LOGO = 200 * 1024;

// The saved signature and logo as a message carries them, or {} when there's no usable signature.
export function signatureFrom(settings) {
  const sig = settings?.signature;
  if (!sig?.html || !sig?.text) return {};
  if (!sig.html.includes(LOGO_CID)) return { signature: { html: sig.html, text: sig.text } };
  const { logo } = settings;
  const data = logo?.data ? Buffer.from(logo.data, "base64") : null;
  if (data?.length && data.length <= MAX_LOGO && LOGO_TYPES.includes(logo.mimeType)) {
    return { signature: { html: sig.html, text: sig.text }, logo: { name: logo.name, mimeType: logo.mimeType, data } };
  }
  return { signature: { html: sig.html.replace(/<img\b[^>]*cid:logo@floodlines[^>]*>/gi, ""), text: sig.text } };
}

export function buildMessage(entry, from, priorSend, attachments, { signature, logo } = {}) {
  const msg = { from, to: entry.to, subject: entry.subject, body: entry.body };
  if (signature) msg.signature = signature;
  if (logo) msg.logo = logo;
  if (entry.kind === "followup" && priorSend) {
    msg.threadId = priorSend.threadId;
    msg.inReplyTo = priorSend.messageId;
  }
  if (entry.kind === "pitch" && attachments?.length) msg.attachments = attachments;
  return msg;
}
