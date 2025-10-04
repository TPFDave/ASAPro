import React, { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Link } from "react-router-dom";
import { db, auth } from "../lib/firebase";

const Card = ({ children, title, subtitle, right }) => (
  <div className="rounded-2xl border bg-white p-6 shadow-sm">
    <div className="mb-3 flex items-center justify-between">
      <div>
        {title && <h1 className="text-xl font-semibold">{title}</h1>}
        {subtitle && <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>}
      </div>
      {right}
    </div>
    {children}
  </div>
);

const RadioRow = ({ value, current, onChange, title, desc }) => (
  <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 hover:bg-zinc-50">
    <input
      type="radio"
      name="calendarStyle"
      className="mt-1"
      value={value}
      checked={current === value}
      onChange={() => onChange(value)}
    />
    <div>
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 text-xs text-zinc-600">{desc}</div>
    </div>
  </label>
);

const WeekRow = ({ dayKey, label, rec, onChange }) => (
  <div className="grid grid-cols-5 items-center gap-2 rounded-xl border p-3">
    <div className="text-sm font-medium">{label}</div>
    <label className="col-span-1 flex items-center gap-2 text-xs">
      <input
        type="checkbox"
        checked={!!rec.openFlag}
        onChange={(e) => onChange(dayKey, { ...rec, openFlag: e.target.checked })}
      />
      Open
    </label>
    <div className="col-span-1">
      <input
        disabled={!rec.openFlag}
        type="time"
        className="w-full rounded border px-2 py-1 text-sm"
        value={rec.open}
        onChange={(e) => onChange(dayKey, { ...rec, open: e.target.value })}
      />
    </div>
    <div className="col-span-1">
      <input
        disabled={!rec.openFlag}
        type="time"
        className="w-full rounded border px-2 py-1 text-sm"
        value={rec.close}
        onChange={(e) => onChange(dayKey, { ...rec, close: e.target.value })}
      />
    </div>
    <div className="text-xs text-zinc-500">({rec.openFlag ? "open" : "closed"})</div>
  </div>
);

const defaultHours = () => ({
  sun: { openFlag: false, open: "08:00", close: "17:00" },
  mon: { openFlag: true, open: "08:00", close: "17:00" },
  tue: { openFlag: true, open: "08:00", close: "17:00" },
  wed: { openFlag: true, open: "08:00", close: "17:00" },
  thu: { openFlag: true, open: "08:00", close: "17:00" },
  fri: { openFlag: true, open: "08:00", close: "17:00" },
  sat: { openFlag: true, open: "08:00", close: "13:00" },
});

