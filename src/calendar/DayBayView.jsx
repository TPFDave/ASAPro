import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc, collection, doc, getDoc, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";

const Card = ({ children, title, subtitle, right }) => (
  <div className="rounded-2xl border bg-white p-4 shadow-sm">
    <div className="mb-2 flex items-center justify-between">
      <div>
        {title && <h2 className="text-lg font-semibold">{title}</h2>}
        {subtitle && <p className="text-xs text-zinc-600">{subtitle}</p>}
      </div>
      {right}
    </div>
    {children}
  </div>
);

const Pill = ({ children }) => (
  <span className="rounded-full border px-2 py-0.5 text-xs">{children}</span>
);

function toLocalYMD(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

export default function DayBayView() {
  const [dateStr, setDateStr] = useState(toLocalYMD(new Date()));
  const [bays, setBays] = useState(3);
  const [shopInfo, setShopInfo] = useState(null);
  const [appts, setAppts] = useState([]);
  const [addingBay, setAddingBay] = useState(null);
  const [newAppt, setNewAppt] = useState({ customerName: "", vehicle: "", start: "09:00", end: "10:00", status: "scheduled", notes: "" });

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;
    getDoc(doc(db, "shops", u.uid, "settings", "basic")).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setShopInfo(d);
        setBays(Number(d?.bays || 3));
      } else {
        setShopInfo({});
        setBays(3);
      }
    });
  }, []);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u || !dateStr) return;
    const col = collection(db, "shops", u.uid, "calendar", dateStr, "appts");
    const unsub = onSnapshot(query(col, orderBy("start", "asc")), (snap) => {
      setAppts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [dateStr]);

  const apptsByBay = useMemo(() => {
    const by = {};
    for (let i = 1; i <= bays; i++) by[i] = [];
    for (const a of appts) {
      const k = Number(a.bay) || 1;
      (by[k] ||= []).push(a);
    }
    for (let i = 1; i <= bays; i++) by[i].sort((a, b) => (a.start || "").localeCompare(b.start || ""));
    return by;
  }, [appts, bays]);

  const changeDay = (delta) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + delta);
    setDateStr(toLocalYMD(dt));
  };

  const startAdd = (bayIndex) => {
    setAddingBay(bayIndex);
    setNewAppt({ customerName: "", vehicle: "", start: "09:00", end: "10:00", status: "scheduled", notes: "" });
  };

  const saveNew = async () => {
    const u = auth.currentUser;
    if (!u) return alert("Not signed in");
    await addDoc(collection(db, "shops", u.uid, "calendar", dateStr, "appts"), {
      ...newAppt,
      bay: addingBay,
      date: dateStr,
      createdAt: serverTimestamp(),
      createdBy: u.uid,
    });
    setAddingBay(null);
  };

  const onDragStart = (e, apptId) => e.dataTransfer.setData("text/plain", apptId);
  const onDropBay = async (e, bayIndex) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const u = auth.currentUser;
    if (!u || !id) return;
    await updateDoc(doc(db, "shops", u.uid, "calendar", dateStr, "appts", id), {
      bay: bayIndex,
      updatedAt: serverTimestamp(),
      updatedBy: u.uid,
    });
  };
  const allowDrop = (e) => e.preventDefault();

  return (
    <div className="mx-auto w-full max-w-screen-2xl p-4">
      <Card
        title="Calendar — Day/Bay Board"
        subtitle={shopInfo?.shopName ? `Shop: ${shopInfo.shopName}` : "Configure shop in Admin → Shop Info"}
        right={
          <div className="flex items-center gap-2">
            <button className="rounded-lg border px-2 py-1 text-sm" onClick={() => changeDay(-1)}>◀ Prev</button>
            <input type="date" className="rounded-lg border px-2 py-1 text-sm" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
            <button className="rounded-lg border px-2 py-1 text-sm" onClick={() => setDateStr(toLocalYMD(new Date()))}>Today</button>
            <button className="rounded-lg border px-2 py-1 text-sm" onClick={() => changeDay(1)}>Next ▶</button>
            <Pill>{bays} {bays === 1 ? "Bay" : "Bays"}</Pill>
          </div>
        }
      >
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: bays }).map((_, idx) => {
            const bayIndex = idx + 1;
            const list = apptsByBay[bayIndex] || [];
            return (
              <div key={bayIndex} className="rounded-xl border bg-zinc-50 p-3" onDragOver={allowDrop} onDrop={(e) => onDropBay(e, bayIndex)}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Bay {bayIndex}</h3>
                  <button className="rounded-lg border bg-white px-2 py-1 text-xs hover:bg-zinc-100" onClick={() => startAdd(bayIndex)}>+ Add</button>
                </div>

                {addingBay === bayIndex && (
                  <div className="mb-3 rounded-lg border bg-white p-3 text-sm">
                    <div className="grid gap-2">
                      <input className="rounded border px-2 py-1" placeholder="Customer name" value={newAppt.customerName} onChange={(e) => setNewAppt({ ...newAppt, customerName: e.target.value })} />
                      <input className="rounded border px-2 py-1" placeholder="Vehicle (e.g., 2015 Civic)" value={newAppt.vehicle} onChange={(e) => setNewAppt({ ...newAppt, vehicle: e.target.value })} />
                      <div className="flex items-center gap-2">
                        <input type="time" className="w-full rounded border px-2 py-1" value={newAppt.start} onChange={(e) => setNewAppt({ ...newAppt, start: e.target.value })} />
                        <span className="text-xs text-zinc-500">to</span>
                        <input type="time" className="w-full rounded border px-2 py-1" value={newAppt.end} onChange={(e) => setNewAppt({ ...newAppt, end: e.target.value })} />
                      </div>
                      <textarea className="rounded border px-2 py-1" rows={2} placeholder="Notes (optional)" value={newAppt.notes} onChange={(e) => setNewAppt({ ...newAppt, notes: e.target.value })} />
                    </div>
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button className="rounded-lg border px-3 py-1 text-xs" onClick={() => setAddingBay(null)}>Cancel</button>
                      <button className="rounded-lg bg-zinc-900 px-3 py-1 text-xs text-white disabled:opacity-60" onClick={saveNew} disabled={!newAppt.customerName || !newAppt.start || !newAppt.end}>Save</button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {list.length === 0 && (
                    <div className="rounded-lg border border-dashed bg-white p-3 text-center text-xs text-zinc-500">No appointments</div>
                  )}
                  {list.map((a) => (
                    <div key={a.id} draggable onDragStart={(e) => onDragStart(e, a.id)} className="cursor-grab rounded-lg border bg-white p-3 active:cursor-grabbing" title="Drag to another bay to reassign">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{a.customerName || "Unnamed Customer"}</div>
                        <Pill>{a.status || "scheduled"}</Pill>
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-600">{a.start || "??"}–{a.end || "??"} • {a.vehicle || "Vehicle"}</div>
                      {a.notes && <div className="mt-1 text-xs text-zinc-500 line-clamp-2">{a.notes}</div>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
