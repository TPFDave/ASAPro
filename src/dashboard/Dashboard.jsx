// src/dashboard/Dashboard.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";
import { db } from "../lib/firebase";
import {
  collection, doc, onSnapshot, orderBy, query, serverTimestamp,
  updateDoc, where, setDoc
} from "firebase/firestore";
import {
  Settings as SettingsIcon, Wrench, ListChecks, TrendingUp, DollarSign,
  X, Pencil, PlayCircle, LayoutGrid, List, Search, BadgeDollarSign
} from "lucide-react";

/* ---------------------- small UI bits ---------------------- */
const Container = ({ children }) => <div className="mx-auto w-full max-w-screen-2xl p-4">{children}</div>;
const Card = ({ children, title, subtitle, className = "" }) => (
  <div className={`rounded-2xl border bg-white p-6 shadow-sm ${className}`}>
    {title && <h1 className="text-xl font-semibold">{title}</h1>}
    {subtitle && <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>}
    <div className="mt-4">{children}</div>
  </div>
);
const Field = ({ label, children }) => (
  <label className="block">
    <div className="text-xs font-medium text-zinc-600">{label}</div>
    <div className="mt-1">{children}</div>
  </label>
);
const Input = (props) => <input {...props} className={"w-full rounded border px-3 py-2 " + (props.className || "")} />;
const Select = (props) => <select {...props} className={"w-full rounded border px-3 py-2 " + (props.className || "")} />;
const Checkbox = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2 text-sm">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span>{label}</span>
  </label>
);

/* ---------------------- date helpers (monthly) ---------------------- */
function monthStart(d = new Date()) { const x = new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }
function addMonths(d, n) { const x = new Date(d); x.setMonth(x.getMonth()+n); return monthStart(x); }
function monthEnd(d) { return addMonths(monthStart(d), 1); } // exclusive
function fmtMonthLabel(d) { return monthStart(d).toLocaleDateString(undefined, { year: "numeric", month: "long" }); }

/* ---------------------- time calculations ---------------------- */
function hours(ms){ return Math.round((ms/36e5)*100)/100; }
function computeEmployeeHours(logs){
  let totalMs=0, currentIn=null, lunchOut=null;
  for (const log of logs){
    if (log.action==="clockIn"){ currentIn=new Date(log.at); lunchOut=null; }
    else if (log.action==="lunchOut"){ lunchOut=new Date(log.at); }
    else if (log.action==="clockOut" && currentIn){
      const out=new Date(log.at); let stint=out-currentIn;
      if (lunchOut){
        const lunchIn=logs.find(l=>l.action==="lunchIn" && new Date(l.at)>lunchOut && new Date(l.at)<=out);
        if (lunchIn) stint-= (new Date(lunchIn.at)-lunchOut);
      }
      if (stint>0) totalMs+=stint;
      currentIn=null; lunchOut=null;
    }
  }
  return hours(totalMs);
}