const dayLabels = { sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday" };

export default function CalendarOptions() {
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Only two styles now: board (Day/Bay) or grid (Google-style)
  const [style, setStyle] = useState("grid");
  // Grid sub-mode: day or week
  const [gridView, setGridView] = useState("day"); // 'day' | 'week'
  const [weekDays, setWeekDays] = useState(6); // 5/6/7
  const [stepMinutes, setStepMinutes] = useState(15);
  const [hours, setHours] = useState(defaultHours());
  const [appointmentTypes, setAppointmentTypes] = useState([
    { id: "general", name: "General", color: "#3b82f6" },
  ]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u ? u.uid : null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      const ref = doc(db, "shops", uid, "settings", "calendar");
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        if (data.style) setStyle(data.style);
        if (data.gridView) setGridView(data.gridView);
        if (Number.isFinite(data.weekDays)) setWeekDays(data.weekDays);
        if (data.stepMinutes) setStepMinutes(data.stepMinutes);
        if (data.hours) setHours({ ...defaultHours(), ...data.hours });
        if (Array.isArray(data.appointmentTypes) && data.appointmentTypes.length > 0) {
          setAppointmentTypes(data.appointmentTypes);
        }
      }
      setLoading(false);
    })();
  }, [uid]);

  const updateDay = (k, rec) => setHours((h) => ({ ...h, [k]: rec }));
  const addType = () => setAppointmentTypes((t) => [...t, { id: Date.now().toString(36), name: "New Type", color: "#10b981" }]);
  const updateType = (id, patch) => setAppointmentTypes((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeType = (id) => setAppointmentTypes((t) => t.filter((x) => x.id !== id));

  const save = async (e) => {
    e.preventDefault();
    if (!uid) return;
    setSaving(true);
    try {
      const ref = doc(db, "shops", uid, "settings", "calendar");
      await setDoc(
        ref,
        { style, gridView, weekDays, stepMinutes, hours, appointmentTypes, updatedAt: serverTimestamp(), updatedBy: uid },
        { merge: true }
      );
      alert("Calendar options saved.");
    } catch (err) {
      alert(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!uid || loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="mx-auto w-full max-w-4xl p-4">
      <Card
        title="Admin — Calendar Options"
        subtitle="Pick style (board vs grid). If grid, choose Day or Week view and configure scheduling."
        right={<Link to="/calendar" className="rounded-lg border px-3 py-1.5 text-sm">Open Calendar</Link>}
      >
        <form onSubmit={save} className="space-y-8">
          {/* Style */}
          <section className="space-y-3">
            <div className="text-sm font-semibold">Calendar Style</div>
            <RadioRow value="board" current={style} onChange={setStyle} title="Day/Bay Board" desc="Columns per bay. Drag cards between bays." />
            <RadioRow value="grid" current={style} onChange={setStyle} title="Google-style Calendar" desc="Traditional calendar with time grid." />
          </section>

          {/* Grid configuration */}
          {style === "grid" && (
            <section className="space-y-3">
              <div className="text-sm font-semibold">Grid View</div>
              <div className="flex items-center gap-3">
                <select className="rounded border px-2 py-1 text-sm" value={gridView} onChange={(e) => setGridView(e.target.value)}>
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                </select>

                {gridView === "week" && (
                  <>
                    <span className="text-sm">Week length</span>
                    <select className="rounded border px-2 py-1 text-sm" value={weekDays} onChange={(e) => setWeekDays(parseInt(e.target.value, 10))}>
                      <option value={5}>5 days (Mon–Fri)</option>
                      <option value={6}>6 days (Mon–Sat)</option>
                      <option value={7}>7 days (Mon–Sun)</option>
                    </select>
                  </>
                )}
              </div>
            </section>
          )}

          {/* Hours */}
          <section className="space-y-3">
            <div className="text-sm font-semibold">Schedulable Hours</div>
            <div className="rounded-xl border">
              {Object.keys(dayLabels).map((k) => (
                <WeekRow
                  key={k}
                  dayKey={k}
                  label={dayLabels[k]}
                  rec={hours[k] || { openFlag: false, open: "08:00", close: "17:00" }}
                  onChange={updateDay}
                />
              ))}
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm">Time step</label>
              <select className="rounded border px-2 py-1 text-sm" value={stepMinutes} onChange={(e) => setStepMinutes(parseInt(e.target.value, 10))}>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>
          </section>

          {/* Types */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Appointment Types</div>
              <button type="button" onClick={addType} className="rounded border px-3 py-1.5 text-xs">+ Add Type</button>
            </div>
            <div className="space-y-2">
              {appointmentTypes.map((t) => (
                <div key={t.id} className="grid grid-cols-6 items-center gap-2 rounded-xl border p-3">
                  <input className="col-span-3 rounded border px-2 py-1 text-sm" value={t.name} onChange={(e) => updateType(t.id, { name: e.target.value })} />
                  <div className="col-span-2 flex items-center gap-2">
                    <input type="color" value={t.color} onChange={(e) => updateType(t.id, { color: e.target.value })} />
                    <span className="text-xs text-zinc-600">{t.color}</span>
                  </div>
                  <button type="button" onClick={() => removeType(t.id)} className="rounded border px-2 py-1 text-xs text-red-600">Remove</button>
                </div>
              ))}
            </div>
          </section>

          <div className="flex items-center justify-end gap-2">
            <Link to="/calendar" className="rounded-lg border px-4 py-2 text-sm">Preview</Link>
            <button type="submit" disabled={saving} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
