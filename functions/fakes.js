// In-memory MailTransport and store; tests and local runs use these, never Gmail or Firestore.
export function fakeTransport({ inbox = [] } = {}) {
  let n = 0;
  const sent = [];
  return {
    sent,
    async send(msg) {
      const addrs = [msg.to].flat().flatMap((a) => String(a ?? "").split(/[,;]/)).map((a) => a.trim()).filter(Boolean);
      if (addrs.length !== 1) throw new Error("One recipient per email");
      n += 1;
      const out = { messageId: `m${n}`, threadId: msg.threadId ?? `t${n}` };
      sent.push({ ...msg, ...out });
      return out;
    },
    async listNewMessages() {
      return { messages: [...inbox], nextCursor: String(inbox.length) };
    },
  };
}

export function fakeStore({ sendlist = [], stations = {}, sends = [], status = {} } = {}) {
  const list = sendlist.map((e) => ({ ...e }));
  const st = structuredClone(stations);
  const log = [...sends];
  let stat = { ...status };
  return {
    async listSendlist({ state } = {}) {
      return list.filter((e) => !state || e.state === state);
    },
    async updateEntry(key, patch) {
      const e = list.find((x) => x.key === key);
      if (e) Object.assign(e, patch);
    },
    async getStation(id) {
      return st[id];
    },
    async updateStation(id, patch) {
      st[id] = { ...st[id], rec: { ...st[id]?.rec, ...patch } };
    },
    async addSend(record) {
      log.push(record);
    },
    async listSends({ since = 0 } = {}) {
      return log.filter((s) => new Date(s.sentAt) >= since);
    },
    async getStatus() {
      return stat;
    },
    async setStatus(patch) {
      stat = { ...stat, ...patch };
    },
  };
}
