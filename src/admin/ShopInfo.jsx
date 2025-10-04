import React, { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { useNavigate } from "react-router-dom";

const Input = (p) => <input {...p} className={"mt-1 w-full rounded-lg border px-3 py-2 "+(p.className||"")} />;
const Label = ({children}) => <label className="text-sm font-medium">{children}</label>;
const Card = ({children,title,subtitle}) => (
  <div className="rounded-2xl border bg-white p-6 shadow-sm">
    {title && <h1 className="text-xl font-semibold">{title}</h1>}
    {subtitle && <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>}
    <div className="mt-4">{children}</div>
  </div>
);

export default function ShopInfo(){
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      const u = auth.currentUser;
      if (!u) return;
      const ref = doc(db, "shops", u.uid, "settings", "basic");
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        nav("/setup", { replace: true }); // send to setup if nothing yet
        return;
      }
      setForm(snap.data());
      setLoading(false);
    })();
  }, [nav]);

  const onChange = (k, v) => setForm(prev => ({...prev, [k]: v}));
  const onHourChange = (d, k, v) =>
    setForm(prev => ({...prev, hours: {...(prev.hours||{}), [d]: {...(prev.hours?.[d]||{open:"08:00",close:"17:00",openFlag:true}), [k]: v}}}));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const u = auth.currentUser;
      const ref = doc(db, "shops", u.uid, "settings", "basic");
      await setDoc(ref, { ...form, updatedAt: serverTimestamp(), updatedBy: u.uid }, { merge: true });
      alert("Saved!");
    } catch (err) {
      alert(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) return <div className="p-6">Loading…</div>;

  const DayRow = ({day, label}) => {
    const rec = form.hours?.[day] ?? { open:"08:00", close:"17:00", openFlag:true };
    return (
      <div className="grid grid-cols-5 items-center gap-2">
        <div className="text-sm">{label}</div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!rec.openFlag} onChange={e=>onHourChange(day,"openFlag",e.target.checked)} />
          <span>Open</span>
        </label>
        <Input type="time" value={rec.open} onChange={e=>onHourChange(day,"open",e.target.value)} disabled={!rec.openFlag}/>
        <div className="text-center">to</div>
        <Input type="time" value={rec.close} onChange={e=>onHourChange(day,"close",e.target.value)} disabled={!rec.openFlag}/>
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <Card title="Admin — Shop Info" subtitle="Edit your shop details. These are used across ASAPro.">
        <form onSubmit={save} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Shop Name</Label>
              <Input value={form.shopName||""} onChange={e=>onChange("shopName", e.target.value)} required />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone||""} onChange={e=>onChange("phone", e.target.value)} />
            </div>
            <div>
              <Label>Contact Email</Label>
              <Input type="email" value={form.email||""} onChange={e=>onChange("email", e.target.value)} />
            </div>
            <div>
              <Label>Time Zone</Label>
              <Input value={form.timezone||""} onChange={e=>onChange("timezone", e.target.value)} />
            </div>
            <div>
              <Label>Number of Bays</Label>
              <Input type="number" min={1} max={20} value={form.bays??3} onChange={e=>onChange("bays", parseInt(e.target.value||"0",10))} />
            </div>
          </div>

          <div className="grid gap-3">
            <Label>Address</Label>
            <Input placeholder="Address line 1" value={form.address1||""} onChange={e=>onChange("address1", e.target.value)} />
            <Input placeholder="Address line 2" value={form.address2||""} onChange={e=>onChange("address2", e.target.value)} />
            <div className="grid gap-3 md:grid-cols-3">
              <Input placeholder="City" value={form.city||""} onChange={e=>onChange("city", e.target.value)} />
              <Input placeholder="State" value={form.state||""} onChange={e=>onChange("state", e.target.value)} />
              <Input placeholder="ZIP" value={form.zip||""} onChange={e=>onChange("zip", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Working Hours</Label>
            <div className="grid gap-2">
              <DayRow day="mon" label="Mon" />
              <DayRow day="tue" label="Tue" />
              <DayRow day="wed" label="Wed" />
              <DayRow day="thu" label="Thu" />
              <DayRow day="fri" label="Fri" />
              <DayRow day="sat" label="Sat" />
              <DayRow day="sun" label="Sun" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button type="button" className="rounded-lg border px-4 py-2" onClick={()=>history.back()}>Back</button>
            <button className="rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-60" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
