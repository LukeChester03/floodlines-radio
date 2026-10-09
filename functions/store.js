// Firestore Admin implementation of the same store methods as fakeStore.
// `stations` is the generated stations list; getStation joins its email onto the CRM record as { email, rec }.
export function firestoreStore(db, stations = []) {
  const emails = new Map(stations.map((s) => [s.id, s.email]));
  const data = (snap) => snap.docs.map((d) => ({ key: d.id, ...d.data() }));
  const status = db.doc("settings/status");
  return {
    async listSendlist({ state } = {}) {
      const col = db.collection("sendlist");
      return data(await (state ? col.where("state", "==", state) : col).get());
    },
    async updateEntry(key, patch) {
      await db.doc(`sendlist/${key}`).set(patch, { merge: true });
    },
    async getStation(id) {
      const s = await db.doc(`stations/${id}`).get();
      return emails.has(id) ? { email: emails.get(id), rec: s.exists ? s.data() : {} } : undefined;
    },
    async updateStation(id, patch) {
      await db.doc(`stations/${id}`).set(patch, { merge: true });
    },
    async addSend(record) {
      await db.collection("sends").add(record);
    },
    async listSends({ since = 0 } = {}) {
      return data(await db.collection("sends").where("sentAt", ">=", new Date(since).toISOString()).get());
    },
    async listStations() {
      return stations.map(({ id, email }) => ({ id, email }));
    },
    async addReply(reply) {
      try {
        await db.doc(`replies/${reply.id}`).create(reply);
        return true;
      } catch (e) {
        if (e.code === 6) return false; // ALREADY_EXISTS
        throw e;
      }
    },
    async listReplies() {
      return data(await db.collection("replies").get());
    },
    async getStatus() {
      return (await status.get()).data() ?? {};
    },
    async setStatus(patch) {
      await status.set(patch, { merge: true });
    },
  };
}
