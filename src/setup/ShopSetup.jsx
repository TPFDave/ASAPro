import React, { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { useNavigate } from "react-router-dom";

const Input = (props) => <input {...props} className={"mt-1 w-full rounded-lg border px-3 py-2 "+(props.className||"")} />;
const Label = ({children}) => <label className="text-sm font-medium">{children}</label>;
const Card = ({children,title,subtitle}) => (
  <div className="rounded-2xl border bg-white p-6 shadow-sm">
    {title && <h1 className="text-xl font-semibold">{title}</h1>}
    {subtitle && <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>}
    <div className="mt-4">{children}</div>
  </div>
);

export default function ShopSetup(){
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    shopName: "",
    phone: "",
    email: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    zip: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
    bays: 3,
    hours: {
      mon: { open: "08:00", close: "17:00", openFlag: true },
      tue: { open: "08:00", close: "17:00", openFlag: true },
      wed: { open: "08:00", close: "17:00", openFlag: true },
      thu: { open: "08:00", close: "17:00", openFlag: true },
      fri: { open: "08:00", close: "17:00", openFlag: true },
      sat: { open: "09:00", close: "14:00", openFlag: false },
      sun: { open: "00:00", close: "00:00", openFlag: false },
    },
  });

  const nav = useNavigate();

  useEffect(() => {
    const run = async () => {
      const u = auth.currentUser;
      if (!u) return; // RequireAuth guards this
      // Use user uid as initial shopId
      const shopId = u.uid;
      const snap = await getDoc(doc(db, "shops", shopId, "settings", "basic"));
      if (snap.exists()) {
        // already set up
        nav("/dashboard", { replace: true });
        return;
      }
      setLoading(false);
    };
    run();
  }, [nav]);

  const onChange = (k, v) => setForm(prev => ({...prev, [k]: v}));
  const onHourChange = (d, k, v) => setForm(prev => ({...prev, hours: {...prev.hours, [d]: {...prev.hours[d], [k]: v}}}));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const u = auth.currentUser;
      const shopId = u.uid;
      const ref = doc(db, "shops", shopId, "settings", "basic");
      await setDoc(ref, {
        ...form,
        createdBy: u.uid,
        createdAt: serverTimestamp(),
      }, { merge: true });
      nav("/dashboard", { replace: true });
    } catch (err) {
      alert(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;

  const DayRow = ({day, label}) => {
    const rec = form.hours[day];
    return (
      <div className="grid grid-cols-5 items-center gap-2">
        <div className="text-sm">{label}</div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={rec.openFlag} onChange={e=>onHourChange(day,"openFlag",e.target.checked)} />
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
      <Card title="ASAPro — Shop Setup" subtitle="Tell us about your shop. You can change these later in Admin → Shop Info.">
        <form onSubmit={save} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Shop Name</Label>
              <Input placeholder="Example Auto Repair" value={form.shopName} onChange={e=>onChange("shopName", e.target.value)} required/>
            </div>
            <div>
              <Label>Phone</Label>
              <Input placeholder="(555) 555-1212" value={form.phone} onChange={e=>onChange("phone", e.target.value)} />
            </div>
            <div>
              <Label>Contact Email</Label>
              <Input type="email" placeholder="shop@example.com" value={form.email} onChange={e=>onChange("email", e.target.value)} />
            </div>
            <div>
              <Label>Time Zone</Label>
              <Input value={form.timezone} onChange={e=>onChange("timezone", e.target.value)} />
            </div>
            <div>
              <Label>Number of Bays</Label>
              <Input type="number" min={1} max={20} value={form.bays} onChange={e=>onChange("bays", parseInt(e.target.value||"0",10))} />
            </div>
          </div>

          <div className="grid gap-3">
            <Label>Address</Label>
            <Input placeholder="Address line 1" value={form.address1} onChange={e=>onChange("address1", e.target.value)} />
            <Input placeholder="Address line 2" value={form.address2} onChange={e=>onChange("address2", e.target.value)} />
            <div className="grid gap-3 md:grid-cols-3">
              <Input placeholder="City" value={form.city} onChange={e=>onChange("city", e.target.value)} />
              <Input placeholder="State" value={form.state} onChange={e=>onChange("state", e.target.value)} />
              <Input placeholder="ZIP" value={form.zip} onChange={e=>onChange("zip", e.target.value)} />
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
              {saving ? "Saving…" : "Save and continue"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
