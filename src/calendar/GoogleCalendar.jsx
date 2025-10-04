import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc, collection, doc, getDoc, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc, deleteDoc, setDoc
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";

/* ---------- UI bits ---------- */
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
const Pill = ({ children }) => <span className="rounded-full border px-2 py-0.5 text-xs">{children}</span>;

/* ---------- Helpers (single source of truth) ---------- */
const toLocalYMD = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
};
const parseHHMM = (hhmm) => { const [h, m] = (hhmm || "00:00").split(":").map((n) => parseInt(n, 10)); return (h || 0) * 60 + (m || 0); };
const toHHMM = (mins) => `${String(Math.floor(mins/60)).padStart(2,"0")}:${String(mins%60).padStart(2,"0")}`;
const roundTo = (mins, step = 15) => Math.max(0, Math.round(mins / step) * step);
const hexToRgba = (hex, alpha = 0.15) => {
  if (!hex) return `rgba(0,0,0,${alpha})`;
  const h = hex.replace("#", ""); const n = parseInt(h.length===3 ? h.split("").map(c=>c+c).join("") : h, 16);
  const r=(n>>16)&255,g=(n>>8)&255,b=n&255; return `rgba(${r},${g},${b},${alpha})`;
};
const weekdayKeyFromDateStr = (dateStr) => ["sun","mon","tue","wed","thu","fri","sat"][new Date(dateStr).getDay()];
const mondayOf = (d) => { const wd = d.getDay(); const offset = (wd + 6) % 7; const m = new Date(d); m.setDate(d.getDate() - offset); return m; };

