// Firestore Admin implementation of the same store methods as fakeStore.
export function firestoreStore(db) {
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
      return s.exists ? s.data() : undefined;
    },
    async updateStation(id, patch) {
      await db.doc(`stations/${id}`).set(patch, { merge: true });
    },
    async addSend(record) {
      await db.collection("sends").add(record);
    },
    async listSends({ since = 0 } = {}) {
      return data(await db.collection("sends").where("at", ">=", since).get());
    },
    async getStatus() {
      return (await status.get()).data() ?? {};
    },
    async setStatus(patch) {
      await status.set(patch, { merge: true });
    },
  };
}
