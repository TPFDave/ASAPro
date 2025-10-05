import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";
import { db } from "../lib/firebase";
import {
  collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc
} from "firebase/firestore";
import { ShieldCheck, ClipboardList, Plus, Settings, ChevronRight } from "lucide-react";
import SafetyInspection from "./SafetyInspection.jsx";
import DetailedInspection from "./DetailedInspection.jsx";

const Container = ({ children }) => <div className="mx-auto w-full max-w-screen-sm p-3">{children}</div>;
const Card = ({ title, children }) => (
  <div className="rounded-2xl border bg-white p-4 shadow-sm">
    {title && <div className="mb-2 text-base font-semibold">{title}</div>}
    {children}
  </div>
);

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function InspectionsRouter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const q = useQuery();
  const [view, setView] = useState("home"); // 'home' | 'safety' | 'detailed'
  const [prefill, setPrefill] = useState(null); // { apptId, customerName, vehicleLabel, vin }

  // Prefill if navigated from Dashboard with ?apptId=...
  useEffect(() => {
    const apptId = q.get("apptId");
    if (!user?.uid) return;
    if (!apptId) return;
    (async () => {
      const apptRef = doc(db, "shops", user.uid, "appointments", apptId);
      const snap = await getDoc(apptRef);
      if (snap.exists()) {
        const a = snap.data();
        setPrefill({
          apptId,
          customerName: a.customerName || "",
          vehicleLabel: a.vehicleLabel || "",
          vin: a.vin || "",
        });
      }
    })();
  }, [user?.uid, q]);

  if (view === "safety") {
    return <SafetyInspection prefill={prefill} onBack={() => setView("home")} />;
  }
  if (view === "detailed") {
    return <DetailedInspection prefill={prefill} onBack={() => setView("home")} />;
  }

  // HOME
  return (
    <Container>
      <div className="mb-3 text-sm text-zinc-600">Mobile-first inspections</div>

      <div className="grid gap-3">
        <Card>
          <button
            className="flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left hover:bg-zinc-50"
            onClick={() => setView("safety")}
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5" />
              <div>
                <div className="text-sm font-semibold">Safety / Liability (C.Y.A.)</div>
                <div className="text-xs text-zinc-600">Quick visual pass/fail + damage notes</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4" />
          </button>

          <button
            className="mt-2 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left hover:bg-zinc-50"
            onClick={() => setView("detailed")}
          >
            <div className="flex items-center gap-3">
              <ClipboardList className="h-5 w-5" />
              <div>
                <div className="text-sm font-semibold">Detailed, Industry Standard</div>
                <div className="text-xs text-zinc-600">Interior • Exterior • Under Car • Under Hood</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4" />
          </button>
        </Card>

        <RecentInspections />
        <PerShopCustomize />
      </div>
    </Container>
  );
}

function RecentInspections() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(
      query(collection(db, "shops", user.uid, "inspections"), orderBy("createdAt", "desc")),
      (snap) => setRows(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsub && unsub();
  }, [user?.uid]);

  return (
    <Card title="Recent Inspections">
      {rows.length === 0 ? (
        <div className="text-sm text-zinc-600">None yet.</div>
      ) : (
        <div className="divide-y">
          {rows.slice(0, 10).map(r => (
            <div key={r.id} className="py-2 text-sm">
              <div className="font-medium">{r.customer?.name || "Customer"} • {r.vehicle?.label || "Vehicle"}</div>
              <div className="text-xs text-zinc-600">{r.type} • {r.status || "in_progress"} • {r.createdAt?.toDate?.().toLocaleString?.()}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function PerShopCustomize() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    const ref = doc(db, "shops", user.uid, "settings", "inspections");
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) setSettings(snap.data());
      else setSettings({
        allowCustomPoint: true,
        hiddenPoints: [], // array of point keys the shop hides
      });
    });
    return () => unsub && unsub();
  }, [user?.uid]);

  if (!settings) return null;

  const toggleAllow = async () => {
    setSaving(true);
    const ref = doc(db, "shops", user.uid, "settings", "inspections");
    await setDoc(ref, { allowCustomPoint: !settings.allowCustomPoint }, { merge: true });
    setSaving(false);
  };

  return (
    <Card title="Customization">
      <div className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
        <div>Add one custom inspection point</div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!settings.allowCustomPoint} onChange={toggleAllow} />
          <span className="text-xs text-zinc-600">{saving ? "Saving…" : "Enabled"}</span>
        </label>
      </div>
      <div className="mt-2 text-xs text-zinc-600">
        (Hiding specific points is available inside each inspection screen.)
      </div>
    </Card>
  );
}
