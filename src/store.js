import { useEffect, useState } from "react";

// State kept in this browser only. Wrapped in try/catch so private windows still work.
export function useLocal(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  }, [key, value]);
  return [value, setValue];
}

export function download(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Back up every FloodLines key in this browser to a file, and restore one
export function backup() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith("fl")) data[k] = localStorage.getItem(k);
  }
  download(`floodlines-booth-backup-${new Date().toISOString().slice(0, 10)}.json`, { app: "floodlines-radio", savedAt: new Date().toISOString(), data });
}

export function restore(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const parsed = JSON.parse(r.result);
      if (parsed.app !== "floodlines-radio" || !parsed.data) throw new Error("not a backup");
      if (!confirm(`Restore the backup from ${new Date(parsed.savedAt).toLocaleString("en-GB")}? This replaces the campaign data in this browser.`)) return;
      Object.entries(parsed.data).forEach(([k, v]) => localStorage.setItem(k, v));
      location.reload();
    } catch {
      alert("That file isn't a FloodLines booth backup. Choose a file made with \"Back up to a file\".");
    }
  };
  r.readAsText(file);
}
