import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider.jsx";
import { db } from "../lib/firebase";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";

const Container = ({ children }) => <div className="mx-auto w-full max-w-screen-2xl p-4">{children}</div>;
const Card = ({ children, title, subtitle }) => (
  <div className="rounded-2xl border bg-white p-6 shadow-sm">
    {title && <h1 className="text-xl font-semibold">{title}</h1>}
    {subtitle && <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>}
    <div className="mt-4">{children}</div>
  </div>
);

export default function Records() {
  const { user } = useAuth();
  const shopId = user?.uid;

  const [appts, setAppts] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!shopId) return;
    const unsub = onSnapshot(
      query(collection(db, "shops", shopId, "appointments"), where("status", "==", "archived"), orderBy("createdAt", "desc")),
      (snap) => setAppts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsub && unsub();
  }, [shopId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return appts;
    return appts.filter(a => [a.customerName, a.vehicleLabel, a.vin, a.reason].filter(Boolean).join(" ").toLowerCase().includes(s));
  }, [appts, q]);

  return (
    <Container>
      <Card title="Records & Archive" subtitle="Browse archived appointments. (Inspections & exports coming soon)">
        <div className="mb-3 flex items-center gap-2">
          <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Search…" value={q} onChange={(e)=>setQ(e.target.value)} />
        </div>
        <div className="overflow-hidden rounded-xl border">
          <div className="grid grid-cols-[1.2fr,1fr,0.8fr,0.8fr] bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-600">
            <div>Customer / Vehicle</div>
            <div>Reason</div>
            <div>Completed</div>
            <div>Flagged Hrs</div>
          </div>
          <div className="divide-y">
            {filtered.map(a=>(
              <div key={a.id} className="grid grid-cols-[1.2fr,1fr,0.8fr,0.8fr] items-center px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{a.customerName||"Customer"}</div>
                  <div className="text-xs text-zinc-700">{a.vehicleLabel||"Vehicle"} {a.vin ? `• ${a.vin}` : ""}</div>
                </div>
                <div className="text-xs text-zinc-700 truncate">{a.reason || "—"}</div>
                <div className="text-xs">{a.completedAt?.toDate?.().toLocaleString?.() || "—"}</div>
                <div className="text-xs">{a.flaggedHours ?? 0}</div>
              </div>
            ))}
            {filtered.length===0 && <div className="px-3 py-6 text-center text-sm text-zinc-600">No archived items yet.</div>}
          </div>
        </div>
      </Card>
    </Container>
  );
}
