// Turns a failed approve call into the message the band sees.
export function approveError(err) {
  const code = err?.code;
  if (code === "functions/deadline-exceeded") return "Approving took too long. Check the Send list: some may already be approved, then try again.";
  if (code === "functions/permission-denied" || code === "functions/unauthenticated") return "You're not signed in as the band account. Sign in again and retry.";
  return "Couldn't approve the list. Check your connection and try again.";
}