/* ---------------------- settings flyout ---------------------- */
function SettingsFlyout({ open, onClose, settings, onChange, onSave }) {
  if (!open) return null;
  const s = settings || {};
  const kpi = s.kpiToggles || {};
  const statuses = s.statusOptions || [];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20">
      <div className="h-full w-full max-w-md overflow-auto bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-semibold">Dashboard Settings</div>
          <button onClick={onClose} className="rounded-lg border px-2 py-1 text-sm">
            <X className="mr-1 inline h-4 w-4" /> Close
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <div className="mb-2 text-sm font-semibold">KPI Modules</div>
            <div className="grid gap-2">
              <Checkbox label="Shop Efficiency (Worked vs Flagged)" checked={!!kpi.efficiency}
                onChange={(v)=>onChange({ kpiToggles:{ ...kpi, efficiency:v }})}/>
              <Checkbox label="Inspection Effort (Checked-in vs Inspected)" checked={!!kpi.inspection}
                onChange={(v)=>onChange({ kpiToggles:{ ...kpi, inspection:v }})}/>
              <Checkbox label="Labor Profitability Estimator" checked={!!kpi.profitability}
                onChange={(v)=>onChange({ kpiToggles:{ ...kpi, profitability:v }})}/>
              <Checkbox label="Totals (processed / inspected / flagged hours)" checked={!!kpi.totals}
                onChange={(v)=>onChange({ kpiToggles:{ ...kpi, totals:v }})}/>
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold">Estimator Inputs</div>
            <div className="grid gap-2 md:grid-cols-2">
              <Field label="Labor Rate ($/flag hr)">
                <Input inputMode="decimal" value={s.laborRate ?? ""} placeholder="125"
                  onChange={(e)=>onChange({ laborRate:Number(e.target.value||0) })}/>
              </Field>
              <Field label="Monthly Overhead ($)">
                <Input inputMode="decimal" value={s.monthlyOverhead ?? s.weeklyOverhead ?? ""} placeholder="20000"
                  onChange={(e)=>onChange({ monthlyOverhead:Number(e.target.value||0) })}/>
              </Field>
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold">Workflow Statuses</div>
            <div className="text-xs text-zinc-600 mb-2">Customize labels/colors. Keys are internal.</div>
            {statuses.map((st,i)=>(
              <div key={st.key||i} className="mb-2 grid gap-2 md:grid-cols-3">
                <Field label="Key"><Input value={st.key}
                  onChange={e=>{ const copy=[...statuses]; copy[i]={...st,key:e.target.value}; onChange({statusOptions:copy}); }}/></Field>
                <Field label="Label"><Input value={st.label}
                  onChange={e=>{ const copy=[...statuses]; copy[i]={...st,label:e.target.value}; onChange({statusOptions:copy}); }}/></Field>
                <Field label="Color (Tailwind)"><Input value={st.color}
                  onChange={e=>{ const copy=[...statuses]; copy[i]={...st,color:e.target.value}; onChange({statusOptions:copy}); }}/></Field>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold">View Preferences</div>
            <div className="grid gap-2 md:grid-cols-3">
              <Field label="Default View">
                <Select value={s.uiPrefs?.viewMode || "tiled"} onChange={e=>onChange({ uiPrefs:{ ...(s.uiPrefs||{}), viewMode:e.target.value }})}>
                  <option value="tiled">Tiled</option>
                  <option value="list">List</option>
                </Select>
              </Field>
              <Field label="List Sort">
                <Select value={s.uiPrefs?.listSort || "status"} onChange={e=>onChange({ uiPrefs:{ ...(s.uiPrefs||{}), listSort:e.target.value }})}>
                  <option value="status">Status</option>
                  <option value="created">Created</option>
                </Select>
              </Field>
              <Field label="Show Paid/Archived by Default">
                <Select value={String(!!s.uiPrefs?.showCompleted)} onChange={e=>onChange({ uiPrefs:{ ...(s.uiPrefs||{}), showCompleted: e.target.value==="true" }})}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </Select>
              </Field>
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold">Retention</div>
            <div className="grid gap-2 md:grid-cols-2">
              <Field label="Auto-archive after (days)">
                <Input inputMode="numeric" value={s.retentionDays ?? 60} onChange={(e)=>onChange({ retentionDays: Number(e.target.value||0) })}/>
              </Field>
              <div className="text-xs text-zinc-600">
                Paid or completed older than this are moved to <code>status: "archived"</code>.
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={onSave} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- KPI tile ---------------------- */
function Kpi({ icon, label, value, hint }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center gap-2 text-xs text-zinc-500">{icon}<span>{label}</span></div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint && <div className="text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

/* ---------------------- tiny toast ---------------------- */
function Toast({ msg, onClose }) {
  if (!msg) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="rounded-xl border bg-white px-4 py-2 text-sm shadow-lg">
        {msg}
        <button className="ml-3 text-xs underline" onClick={onClose}>Dismiss</button>
      </div>
    </div>
  );
}

/* ---------------------- appointment modal ---------------------- */
function AppointmentModal({ appt, statusOptions, onClose, onChangeStatus, onUpdateFlagged, onStartInspection, onMarkPaid }) {
  if (!appt) return null;
  const st = (statusOptions||[]).find(s=>s.key===appt.status) || { label: appt.status, color: "bg-zinc-50" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-2xl border bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-semibold">Appointment</div>
          <button className="rounded-lg border px-3 py-1 text-sm" onClick={onClose}><X className="mr-1 inline h-4 w-4" />Close</button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className={`rounded-xl border p-3 ${st.color}`}>
            <div className="font-semibold">{appt.customerName || "Customer"}</div>
            <div className="text-xs text-zinc-700">{appt.vehicleLabel || "Vehicle"} {appt.vin ? `• ${appt.vin}` : ""}</div>
            {appt.reason && <div className="mt-1 text-xs text-zinc-700">Concern: {appt.reason}</div>}
          </div>

          <div className="grid gap-2">
            <Field label="Status">
              <Select value={appt.status || "in_queue"} onChange={(e)=>onChangeStatus(appt, e.target.value)}>
                {statusOptions.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </Select>
            </Field>
            <Field label="Flagged Hours">
              <Input
                inputMode="decimal"
                step="0.1"
                placeholder="0.0"
                defaultValue={appt.flaggedHours ?? ""}
                onBlur={(e)=>onUpdateFlagged(appt, e.target.value)}
              />
            </Field>
            <div className="flex gap-2">
              {!appt.inspectionStarted ? (
                <button onClick={()=>onStartInspection(appt)} className="rounded-lg border px-3 py-2 text-sm">
                  <PlayCircle className="mr-1 inline h-4 w-4" /> Start Inspection
                </button>
              ) : (
                <button onClick={()=>{/* navigate later */}} className="rounded-lg border px-3 py-2 text-sm">
                  <Pencil className="mr-1 inline h-4 w-4" /> Update Inspection
                </button>
              )}
              <button onClick={()=>onMarkPaid(appt)} className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">
                <BadgeDollarSign className="mr-1 inline h-4 w-4" /> Mark Paid
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <div><span className="text-xs text-zinc-500">Pickup:</span><div className="text-sm">{appt?.pickup?.sameDay ? "Same day" : (appt?.pickup?.at ? new Date(appt.pickup.at).toLocaleString() : "—")}</div></div>
          <div><span className="text-xs text-zinc-500">Pre-Auth:</span><div className="text-sm">${appt?.agreements?.preAuthAmount ?? 0}</div></div>
          <div><span className="text-xs text-zinc-500">Diag Fee Agreed:</span><div className="text-sm">{appt?.agreements?.diagAccepted ? "Yes" : "No"}</div></div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- main dashboard ---------------------- */
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const shopId = user?.uid;

  // Period controls
  const [mode, setMode] = useState("this"); // this | last | custom | lifetime
  const [customMonth, setCustomMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  });

  // Settings state (and flyout)
  const [settings, setSettings] = useState(null);
  const [settingsEdit, setSettingsEdit] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // UI prefs (persisted)
  const [viewMode, setViewMode] = useState("tiled"); // 'tiled' | 'list'
  const [listSort, setListSort] = useState("status"); // 'status' | 'created'
  const [showCompleted, setShowCompleted] = useState(false); // now means "show paid/archived"

  // Data
  const [timeLogs, setTimeLogs] = useState([]);
  const [appts, setAppts] = useState([]);

  // Search / toast / modal
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(null);

  // Active month bounds
  const period = useMemo(() => {
    if (mode === "lifetime") return { label: "Lifetime", startMs: null, endMs: null };
    const now = new Date();
    let mStart = monthStart(now);
    if (mode === "last") mStart = addMonths(mStart, -1);
    if (mode === "custom") {
      const [y,m] = customMonth.split("-").map(Number);
      mStart = monthStart(new Date(y, m-1, 1));
    }
    const mEnd = monthEnd(mStart);
    return { label: fmtMonthLabel(mStart), startMs: mStart.getTime(), endMs: mEnd.getTime() };
  }, [mode, customMonth]);

  // load settings + streams
  useEffect(() => {
    if (!shopId) return;

    const sref = doc(db, "shops", shopId, "settings", "dashboard");
    const unsubS = onSnapshot(sref, (snap) => {
      if (snap.exists()) {
        const s = snap.data();
        setSettings(s);
        if (s.uiPrefs) {
          if (s.uiPrefs.viewMode) setViewMode(s.uiPrefs.viewMode);
          if (s.uiPrefs.listSort) setListSort(s.uiPrefs.listSort);
          if (typeof s.uiPrefs.showCompleted === "boolean") setShowCompleted(s.uiPrefs.showCompleted);
        }
      } else {
        const def = {
          kpiToggles: { efficiency: true, inspection: true, profitability: true, totals: true },
          laborRate: 125,
          monthlyOverhead: 20000,
          retentionDays: 60,
          statusOptions: [
            { key: "in_queue", label: "In Queue", color: "bg-zinc-100" },
            { key: "awaiting_approval", label: "Awaiting Approval", color: "bg-yellow-100" },
            { key: "in_service", label: "In Service", color: "bg-blue-100" },
            { key: "urgent", label: "URGENT", color: "bg-red-100" },
            { key: "complete", label: "Complete", color: "bg-green-100" },
          ],
          uiPrefs: { viewMode: "tiled", listSort: "status", showCompleted: false },
        };
        setSettings(def);
        setDoc(sref, def, { merge: true });
      }
    });

    // time logs: month range (or all for lifetime)
    let unsubTL;
    if (period.startMs != null && period.endMs != null) {
      unsubTL = onSnapshot(
        query(
          collection(db, "shops", shopId, "timeLogs"),
          where("atMs", ">=", period.startMs),
          where("atMs", "<", period.endMs),
          orderBy("atMs", "asc")
        ),
        (snap) => setTimeLogs(snap.docs.map(d => ({ id:d.id, ...d.data() })))
      );
    } else {
      unsubTL = onSnapshot(
        query(collection(db, "shops", shopId, "timeLogs"), orderBy("atMs", "asc")),
        (snap) => setTimeLogs(snap.docs.map(d => ({ id:d.id, ...d.data() })))
      );
    }

    // appointments (order by created desc; filter client-side)
    const unsubA = onSnapshot(
      query(collection(db, "shops", shopId, "appointments"), orderBy("createdAt", "desc")),
      (snap) => setAppts(snap.docs.map(d => ({ id:d.id, ...d.data() })))
    );

    return () => { unsubS&&unsubS(); unsubTL&&unsubTL(); unsubA&&unsubA(); };
  }, [shopId, period.startMs, period.endMs]);

  // persist UI prefs when toggled
  const persistUIPrefs = async (patch) => {
    const next = { ...(settings?.uiPrefs || {}), ...patch };
    setSettings((prev)=> ({ ...(prev||{}), uiPrefs: next }));
    await setDoc(doc(db, "shops", shopId, "settings", "dashboard"), { uiPrefs: next }, { merge: true });
  };

  // KPI calcs
  const logsByEmp = useMemo(() => {
    const map=new Map();
    for (const l of timeLogs){ if (!map.has(l.employeeId)) map.set(l.employeeId, []); map.get(l.employeeId).push(l); }
    for (const arr of map.values()) arr.sort((a,b)=>a.atMs-b.atMs);
    return map;
  }, [timeLogs]);

  const totalWorkedHrs = useMemo(() => {
    let sum=0; for (const arr of logsByEmp.values()) sum+=computeEmployeeHours(arr);
    return Math.round(sum*100)/100;
  }, [logsByEmp]);

  const monthAppts = useMemo(() => {
    if (mode==="lifetime") return appts;
    const s=period.startMs, e=period.endMs;
    return appts.filter(a => {
      const ms = (a.createdAt && typeof a.createdAt.toMillis==="function" && a.createdAt.toMillis()) || a.createdAtMs || 0;
      return ms>=s && ms<e;
    });
  }, [appts, mode, period]);

  const totals = useMemo(() => {
    const processed = monthAppts.length;
    const inspected = monthAppts.filter(a=>!!a.inspectionStarted).length;
    const flagged = monthAppts.reduce((acc,a)=>acc + Number(a.flaggedHours||0), 0);
    return { processed, inspected, flagged };
  }, [monthAppts]);

  const efficiencyPct = useMemo(() => {
    const flagged = totals.flagged || 0;
    if (!flagged) return "0%";
    return `${Math.round((totalWorkedHrs/flagged)*100)}%`;
  }, [totalWorkedHrs, totals.flagged]);

  const profitability = useMemo(() => {
    const lr = Number(settings?.laborRate || 0);
    const oh = settings?.monthlyOverhead != null
      ? Number(settings.monthlyOverhead)
      : (settings?.weeklyOverhead ? Number(settings.weeklyOverhead)*4.33 : 0);
    const payrollEstimate = 0; // future: compute from employee rates
    const revenue = (totals.flagged||0) * lr;
    const est = revenue - (oh + payrollEstimate);
    return { revenue, est, oh };
  }, [settings, totals.flagged]);

  // Workflow helpers
  const statusOptions = settings?.statusOptions || [];
  const statusMetaByKey = useMemo(() => {
    const m = new Map();
    for (const s of statusOptions) m.set(s.key, s);
    return m;
  }, [statusOptions]);

  // Search + sort + hide-paid/archived pipeline
  const filteredAppts = useMemo(() => {
    const q = search.trim().toLowerCase();
    // HIDE if paid or archived unless toggle is on
    const base = monthAppts.filter(a => showCompleted ? true : (!a.paidAt && a.status !== "archived"));
    const sorted = (arr) => {
      const c = arr.slice();
      if (viewMode === "list") {
        if (listSort === "status") {
          c.sort((a,b) => (a.status||"").localeCompare(b.status||"") || (b.createdAt?.toMillis?.()||0) - (a.createdAt?.toMillis?.()||0));
        } else {
          c.sort((a,b) => (b.createdAt?.toMillis?.()||0) - (a.createdAt?.toMillis?.()||0));
        }
      }
      return c;
    };
    if (!q) return sorted(base);
    const scored = base.map(a => {
      const hay = [a.customerName, a.vehicleLabel, a.vin, a.reason].filter(Boolean).join(" ").toLowerCase();
      const hit = hay.includes(q);
      return { a, hit };
    });
    const hits = scored.filter(s=>s.hit).map(s=>s.a);
    const miss = scored.filter(s=>!s.hit).map(s=>s.a);
    return sorted(hits.concat(miss));
  }, [monthAppts, search, showCompleted, viewMode, listSort]);

  // keyboard: Enter in search opens first match modal
  const searchInputRef = useRef(null);
  const onSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      const top = filteredAppts[0];
      if (top) setModal(top);
    }
  };

  const onChangeStatus = async (a,key) => {
    await updateDoc(doc(db,"shops",shopId,"appointments",a.id), { status:key, updatedAt: serverTimestamp() });
  };

  // store null if blank, else a number (0 allowed)
  const onUpdateFlagged = async (a, value) => {
    const v = String(value ?? "").trim();
    await updateDoc(doc(db,"shops",shopId,"appointments",a.id), {
      flaggedHours: v === "" ? null : Number(v),
      updatedAt: serverTimestamp()
    });
  };

  // now also navigates to inspections with prefill
  const onStartInspection = async (a) => {
    await updateDoc(doc(db,"shops",shopId,"appointments",a.id), { inspectionStarted:true, updatedAt: serverTimestamp() });
    navigate(`/inspections?apptId=${a.id}`);
  };

  // Mark Paid accepts 0.0 — requires status 'complete' and flaggedHours is a number
  const onMarkPaid = async (a) => {
    if ((a.status || "") !== "complete") {
      setToast("Set status to Complete before marking paid.");
      return;
    }
    const hasNumber = typeof a.flaggedHours === "number" && !Number.isNaN(a.flaggedHours);
    if (!hasNumber) {
      setToast("Enter flagged hours (0.0 is allowed) before marking paid.");
      return;
    }
    await updateDoc(doc(db,"shops",shopId,"appointments",a.id), {
      paid: true, paidAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
  };

  // passive archiver: move old paid/completed to archived
  useEffect(() => {
    const days = Number(settings?.retentionDays || 0);
    if (!days) return;
    const cutoff = Date.now() - days*24*3600*1000;
    const toArchive = monthAppts.filter(a => (
      (a.paidAt?.toMillis?.()||0) < cutoff ||
      (a.status==="complete" && (a.completedAt?.toMillis?.()||0) < cutoff)
    )).slice(0, 10);
    toArchive.forEach(async a => {
      await updateDoc(doc(db,"shops",shopId,"appointments",a.id), { status:"archived", archivedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    });
  }, [monthAppts, settings?.retentionDays, shopId]);

  // settings handlers
  const openSettings = () => { setSettingsEdit(settings ? JSON.parse(JSON.stringify(settings)) : {}); setShowSettings(true); };
  const applyChange = (patch) => setSettingsEdit(prev => ({ ...(prev||{}), ...patch }));
  const saveSettings = async () => { await setDoc(doc(db,"shops",shopId,"settings","dashboard"), settingsEdit, { merge:true }); setShowSettings(false); };
  const kpiOn = (k) => !!settings?.kpiToggles?.[k];

  const tintClass = (color) => color ? `${color} ${color.includes("/") ? "" : "bg-opacity-60"}` : "";

  return (
    <Container>
      {/* KPI BAR */}
      <Card title="KPIs" subtitle="Month-to-month metrics (reset on the 1st).">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="text-xs text-zinc-500">
            {mode==="lifetime" ? "Viewing: Lifetime" : `Viewing: ${period.label}`}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={mode} onChange={(e)=>setMode(e.target.value)} style={{ width: 170 }}>
              <option value="this">This Month</option>
              <option value="last">Last Month</option>
              <option value="custom">Custom Month…</option>
              <option value="lifetime">Lifetime</option>
            </Select>
            {mode==="custom" && (
              <Input type="month" value={customMonth} onChange={(e)=>setCustomMonth(e.target.value)} style={{ width: 160 }} />
            )}
            <button onClick={openSettings} className="rounded-lg border px-2 py-1 text-xs">
              <SettingsIcon className="mr-1 inline h-4 w-4" /> Customize
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {kpiOn("efficiency") && (
            <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Shop Efficiency"
                 value={efficiencyPct}
                 hint={`${totalWorkedHrs.toFixed(2)} worked hrs / ${totals.flagged.toFixed(2)} flagged hrs`} />
          )}
          {kpiOn("inspection") && (
            <Kpi icon={<ListChecks className="h-4 w-4" />} label="Inspection Effort"
                 value={`${totals.inspected}/${totals.processed}`} hint="Inspected / Processed (month)" />
          )}
          {kpiOn("profitability") && (
            <Kpi icon={<DollarSign className="h-4 w-4" />} label="Labor Profitability (est.)"
                 value={`$${Math.round(profitability.est).toLocaleString()}`}
                 hint={`Revenue $${Math.round(profitability.revenue).toLocaleString()} – Overhead $${Math.round(profitability.oh).toLocaleString()}`} />
          )}
          {kpiOn("totals") && (
            <Kpi icon={<Wrench className="h-4 w-4" />} label="Totals (month)"
                 value={`${totals.processed} / ${totals.inspected} / ${totals.flagged.toFixed(1)}`}
                 hint="Processed / Inspected / Flagged hrs" />
          )}
        </div>
      </Card>

      {/* WORKFLOW */}
      <Card className="mt-4" title="Workflow" subtitle="Every vehicle on the premises.">
        {/* Toolbar */}
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <button
              className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm ${viewMode==='tiled' ? 'bg-zinc-900 text-white' : ''}`}
              onClick={()=>{ setViewMode('tiled'); persistUIPrefs({ viewMode:'tiled' }); }}
            >
              <LayoutGrid className="h-4 w-4" /> Tiled
            </button>
            <button
              className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm ${viewMode==='list' ? 'bg-zinc-900 text-white' : ''}`}
              onClick={()=>{ setViewMode('list'); persistUIPrefs({ viewMode:'list' }); }}
            >
              <List className="h-4 w-4" /> List
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full md:w-80">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                ref={searchInputRef}
                className="w-full rounded border pl-8 pr-3 py-2 text-sm"
                placeholder="Search name, vehicle, VIN, reason (press Enter to open)"
                value={search}
                onChange={(e)=>setSearch(e.target.value)}
                onKeyDown={onSearchKeyDown}
              />
            </div>

            {viewMode === "list" && (
              <Select value={listSort} onChange={(e)=>{ setListSort(e.target.value); persistUIPrefs({ listSort:e.target.value }); }} style={{ width: 160 }}>
                <option value="status">Sort: Status</option>
                <option value="created">Sort: Created</option>
              </Select>
            )}

            <Checkbox label="Show paid/archived" checked={showCompleted} onChange={(v)=>{ setShowCompleted(v); persistUIPrefs({ showCompleted:v }); }} />
          </div>
        </div>

        {/* Tiled view */}
        {viewMode === "tiled" && (
          <div className="grid gap-3 md:grid-cols-2">
            {filteredAppts.map(a=>{
              const st = statusMetaByKey.get(a.status) || {label:a.status, color:"bg-zinc-50"};
              return (
                <div key={a.id} className={`rounded-xl border p-3 ${tintClass(st.color)}`}>
                  <div className="flex items-center justify-between">
                    <div onClick={()=>setModal(a)} className="cursor-pointer">
                      <div className="font-semibold">{a.customerName || "Customer"}</div>
                      <div className="text-xs text-zinc-700">
                        {a.vehicleLabel || "Vehicle"} {a.vin ? `• ${a.vin}` : ""}
                      </div>
                      {a.reason && <div className="mt-1 text-xs text-zinc-700">Concern: {a.reason}</div>}
                    </div>
                    <div className={`rounded-full px-2 py-0.5 text-xs bg-white/50 border`}>{st.label || "Status"}</div>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-4">
                    <Field label="Status">
                      <Select value={a.status || "in_queue"} onChange={(e)=>onChangeStatus(a, e.target.value)}>
                        {statusOptions.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </Select>
                    </Field>

                    <Field label="Flagged Hours">
                      <Input
                        inputMode="decimal"
                        step="0.1"
                        placeholder="0.0"
                        defaultValue={a.flaggedHours ?? ""}
                        onBlur={(e)=>onUpdateFlagged(a, e.target.value)}
                      />
                    </Field>

                    <div className="flex items-end">
                      {!a.inspectionStarted ? (
                        <button onClick={()=>onStartInspection(a)} className="w-full rounded-lg border px-3 py-2 text-sm">
                          <PlayCircle className="mr-1 inline h-4 w-4" /> Start Inspection
                        </button>
                      ) : (
                        <button onClick={()=>{/* navigate later */}} className="w-full rounded-lg border px-3 py-2 text-sm">
                          <Pencil className="mr-1 inline h-4 w-4" /> Update Inspection
                        </button>
                      )}
                    </div>

                    <div className="flex items-end">
                      <button
                        onClick={()=>onMarkPaid(a)}
                        className="w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
                      >
                        <BadgeDollarSign className="mr-1 inline h-4 w-4" /> Mark Paid
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 text-right">
                    <button className="text-xs underline" onClick={()=>setModal(a)}>Open</button>
                  </div>
                </div>
              );
            })}
            {filteredAppts.length===0 && (
              <div className="rounded-xl border p-6 text-center text-sm text-zinc-600">
                Nothing here. Use <b>Check-In</b> to add one or adjust filters.
              </div>
            )}
          </div>
        )}

        {/* List view */}
        {viewMode === "list" && (
          <div className="overflow-hidden rounded-xl border">
            <div className="grid grid-cols-[1.2fr,1fr,0.8fr,0.8fr,0.8fr] bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-600">
              <div>Customer / Vehicle</div>
              <div>Reason</div>
              <div>Status</div>
              <div>Flagged Hrs</div>
              <div className="text-right pr-2">Actions</div>
            </div>
            <div className="divide-y">
              {filteredAppts.map(a=>{
                const st = statusMetaByKey.get(a.status) || {label:a.status, color:"bg-zinc-50"};
                return (
                  <div key={a.id} className={`grid grid-cols-[1.2fr,1fr,0.8fr,0.8fr,0.8fr] items-center px-3 py-2 text-sm ${tintClass(st.color)}`}>
                    <div className="truncate cursor-pointer" onClick={()=>setModal(a)}>
                      <div className="font-medium truncate">{a.customerName || "Customer"}</div>
                      <div className="text-xs text-zinc-700 truncate">{a.vehicleLabel || "Vehicle"} {a.vin ? `• ${a.vin}` : ""}</div>
                    </div>
                    <div className="text-xs text-zinc-700 truncate">{a.reason || "—"}</div>
                    <div>
                      <Select value={a.status || "in_queue"} onChange={(e)=>onChangeStatus(a, e.target.value)}>
                        {statusOptions.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </Select>
                    </div>
                    <div>
                      <Input
                        inputMode="decimal"
                        step="0.1"
                        placeholder="0.0"
                        defaultValue={a.flaggedHours ?? ""}
                        onBlur={(e)=>onUpdateFlagged(a, e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      {!a.inspectionStarted ? (
                        <button onClick={()=>onStartInspection(a)} className="rounded-lg border px-2 py-1 text-xs">
                          <PlayCircle className="mr-1 inline h-3 w-3" /> Inspect
                        </button>
                      ) : (
                        <button onClick={()=>{/* navigate later */}} className="rounded-lg border px-2 py-1 text-xs">
                          <Pencil className="mr-1 inline h-3 w-3" /> Update
                        </button>
                      )}
                      <button
                        onClick={()=>onMarkPaid(a)}
                        className="rounded-lg bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700"
                      >
                        <BadgeDollarSign className="mr-1 inline h-3 w-3" /> Mark Paid
                      </button>
                      <button className="rounded-lg border px-2 py-1 text-xs" onClick={()=>setModal(a)}>Open</button>
                    </div>
                  </div>
                );
              })}
              {filteredAppts.length===0 && (
                <div className="px-3 py-6 text-center text-sm text-zinc-600">No results.</div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* TIME CLOCK */}
      <Card className="mt-4" title="Time Clock" subtitle="Log clock in/out and lunches.">
        <div className="-mt-4"><EmbeddedTimeClock /></div>
      </Card>

      {/* SETTINGS + TOAST + MODAL */}
      <SettingsFlyout
        open={showSettings}
        onClose={()=>setShowSettings(false)}
        settings={settingsEdit || settings}
        onChange={(patch)=>applyChange(patch)}
        onSave={saveSettings}
      />
      <Toast msg={toast} onClose={()=>setToast("")}/>
      <AppointmentModal
        appt={modal}
        statusOptions={statusOptions}
        onClose={()=>setModal(null)}
        onChangeStatus={onChangeStatus}
        onUpdateFlagged={onUpdateFlagged}
        onStartInspection={onStartInspection}
        onMarkPaid={onMarkPaid}
      />
    </Container>
  );
}

/* Lazy wrapper so we don’t create circular imports */
function EmbeddedTimeClock() {
  const [Comp, setComp] = useState(null);
  useEffect(() => { import("../components/TimeClock.jsx").then(m => setComp(()=>m.default)); }, []);
  if (!Comp) return <div className="p-4 text-sm text-zinc-600">Loading…</div>;
  return <Comp />;
}
