const EPK_PATH = "epk/current";

export const storageEpk = (bucket) => ({
  async read() {
    const file = bucket.file(EPK_PATH);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [metadata] = await file.getMetadata();
    const [data] = await file.download();
    return { name: metadata.metadata?.name || "EPK", mimeType: metadata.contentType, data };
  },
});