/* ---------- Component ---------- */
export default function GoogleCalendar() {
  // In day mode we use dateStr; in week mode we use anchorDateStr (any day in the week)
  const [dateStr, setDateStr] = useState(toLocalYMD(new Date()));
  const [anchorDateStr, setAnchorDateStr] = useState(toLocalYMD(new Date()));

  const [shopInfo, setShopInfo] = useState(null);
  const [settings, setSettings] = useState({
    style: "grid",
    gridView: "day",
    weekDays: 6,
    stepMinutes: 15,
    hours: null,
    appointmentTypes: []
  });

  // Day data
  const [appts, setAppts] = useState([]);

  // Week data
  const [apptsByDate, setApptsByDate] = useState({}); // { 'YYYY-MM-DD': [appts] }

  // Forms
  const [newForm, setNewForm] = useState(null);  // day: { startM, endM,... } week: { dateStr, startM, endM,... }
  const [editForm, setEditForm] = useState(null); // day: { id,... } week: { id, dateStr,... }

  // Selection rectangles
  const gridRef = useRef(null);            // day view
  const [sel, setSel] = useState(null);    // day: {active,y0,y1}
  const gridRefs = useRef({});             // week view per-day
  const [selW, setSelW] = useState(null);  // week: {active,dateStr,y0,y1}

  // Common render settings
  const step = settings.stepMinutes || 15;
  const pxPerMin = 1;

  /* Load shop + calendar settings */
  useEffect(() => {
    const u = auth.currentUser; if (!u) return;

    getDoc(doc(db, "shops", u.uid, "settings", "basic")).then((snap) => setShopInfo(snap.exists() ? snap.data() : {}));
    getDoc(doc(db, "shops", u.uid, "settings", "calendar")).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setSettings((s) => ({
          ...s,
          style: d.style || "grid",
          gridView: d.gridView || "day",
          weekDays: d.weekDays || 6,
          stepMinutes: d.stepMinutes || 15,
          hours: d.hours || null,
          appointmentTypes: Array.isArray(d.appointmentTypes) ? d.appointmentTypes : [],
        }));
      }
    });
  }, []);

  /* ---------- DAY MODE ---------- */
  useEffect(() => {
    if (settings.gridView !== "day") return;
    const u = auth.currentUser; if (!u) return;
    const col = collection(db, "shops", u.uid, "calendar", dateStr, "appts");
    const unsub = onSnapshot(query(col, orderBy("start", "asc")), (snap) =>
      setAppts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [settings.gridView, dateStr]);

  const dayWeekdayKey = useMemo(() => weekdayKeyFromDateStr(dateStr), [dateStr]);

  const getHoursForKey = (key) => {
    const rec = settings.hours?.[key];
    if (!rec) return { startM: 8 * 60, endM: 17 * 60, isOpen: true };
    if (rec.openFlag === false) return { startM: 8*60, endM: 17*60, isOpen: false };
    const s = parseHHMM(rec.open), e = parseHHMM(rec.close);
    if (Number.isFinite(s) && Number.isFinite(e) && e > s) return { startM: s, endM: e, isOpen: true };
    return { startM: 8*60, endM: 17*60, isOpen: true };
  };

  const dayWindow = useMemo(() => getHoursForKey(dayWeekdayKey), [settings.hours, dayWeekdayKey]);
  const gridHeightDay = (dayWindow.endM - dayWindow.startM) * pxPerMin;

  const positionedDay = useMemo(() => appts.map((a) => {
    const s = parseHHMM(a.start), e = parseHHMM(a.end);
    return { ...a, _s: s, _e: e, _top: Math.max(0, (s - dayWindow.startM) * pxPerMin), _height: Math.max(18, (e - s) * pxPerMin) };
  }), [appts, dayWindow.startM]);

  const changeDay = (delta) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + delta);
    setDateStr(toLocalYMD(d));
    setNewForm(null); setEditForm(null);
  };

  const dragInfoDay = useRef({ id: null, durM: 60 });
  const onDragStartDay = (e, a) => { dragInfoDay.current = { id: a.id, durM: Math.max(step, a._e - a._s) }; e.dataTransfer.setData("text/plain", a.id); };
  const onDropDay = async (e) => {
    e.preventDefault();
    const u = auth.currentUser; if (!u) return;
    const id = e.dataTransfer.getData("text/plain"); if (!id) return;
    const rect = gridRef.current.getBoundingClientRect(); const y = e.clientY - rect.top;
    let s = dayWindow.startM + Math.round(y / pxPerMin); s = roundTo(s, step);
    let eM = s + dragInfoDay.current.durM;
    if (eM > dayWindow.endM) { eM = dayWindow.endM; s = Math.max(dayWindow.startM, eM - dragInfoDay.current.durM); }
    await updateDoc(doc(db, "shops", u.uid, "calendar", dateStr, "appts", id), {
      start: toHHMM(s), end: toHHMM(eM), updatedAt: serverTimestamp(), updatedBy: u.uid,
    });
  };
  const allowDrop = (e) => e.preventDefault();

  // drag-to-create (day)
  const onMouseDownDay = (e) => {
    if (!dayWindow.isOpen) return;
    if (e.target.closest?.("[data-evt='1']")) return;
    const rect = gridRef.current.getBoundingClientRect();
    setSel({ active: true, y0: e.clientY - rect.top, y1: e.clientY - rect.top });
  };
  const onMouseMoveDay = (e) => {
    if (!sel?.active) return;
    const rect = gridRef.current.getBoundingClientRect();
    setSel((s) => ({ ...s, y1: e.clientY - rect.top }));
  };
  const onMouseUpDay = () => {
    if (!sel?.active) return setSel(null);
    const yTop = Math.min(sel.y0, sel.y1), yBot = Math.max(sel.y0, sel.y1);
    let s = dayWindow.startM + Math.round(yTop / pxPerMin);
    let eM = dayWindow.startM + Math.round(yBot / pxPerMin);
    s = roundTo(s, step); eM = roundTo(Math.max(eM, s + step), step); eM = Math.min(dayWindow.endM, eM);
    const defaultType = settings.appointmentTypes?.[0]?.id || "general";
    setNewForm({ startM: s, endM: eM, title: "", typeId: defaultType, notes: "" }); // day mode new
    setSel(null); setEditForm(null);
  };
  const onDblClickDay = (e) => {
    if (!dayWindow.isOpen) return;
    const rect = gridRef.current.getBoundingClientRect();
    let s = dayWindow.startM + Math.round((e.clientY - rect.top) / pxPerMin);
    s = roundTo(s, step);
    const eM = Math.min(dayWindow.endM, s + 60);
    const defaultType = settings.appointmentTypes?.[0]?.id || "general";
    setNewForm({ startM: s, endM: eM, title: "", typeId: defaultType, notes: "" });
    setEditForm(null);
  };

  /* ---------- WEEK MODE ---------- */
  const weekDates = useMemo(() => {
    if (settings.gridView !== "week") return [];
    const anchor = new Date(anchorDateStr);
    const mon = mondayOf(anchor);
    const n = [5,6,7].includes(settings.weekDays) ? settings.weekDays : 6;
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(mon); d.setDate(mon.getDate() + i);
      return toLocalYMD(d);
    });
  }, [settings.gridView, anchorDateStr, settings.weekDays]);

  useEffect(() => {
    if (settings.gridView !== "week") return;
    const u = auth.currentUser; if (!u || weekDates.length === 0) return;
    const unsubs = weekDates.map((dStr) => {
      const col = collection(db, "shops", u.uid, "calendar", dStr, "appts");
      return onSnapshot(query(col, orderBy("start", "asc")), (snap) => {
        setApptsByDate((prev) => ({ ...prev, [dStr]: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }));
      });
    });
    return () => unsubs.forEach((fn) => fn && fn());
  }, [settings.gridView, anchorDateStr, settings.weekDays]); // eslint-disable-line

  const weekWindow = useMemo(() => {
    // compute min open and max close among open days in visible week
    let sMin = 8*60, eMax = 17*60, first = true;
    for (const dStr of weekDates) {
      const rec = settings.hours?.[weekdayKeyFromDateStr(dStr)];
      if (!rec || rec.openFlag === false) continue;
      const s = parseHHMM(rec.open), e = parseHHMM(rec.close);
      if (Number.isFinite(s) && Number.isFinite(e) && e > s) {
        if (first) { sMin = s; eMax = e; first = false; }
        sMin = Math.min(sMin, s);
        eMax = Math.max(eMax, e);
      }
    }
    return { startM: sMin, endM: eMax };
  }, [settings.hours, weekDates]);

  const gridHeightWeek = (weekWindow.endM - weekWindow.startM) * pxPerMin;

  const positionedByDay = useMemo(() => {
    const pos = {};
    for (const dStr of weekDates) {
      const list = apptsByDate[dStr] || [];
      pos[dStr] = list.map((a) => {
        const s = parseHHMM(a.start), e = parseHHMM(a.end);
        return { ...a, _s: s, _e: e, _top: Math.max(0, (s - weekWindow.startM) * pxPerMin), _height: Math.max(18, (e - s) * pxPerMin) };
      });
    }
    return pos;
  }, [apptsByDate, weekDates, weekWindow.startM]);

  const changeWeek = (delta) => {
    const d = new Date(anchorDateStr); d.setDate(d.getDate() + delta*7);
    setAnchorDateStr(toLocalYMD(d));
    setNewForm(null); setEditForm(null);
  };

  const dragInfoWeek = useRef({ id: null, dateStr: null, durM: 60 });
  const onDragStartWeek = (e, a, dateStrW) => {
    dragInfoWeek.current = { id: a.id, dateStr: dateStrW, durM: Math.max(step, a._e - a._s) };
    e.dataTransfer.setData("text/plain", a.id);
  };
  const onDropInDay = async (e, targetDateStr) => {
    e.preventDefault();
    const u = auth.currentUser; if (!u) return;
    const id = e.dataTransfer.getData("text/plain"); if (!id) return;
    const rect = gridRefs.current[targetDateStr]?.getBoundingClientRect(); if (!rect) return;
    let s = weekWindow.startM + Math.round((e.clientY - rect.top) / pxPerMin); s = roundTo(s, step);
    let eM = s + dragInfoWeek.current.durM;
    if (eM > weekWindow.endM) { eM = weekWindow.endM; s = Math.max(weekWindow.startM, eM - dragInfoWeek.current.durM); }

    const fromDate = dragInfoWeek.current.dateStr;
    if (fromDate === targetDateStr) {
      await updateDoc(doc(db, "shops", u.uid, "calendar", targetDateStr, "appts", id), {
        start: toHHMM(s), end: toHHMM(eM), updatedAt: serverTimestamp(), updatedBy: u.uid,
      });
    } else {
      const fromRef = doc(db, "shops", u.uid, "calendar", fromDate, "appts", id);
      const snap = await getDoc(fromRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const toRef = doc(db, "shops", u.uid, "calendar", targetDateStr, "appts", id);
      await setDoc(toRef, { ...data, date: targetDateStr, start: toHHMM(s), end: toHHMM(eM), updatedAt: serverTimestamp(), updatedBy: u.uid });
      await deleteDoc(fromRef);
    }
  };

  // drag-to-create (week)
  const onMouseDownDayW = (e, dStr) => {
    if (e.target.closest?.("[data-evt='1']")) return;
    const rect = gridRefs.current[dStr]?.getBoundingClientRect(); if (!rect) return;
    const y0 = e.clientY - rect.top;
    setSelW({ active: true, dateStr: dStr, y0, y1: y0 });
  };
  const onMouseMoveDayW = (e, dStr) => {
    if (!selW?.active || selW.dateStr !== dStr) return;
    const rect = gridRefs.current[dStr]?.getBoundingClientRect(); if (!rect) return;
    setSelW((s) => ({ ...s, y1: e.clientY - rect.top }));
  };
  const onMouseUpDayW = (e, dStr) => {
    if (!selW?.active || selW.dateStr !== dStr) return setSelW(null);
    const yTop = Math.min(selW.y0, selW.y1), yBot = Math.max(selW.y0, selW.y1);
    let s = weekWindow.startM + Math.round(yTop / pxPerMin);
    let eM = weekWindow.startM + Math.round(yBot / pxPerMin);
    s = roundTo(s, step); eM = roundTo(Math.max(eM, s + step), step); eM = Math.min(weekWindow.endM, eM);
    const defaultType = settings.appointmentTypes?.[0]?.id || "general";
    setNewForm({ dateStr: dStr, startM: s, endM: eM, title: "", typeId: defaultType, notes: "" }); // week mode new
    setSelW(null); setEditForm(null);
  };
  const onDblClickDayW = (e, dStr) => {
    const rect = gridRefs.current[dStr]?.getBoundingClientRect(); if (!rect) return;
    let s = weekWindow.startM + Math.round((e.clientY - rect.top) / pxPerMin);
    s = roundTo(s, step);
    const eM = Math.min(weekWindow.endM, s + 60);
    const defaultType = settings.appointmentTypes?.[0]?.id || "general";
    setNewForm({ dateStr: dStr, startM: s, endM: eM, title: "", typeId: defaultType, notes: "" });
    setEditForm(null);
  };

  /* ---------- Shared helpers ---------- */
  const typeColor = (typeId) => settings.appointmentTypes?.find((t) => t.id === typeId)?.color || "#3b82f6";
  const hoursArray = (start, end) => { const arr=[]; for (let m=start; m<=end; m+=60) arr.push(m); return arr; };

  /* ---------- CRUD ---------- */
  const saveNew = async () => {
    const u = auth.currentUser; if (!u || !newForm) return;
    if (settings.gridView === "week" && newForm.dateStr) {
      const ref = doc(db, "shops", u.uid, "calendar", newForm.dateStr, "appts", crypto.randomUUID());
      await setDoc(ref, {
        title: newForm.title || "Appointment",
        typeId: newForm.typeId || null,
        notes: newForm.notes || "",
        date: newForm.dateStr,
        start: toHHMM(newForm.startM),
        end: toHHMM(newForm.endM),
        status: "scheduled",
        createdAt: serverTimestamp(),
        createdBy: u.uid,
      });
    } else {
      await addDoc(collection(db, "shops", u.uid, "calendar", dateStr, "appts"), {
        title: newForm.title || "Appointment",
        typeId: newForm.typeId || null,
        notes: newForm.notes || "",
        date: dateStr,
        start: toHHMM(newForm.startM),
        end: toHHMM(newForm.endM),
        status: "scheduled",
        createdAt: serverTimestamp(),
        createdBy: u.uid,
      });
    }
    setNewForm(null);
  };

  const openEditDay = (a) => setEditForm({
    id: a.id, title: a.title || "Appointment",
    typeId: a.typeId || settings.appointmentTypes?.[0]?.id || "general",
    notes: a.notes || "",
    startM: parseHHMM(a.start), endM: parseHHMM(a.end),
  });

  const openEditWeek = (a, dStr) => setEditForm({
    id: a.id, dateStr: dStr, title: a.title || "Appointment",
    typeId: a.typeId || settings.appointmentTypes?.[0]?.id || "general",
    notes: a.notes || "",
    startM: parseHHMM(a.start), endM: parseHHMM(a.end),
  });

  const saveEdit = async () => {
    const u = auth.currentUser; if (!u || !editForm) return;
    if (settings.gridView === "week" && editForm.dateStr) {
      await updateDoc(doc(db, "shops", u.uid, "calendar", editForm.dateStr, "appts", editForm.id), {
        title: editForm.title, typeId: editForm.typeId, notes: editForm.notes,
        start: toHHMM(editForm.startM), end: toHHMM(editForm.endM), updatedAt: serverTimestamp(), updatedBy: u.uid,
      });
    } else {
      await updateDoc(doc(db, "shops", u.uid, "calendar", dateStr, "appts", editForm.id), {
        title: editForm.title, typeId: editForm.typeId, notes: editForm.notes,
        start: toHHMM(editForm.startM), end: toHHMM(editForm.endM), updatedAt: serverTimestamp(), updatedBy: u.uid,
      });
    }
    setEditForm(null);
  };

  const deleteEdit = async () => {
    const u = auth.currentUser; if (!u || !editForm) return;
    if (!confirm("Delete this appointment?")) return;
    if (settings.gridView === "week" && editForm.dateStr) {
      await deleteDoc(doc(db, "shops", u.uid, "calendar", editForm.dateStr, "appts", editForm.id));
    } else {
      await deleteDoc(doc(db, "shops", u.uid, "calendar", dateStr, "appts", editForm.id));
    }
    setEditForm(null);
  };

  /* ---------- RENDER ---------- */
  if (settings.gridView === "week") {
    const hours = hoursArray(weekWindow.startM, weekWindow.endM);
    const headerTitle = (() => {
      if (weekDates.length === 0) return "";
      const first = new Date(weekDates[0]); const last = new Date(weekDates[weekDates.length - 1]);
      const fmt = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return `${fmt(first)} – ${fmt(last)}`;
    })();

    return (
      <div className="mx-auto w-full max-w-screen-2xl p-4">
        <Card
          title={`Calendar — Week (${headerTitle})`}
          subtitle={shopInfo?.shopName ? `Shop: ${shopInfo.shopName}` : "Configure shop in Admin → Shop Info"}
          right={
            <div className="flex items-center gap-2">
              <button className="rounded-lg border px-2 py-1 text-sm" onClick={() => changeWeek(-1)}>◀ Prev</button>
              <input type="date" className="rounded-lg border px-2 py-1 text-sm" value={anchorDateStr} onChange={(e) => setAnchorDateStr(e.target.value)} />
              <button className="rounded-lg border px-2 py-1 text-sm" onClick={() => setAnchorDateStr(toLocalYMD(new Date()))}>Today</button>
              <button className="rounded-lg border px-2 py-1 text-sm" onClick={() => changeWeek(1)}>Next ▶</button>
            </div>
          }
        >
          {/* Headers */}
          <div className="grid" style={{ gridTemplateColumns: `64px repeat(${weekDates.length}, minmax(0, 1fr))` }}>
            <div />
            {weekDates.map((dStr) => (
              <div key={dStr} className="border-l px-2 pb-2 text-sm font-medium">
                {new Date(dStr).toLocaleDateString(undefined, { weekday: "short", month: "numeric", day: "numeric" })}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid" style={{ gridTemplateColumns: `64px repeat(${weekDates.length}, minmax(0, 1fr))` }}>
            {/* time gutter */}
            <div className="relative" style={{ height: gridHeightWeek }}>
              {hours.map((m) => {
                const top = (m - weekWindow.startM) * 1 - 7;
                const h = Math.floor(m / 60);
                const label = `${((h + 11) % 12) + 1}${m % 60 === 0 ? "" : ":30"} ${h < 12 ? "AM" : "PM"}`;
                return (
                  <div key={m} className="absolute left-0 right-0" style={{ top }}>
                    <div className="px-1 text-right text-[10px] text-zinc-500 select-none">{label}</div>
                  </div>
                );
              })}
            </div>

            {/* day columns */}
            {weekDates.map((dStr) => {
              const list = positionedByDay[dStr] || [];
              return (
                <div
                  key={dStr}
                  className="relative border-l bg-white"
                  style={{ height: gridHeightWeek }}
                  ref={(el) => (gridRefs.current[dStr] = el)}
                  onMouseDown={(e) => onMouseDownDayW(e, dStr)}
                  onMouseMove={(e) => onMouseMoveDayW(e, dStr)}
                  onMouseUp={(e) => onMouseUpDayW(e, dStr)}
                  onDoubleClick={(e) => onDblClickDayW(e, dStr)}
                  onDragOver={allowDrop}
                  onDrop={(e) => onDropInDay(e, dStr)}
                  title="Drag to create; double-click to create; drop to move"
                >
                  {/* hour lines */}
                  {hours.map((m) => {
                    const top = (m - weekWindow.startM) * 1;
                    return <div key={m} className="absolute left-0 right-0" style={{ top }}><div className="border-t border-zinc-200" /></div>;
                  })}
                  {/* half hour lines */}
                  {hours.slice(0, -1).map((m) => {
                    const top = (m - weekWindow.startM + 30) * 1;
                    return <div key={`h-${m}`} className="absolute left-0 right-0" style={{ top }}><div className="border-t border-dashed border-zinc-200" /></div>;
                  })}

                  {/* selection rectangle */}
                  {selW?.active && selW.dateStr === dStr && (
                    <div
                      className="absolute left-1 right-1 rounded bg-blue-500/10 border border-blue-400/50 pointer-events-none"
                      style={{ top: Math.min(selW.y0, selW.y1), height: Math.abs(selW.y1 - selW.y0) }}
                    />
                  )}

                  {/* events */}
                  {list.map((a) => {
                    const color = typeColor(a.typeId);
                    return (
                      <div
                        key={a.id}
                        data-evt="1"
                        draggable
                        onDragStart={(e) => onDragStartWeek(e, a, dStr)}
                        onClick={() => openEditWeek(a, dStr)}
                        className="absolute left-2 right-2 cursor-grab rounded-md border p-2 text-xs shadow active:cursor-grabbing"
                        style={{ top: a._top, height: a._height, borderColor: color, background: hexToRgba(color, 0.16) }}
                        title="Drag vertically to change time; drop in another day to move"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium truncate">{a.title || "Appointment"}</div>
                          <span className="rounded-full border px-2 py-0.5 text-[10px]" style={{ borderColor: color }}>
                            {settings.appointmentTypes?.find((t) => t.id === a.typeId)?.name || "Type"}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-zinc-600">{a.start}–{a.end}</div>
                        {a.notes && <div className="mt-1 line-clamp-2 text-[11px] text-zinc-500">{a.notes}</div>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* New/Edit forms */}
          {newForm && newForm.dateStr && (
            <EditorNewWeek newForm={newForm} setNewForm={setNewForm} settings={settings} step={step} saveNew={saveNew} />
          )}
          {editForm && editForm.dateStr && (
            <EditorEdit editForm={editForm} setEditForm={setEditForm} settings={settings} step={step} saveEdit={saveEdit} deleteEdit={deleteEdit} />
          )}
        </Card>
      </div>
    );
  }

  // DAY VIEW
  const hours = hoursArray(dayWindow.startM, dayWindow.endM);
  return (
    <div className="mx-auto w-full max-w-screen-2xl p-4">
      <Card
        title={`Calendar — Day (${new Date(dateStr).toLocaleDateString(undefined, { weekday: "long" })})`}
        subtitle={shopInfo?.shopName ? `Shop: ${shopInfo.shopName}` : "Configure shop in Admin → Shop Info"}
        right={
          <div className="flex items-center gap-2">
            <button className="rounded-lg border px-2 py-1 text-sm" onClick={() => changeDay(-1)}>◀ Prev</button>
            <input type="date" className="rounded-lg border px-2 py-1 text-sm" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
            <button className="rounded-lg border px-2 py-1 text-sm" onClick={() => setDateStr(toLocalYMD(new Date()))}>Today</button>
            <button className="rounded-lg border px-2 py-1 text-sm" onClick={() => changeDay(1)}>Next ▶</button>
            <Pill>{dayWindow.isOpen ? "Open" : "Closed"}</Pill>
          </div>
        }
      >
        {!dayWindow.isOpen && <div className="mb-3 rounded-lg border bg-zinc-50 p-3 text-sm text-zinc-600">This day is marked as <b>closed</b>. Drag/double-click to add is disabled.</div>}

        <div className="grid" style={{ gridTemplateColumns: `64px minmax(0, 1fr)` }}>
          {/* gutter */}
          <div className="relative" style={{ height: gridHeightDay }}>
            {hours.map((m) => {
              const top = (m - dayWindow.startM) * 1 - 7;
              const h = Math.floor(m / 60);
              const label = `${((h + 11) % 12) + 1}${m % 60 === 0 ? "" : ":30"} ${h < 12 ? "AM" : "PM"}`;
              return (
                <div key={m} className="absolute left-0 right-0" style={{ top }}>
                  <div className="px-1 text-right text-[10px] text-zinc-500 select-none">{label}</div>
                </div>
              );
            })}
          </div>

          {/* main column */}
          <div
            ref={gridRef}
            className="relative border-l bg-white"
            style={{ height: gridHeightDay }}
            onDragOver={allowDrop}
            onDrop={onDropDay}
            onDoubleClick={onDblClickDay}
            onMouseDown={onMouseDownDay}
            onMouseMove={onMouseMoveDay}
            onMouseUp={onMouseUpDay}
            title={dayWindow.isOpen ? "Drag or double-click to create" : "Closed"}
          >
            {/* hour lines */}
            {hours.map((m) => {
              const top = (m - dayWindow.startM) * 1;
              return <div key={m} className="absolute left-0 right-0" style={{ top }}><div className="border-t border-zinc-200" /></div>;
            })}
            {/* half hour */}
            {hours.slice(0, -1).map((m) => {
              const top = (m - dayWindow.startM + 30) * 1;
              return <div key={`h-${m}`} className="absolute left-0 right-0" style={{ top }}><div className="border-t border-dashed border-zinc-200" /></div>;
            })}

            {/* selection rect */}
            {sel?.active && (
              <div className="absolute left-1 right-1 rounded bg-blue-500/10 border border-blue-400/50 pointer-events-none"
                   style={{ top: Math.min(sel.y0, sel.y1), height: Math.abs(sel.y1 - sel.y0) }}/>
            )}

            {/* events */}
            {positionedDay.map((a) => {
              const color = typeColor(a.typeId);
              return (
                <div
                  key={a.id}
                  data-evt="1"
                  draggable
                  onDragStart={(e) => onDragStartDay(e, a)}
                  onClick={() => openEditDay(a)}
                  className="absolute left-2 right-2 cursor-grab rounded-md border p-2 text-xs shadow active:cursor-grabbing"
                  style={{ top: a._top, height: a._height, borderColor: color, background: hexToRgba(color, 0.16) }}
                  title="Drag vertically to change time"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium truncate">{a.title || "Appointment"}</div>
                    <span className="rounded-full border px-2 py-0.5 text-[10px]" style={{ borderColor: color }}>
                      {settings.appointmentTypes?.find((t) => t.id === a.typeId)?.name || "Type"}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-600">{a.start}–{a.end}</div>
                  {a.notes && <div className="mt-1 line-clamp-2 text-[11px] text-zinc-500">{a.notes}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* New/Edit (day) */}
        {newForm && !newForm.dateStr && (
          <EditorNewDay newForm={newForm} setNewForm={setNewForm} settings={settings} step={step} saveNew={saveNew} />
        )}
        {editForm && !editForm.dateStr && (
          <EditorEdit editForm={editForm} setEditForm={setEditForm} settings={settings} step={step} saveEdit={saveEdit} deleteEdit={deleteEdit} />
        )}
      </Card>
    </div>
  );
}

/* ---------- Small editors (use top-level helpers) ---------- */
function EditorNewDay({ newForm, setNewForm, settings, step, saveNew }) {
  return (
    <div className="mt-3 rounded-lg border bg-white p-3 text-sm">
      <div className="grid gap-2 md:grid-cols-5">
        <div className="md:col-span-3">
          <label className="text-xs">Title</label>
          <input className="mt-1 w-full rounded border px-2 py-1" value={newForm.title} onChange={(e) => setNewForm({ ...newForm, title: e.target.value })} placeholder="Appointment" />
        </div>
        <div>
          <label className="text-xs">Type</label>
          <select className="mt-1 w-full rounded border px-2 py-1" value={newForm.typeId} onChange={(e) => setNewForm({ ...newForm, typeId: e.target.value })}>
            {settings.appointmentTypes?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div />
        <div>
          <label className="text-xs">Start</label>
          <input className="mt-1 w-full rounded border px-2 py-1" type="time" value={toHHMM(newForm.startM)} onChange={(e) => setNewForm({ ...newForm, startM: roundTo(parseHHMM(e.target.value), step) })} />
        </div>
        <div>
          <label className="text-xs">End</label>
          <input className="mt-1 w-full rounded border px-2 py-1" type="time" value={toHHMM(newForm.endM)} onChange={(e) => setNewForm({ ...newForm, endM: roundTo(parseHHMM(e.target.value), step) })} />
        </div>
        <div className="md:col-span-5">
          <label className="text-xs">Notes</label>
          <textarea className="mt-1 w-full rounded border px-2 py-1" rows={2} value={newForm.notes} onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })} />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-2">
        <button className="rounded border px-3 py-1 text-xs" onClick={() => setNewForm(null)}>Cancel</button>
        <button className="rounded bg-zinc-900 px-3 py-1 text-xs text-white" onClick={saveNew}>Save</button>
      </div>
    </div>
  );
}

function EditorNewWeek({ newForm, setNewForm, settings, step, saveNew }) {
  return (
    <div className="mt-3 rounded-lg border bg-white p-3 text-sm">
      <div className="grid gap-2 md:grid-cols-5">
        <div className="md:col-span-3">
          <label className="text-xs">Title</label>
          <input className="mt-1 w-full rounded border px-2 py-1" value={newForm.title} onChange={(e) => setNewForm({ ...newForm, title: e.target.value })} placeholder="Appointment" />
        </div>
        <div>
          <label className="text-xs">Type</label>
          <select className="mt-1 w-full rounded border px-2 py-1" value={newForm.typeId} onChange={(e) => setNewForm({ ...newForm, typeId: e.target.value })}>
            {settings.appointmentTypes?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div />
        <div>
          <label className="text-xs">Start</label>
          <input className="mt-1 w-full rounded border px-2 py-1" type="time" value={toHHMM(newForm.startM)} onChange={(e) => setNewForm({ ...newForm, startM: roundTo(parseHHMM(e.target.value), step) })} />
        </div>
        <div>
          <label className="text-xs">End</label>
          <input className="mt-1 w-full rounded border px-2 py-1" type="time" value={toHHMM(newForm.endM)} onChange={(e) => setNewForm({ ...newForm, endM: roundTo(parseHHMM(e.target.value), step) })} />
        </div>
        <div className="md:col-span-5">
          <label className="text-xs">Notes</label>
          <textarea className="mt-1 w-full rounded border px-2 py-1" rows={2} value={newForm.notes} onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })} />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="text-xs text-zinc-500">For: {new Date(newForm.dateStr).toLocaleDateString()}</div>
        <div className="flex items-center gap-2">
          <button className="rounded border px-3 py-1 text-xs" onClick={() => setNewForm(null)}>Cancel</button>
          <button className="rounded bg-zinc-900 px-3 py-1 text-xs text-white" onClick={saveNew}>Save</button>
        </div>
      </div>
    </div>
  );
}

function EditorEdit({ editForm, setEditForm, settings, step, saveEdit, deleteEdit }) {
  return (
    <div className="mt-3 rounded-lg border bg-white p-3 text-sm">
      <div className="grid gap-2 md:grid-cols-5">
        <div className="md:col-span-3">
          <label className="text-xs">Title</label>
          <input className="mt-1 w-full rounded border px-2 py-1" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
        </div>
        <div>
          <label className="text-xs">Type</label>
          <select className="mt-1 w-full rounded border px-2 py-1" value={editForm.typeId} onChange={(e) => setEditForm({ ...editForm, typeId: e.target.value })}>
            {settings.appointmentTypes?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div />
        <div>
          <label className="text-xs">Start</label>
          <input className="mt-1 w-full rounded border px-2 py-1" type="time" value={toHHMM(editForm.startM)} onChange={(e) => setEditForm({ ...editForm, startM: roundTo(parseHHMM(e.target.value), step) })} />
        </div>
        <div>
          <label className="text-xs">End</label>
          <input className="mt-1 w-full rounded border px-2 py-1" type="time" value={toHHMM(editForm.endM)} onChange={(e) => setEditForm({ ...editForm, endM: roundTo(parseHHMM(e.target.value), step) })} />
        </div>
        <div className="md:col-span-5">
          <label className="text-xs">Notes</label>
          <textarea className="mt-1 w-full rounded border px-2 py-1" rows={2} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button className="rounded border px-3 py-1 text-xs text-red-600" onClick={deleteEdit}>Delete</button>
        <div className="flex items-center gap-2">
          <button className="rounded border px-3 py-1 text-xs" onClick={() => setEditForm(null)}>Close</button>
          <button className="rounded bg-zinc-900 px-3 py-1 text-xs text-white" onClick={saveEdit}>Save</button>
        </div>
      </div>
    </div>
  );
}
