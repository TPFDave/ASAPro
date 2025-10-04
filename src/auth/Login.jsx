import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useLocation, useNavigate, Link } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const from = loc.state?.from?.pathname || "/dashboard";

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      nav(from, { replace: true });
    } catch (err) {
      setError(err.message || "Failed to sign in");
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Log in to ASAPro</h1>
      <p className="mt-1 text-sm text-zinc-600">Use your email and password.</p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <div>
          <label className="text-sm">Email</label>
          <input className="mt-1 w-full rounded-lg border px-3 py-2" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="text-sm">Password</label>
          <input className="mt-1 w-full rounded-lg border px-3 py-2" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
        </div>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <button className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-60" disabled={busy}>{busy ? "Signing in…" : "Sign In"}</button>
      </form>
      <p className="mt-3 text-sm text-zinc-600">
        No account? <Link className="underline" to="/signup">Create one</Link>
      </p>
    </div>
  );
}
