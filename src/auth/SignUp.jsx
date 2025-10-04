import React, { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useNavigate, Link } from "react-router-dom";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (name) await updateProfile(cred.user, { displayName: name });
      nav("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Failed to create account");
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Create your ASAPro account</h1>
      <p className="mt-1 text-sm text-zinc-600">This creates a user; we'll wire shop setup later.</p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <div>
          <label className="text-sm">Name</label>
          <input className="mt-1 w-full rounded-lg border px-3 py-2" value={name} onChange={e=>setName(e.target.value)} placeholder="Jane Owner" />
        </div>
        <div>
          <label className="text-sm">Email</label>
          <input className="mt-1 w-full rounded-lg border px-3 py-2" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="text-sm">Password</label>
          <input className="mt-1 w-full rounded-lg border px-3 py-2" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
        </div>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <button className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-60" disabled={busy}>{busy ? "Creating…" : "Create Account"}</button>
      </form>
      <p className="mt-3 text-sm text-zinc-600">
        Already have an account? <Link className="underline" to="/login">Log in</Link>
      </p>
    </div>
  );
}
