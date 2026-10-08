import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { auth, configured } from "./firebase.js";
import { band } from "./songs.js";
import App from "./App.jsx";

const messages = {
  "auth/invalid-credential": "That email and password don't match. Check them and try again.",
  "auth/wrong-password": "That password isn't right. Try again, or reset it below.",
  "auth/user-not-found": "There's no band account with that email.",
  "auth/too-many-requests": "Too many tries. Wait a few minutes, or reset the password below.",
  "auth/network-request-failed": "Couldn't reach the sign-in server. Check your connection and try again.",
};

function SignIn() {
  const [email, setEmail] = useState(band.email);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setMsg(messages[err.code] || `Couldn't sign in (${err.code}).`);
      setBusy(false);
    }
  };
  const reset = async () => {
    if (!email.trim()) return setMsg("Enter the band email first, then choose Reset password.");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMsg(`A reset link is on its way to ${email.trim()}.`);
    } catch (err) {
      setMsg(messages[err.code] || `Couldn't send a reset link (${err.code}).`);
    }
  };

  return (
    <main className="gate">
      <motion.form className="gate-card" onSubmit={submit} initial={{ opacity: 0, y: 30, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ type: "spring", stiffness: 160, damping: 20 }}>
        <span className="onair lit gate-lamp" aria-hidden="true"><span className="onair-glow" /><span className="onair-text">On air</span></span>
        <h1 className="gate-title">FloodLines radio booth</h1>
        <p className="gate-sub">Sign in with the band login to see and update the radio campaign.</p>
        <label className="field"><span>Band email</span>
          <input type="email" name="email" autoComplete="username" spellCheck={false} value={email} onChange={e => setEmail(e.target.value)} required />
        </label>
        <label className="field"><span>Password</span>
          <input type="password" name="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
        </label>
        {msg && <p className="form-err" role="alert">{msg}</p>}
        <button className="btn btn-primary gate-go" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <button type="button" className="link-btn" onClick={reset}>Reset password</button>
      </motion.form>
    </main>
  );
}

// Shows the sign-in screen until the band is signed in, then the booth
export default function Gate() {
  const [user, setUser] = useState(undefined);
  useEffect(() => (configured ? onAuthStateChanged(auth, u => setUser(u || null)) : undefined), []);

  if (!configured) {
    return <main className="gate"><div className="gate-card"><h1 className="gate-title">Not connected yet</h1><p className="gate-sub">This copy of the booth isn't linked to the band's database. Ask whoever set it up to add the Firebase config.</p></div></main>;
  }
  if (user === undefined) return <main className="gate" aria-busy="true"><p className="gate-loading">Warming up the desk…</p></main>;
  if (!user) return <SignIn />;
  return <App user={user} />;
}
