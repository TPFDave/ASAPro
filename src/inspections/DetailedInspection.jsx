// src/inspections/DetailedInspection.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider.jsx";
import { db } from "../lib/firebase";
import {
  collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc
} from "firebase/firestore";
import RYG from "./components/RYG.jsx";
import PhotoPicker from "./components/PhotoPicker.jsx";
import { ArrowLeft, Save, Plus, Settings as Gear, Trash2 } from "lucide-react";

const Container = ({ children }) => <div className="mx-auto w-full max-w-screen-sm p-3">{children}</div>;
const Card = ({ title, children }) => (
  <div className="rounded-2xl border bg-white p-4 shadow-sm">
    {title && <div className="mb-2 text-base font-semibold">{title}</div>}
    {children}
  </div>
);
const Field = ({ label, children }) => (
  <label className="block">
    <div className="text-xs font-medium text-zinc-600">{label}</div>
    <div className="mt-1">{children}</div>
  </label>
);
const Input = (props) => <input {...props} className={"w-full rounded border px-3 py-2 text-sm " + (props.className||"")} />;
const Select = (props) => <select {...props} className={"w-full rounded border px-3 py-2 text-sm " + (props.className||"")} />;

/** ---------- Default schema (used if shop has none yet) ---------- */
const DEFAULT_SECTIONS = [
  {
    key: "interior", label: "Interior",
    points: [
      { key: "warning_lights", label: "Warning Lights", type: "ryg" },
      { key: "windows", label: "Windows / Switches", type: "ryg" },
      { key: "hvac", label: "Heat / A/C", type: "ryg" },
    ]
  },
  {
    key: "exterior", label: "Exterior",
    points: [
      { key: "lights", label: "All Lights / Horn", type: "ryg" },
      { key: "doors", label: "Doors / Trunk / Hood", type: "ryg" },
      { key: "wipers", label: "Wiper Blades", type: "ryg" },
    ]
  },
  {
    key: "under_car", label: "Under Car",
    points: [
      { key: "brakes", label: "Brakes", type: "ryg" },
      { key: "steering", label: "Steering", type: "ryg" },
      { key: "suspension", label: "Suspension", type: "ryg" },
      { key: "tires", label: "Tires", type: "ryg" },
      { key: "exhaust", label: "Exhaust", type: "ryg" },
    ]
  },
  {
    key: "under_hood", label: "Under Hood",
    points: [
      { key: "belts", label: "Belts", type: "ryg" },
      { key: "hoses", label: "Hoses", type: "ryg" },
      { key: "oil", label: "Engine Oil (level/condition)", type: "ryg" },
      { key: "coolant", label: "Coolant (level/condition)", type: "ryg" },
      { key: "atf", label: "ATF (level/condition)", type: "ryg" },
      { key: "brake_fluid", label: "Brake Fluid", type: "ryg" },
    ]
  },
];

/** Types: pf | ryg | text | measure | combo_pf_measure | combo_ryg_measure */

/** ---------- Small input widgets ---------- */
function PF({ value, onChange }) {
  const v = value || "";
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={()=>onChange("pass")}
        className={`rounded border px-3 py-1 text-sm ${v==="pass" ? "bg-green-600 text-white" : "bg-white"}`}
      >Pass</button>
      <button
        type="button"
        onClick={()=>onChange("fail")}
        className={`rounded border px-3 py-1 text-sm ${v==="fail" ? "bg-red-600 text-white" : "bg-white"}`}
      >Fail</button>
    </div>
  );
}

function Measure({ value, unit, onChange }) {
  const val = (value ?? "");
  const u = unit ?? "";
  return (
    <div className="flex items-center gap-2">
      <input
        inputMode="decimal"
        className="w-28 rounded border px-3 py-2 text-sm"
        placeholder="0.0"
        value={val}
        onChange={(e)=>onChange({ value: e.target.value, unit: u })}
      />
      <input
        className="w-28 rounded border px-3 py-2 text-sm"
        placeholder="unit"
        value={u}
        onChange={(e)=>onChange({ value: val, unit: e.target.value })}
      />
    </div>
  );
}

/** ---------- Main component ---------- */
export default function DetailedInspection({ prefill, onBack }) {
  const { user } = useAuth();
  const shopId = user?.uid;

  const [customerName, setCustomerName] = useState(prefill?.customerName || "");
  const [vehicleLabel, setVehicleLabel] = useState(prefill?.vehicleLabel || "");
  const [vin, setVin] = useState(prefill?.vin || "");

  // Schema (per shop)
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [editingSec, setEditingSec] = useState({}); // { [secKey]: true|false }

  // Answers payload
  const [answers, setAnswers] = useState({}); // `${sectionKey}.${pointKey}` -> value or object
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState([]);

  // Add-point temp form (per section)
  const [addDraft, setAddDraft] = useState({}); // { [secKey]: { label, type, defaultUnit? } }

  // --- Load or init schema for this shop
  useEffect(() => {
    if (!shopId) return;
    const ref = doc(db, "shops", shopId, "settings", "inspections");
    return onSnapshot(ref, async snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.sections) && data.sections.length) {
          setSections(data.sections);
        } else {
          // seed defaults if empty
          await setDoc(ref, { sections: DEFAULT_SECTIONS }, { merge: true });
          setSections(DEFAULT_SECTIONS);
        }
      } else {
        await setDoc(ref, { sections: DEFAULT_SECTIONS }, { merge: true });
        setSections(DEFAULT_SECTIONS);
      }
    });
  }, [shopId]);

  const schemaDocRef = useMemo(() => shopId ? doc(db, "shops", shopId, "settings", "inspections") : null, [shopId]);

  const saveSchema = async (next) => {
    if (!schemaDocRef) return;
    await setDoc(schemaDocRef, { sections: next }, { merge: true });
    setSections(next);
  };

  const toggleEdit = (secKey) => setEditingSec(prev => ({ ...prev, [secKey]: !prev[secKey] }));

  const addPoint = async (sec) => {
    const draft = addDraft[sec.key] || {};
    const label = (draft.label || "").trim();
    const type = draft.type || "ryg";
    const defaultUnit = (draft.defaultUnit || "").trim();
    if (!label) return;

    const key = slugify(label);
    const newPoint = defaultUnit ? { key, label, type, defaultUnit } : { key, label, type };
    const next = sections.map(s => s.key === sec.key ? ({ ...s, points: [...s.points, newPoint] }) : s);
    await saveSchema(next);
    setAddDraft(prev => ({ ...prev, [sec.key]: { label: "", type: "ryg", defaultUnit: "" } }));
  };

  const removePoint = async (sec, pt) => {
    const next = sections.map(s => s.key === sec.key ? ({ ...s, points: s.points.filter(p => p.key !== pt.key) }) : s);
    await saveSchema(next);
    // Optional: remove existing answer for cleanliness
    const fullKey = `${sec.key}.${pt.key}`;
    setAnswers(prev => {
      const copy = { ...prev };
      delete copy[fullKey];
      return copy;
    });
  };

  const onUpload = (p) => setPhotos(prev => [...prev, p]);

  // ---------- Answer updaters ----------
  const setAnswer = (secKey, ptKey, v) => {
    setAnswers(prev => ({ ...prev, [`${secKey}.${ptKey}`]: v }));
  };

  const setAnswerMeasure = (secKey, ptKey, patch) => {
    const full = `${secKey}.${ptKey}`;
    const prev = answers[full] || {};
    const next = { ...(typeof prev === "object" ? prev : {}), measure: normalizeMeasure({ ...(prev.measure||{}), ...patch }) };
    setAnswers(a => ({ ...a, [full]: next }));
  };

  const setAnswerComboStatus = (secKey, ptKey, status) => {
    const full = `${secKey}.${ptKey}`;
    const prev = answers[full] || {};
    const next = { ...(typeof prev === "object" ? prev : {}), status };
    setAnswers(a => ({ ...a, [full]: next }));
  };

  // ---------- Renderers per type ----------
  const renderPointInput = (sec, pt) => {
    const full = `${sec.key}.${pt.key}`;
    const v = answers[full];

    switch (pt.type) {
      case "pf":
        return <PF value={typeof v === "string" ? v : ""} onChange={(val)=>setAnswer(sec.key, pt.key, val)} />;

      case "ryg":
        return <RYG value={typeof v === "string" ? v : ""} onChange={(val)=>setAnswer(sec.key, pt.key, val)} />;

      case "text":
        return (
          <textarea
            rows={2}
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="Notes / findings…"
            value={typeof v === "string" ? v : ""}
            onChange={(e)=>setAnswer(sec.key, pt.key, e.target.value)}
          />
        );

      case "measure": {
        const mv = normalizeMeasure(v, pt.defaultUnit);
        return (
          <Measure
            value={mv.value ?? ""}
            unit={mv.unit ?? ""}
            onChange={(nv)=>setAnswer(sec.key, pt.key, normalizeMeasure(nv, pt.defaultUnit))}
          />
        );
      }

      case "combo_pf_measure": {
        const mv = normalizeMeasure((v && v.measure) || {}, pt.defaultUnit);
        const status = v && typeof v === "object" ? v.status || "" : "";
        return (
          <div className="grid gap-2">
            <PF value={status} onChange={(s)=>setAnswerComboStatus(sec.key, pt.key, s)} />
            <Measure
              value={mv.value ?? ""}
              unit={mv.unit ?? ""}
              onChange={(nv)=>setAnswerMeasure(sec.key, pt.key, nv)}
            />
          </div>
        );
      }

      case "combo_ryg_measure": {
        const mv = normalizeMeasure((v && v.measure) || {}, pt.defaultUnit);
        const status = v && typeof v === "object" ? v.status || "" : "";
        return (
          <div className="grid gap-2">
            <RYG value={status} onChange={(s)=>setAnswerComboStatus(sec.key, pt.key, s)} />
            <Measure
              value={mv.value ?? ""}
              unit={mv.unit ?? ""}
              onChange={(nv)=>setAnswerMeasure(sec.key, pt.key, nv)}
            />
          </div>
        );
      }

      default:
        return <div className="text-xs text-red-600">Unknown type: {pt.type}</div>;
    }
  };

  const visiblePoints = (sec) => sec.points;

  // --------- Save inspection document ----------
  const save = async () => {
    if (!shopId) return;
    const id = crypto.randomUUID();
    const ref = doc(collection(db, "shops", shopId, "inspections"), id);

    const payload = {
      type: "detailed",
      appointmentId: prefill?.apptId || null,
      createdAt: serverTimestamp(),
      status: "in_progress",
      customer: { name: customerName },
      vehicle: { label: vehicleLabel, vin: vin || null },
      schemaVersion: "v1",
      sections: sections.map(s => ({ key: s.key, label: s.label, points: s.points })), // snapshot of schema used
      answers, // see structure above
      notes, photos,
    };

    await setDoc(ref, payload, { merge: true });
    onBack?.();
  };

  return (
    <Container>
      <button onClick={onBack} className="mb-2 flex items-center gap-1 text-sm text-zinc-600">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <Card title="Detailed Inspection">
        {/* Prefill header */}
        <div className="grid gap-2">
          <Field label="Customer">
            <Input value={customerName} onChange={e=>setCustomerName(e.target.value)} />
          </Field>
          <Field label="Vehicle">
            <Input value={vehicleLabel} onChange={e=>setVehicleLabel(e.target.value)} />
          </Field>
          <Field label="VIN (optional)">
            <Input value={vin} onChange={e=>setVin(e.target.value)} />
          </Field>
        </div>

        {/* Sections */}
        <div className="mt-3 space-y-3">
          {sections.map(sec => (
            <div key={sec.key} className="rounded-xl border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-medium">{sec.label}</div>
                <button
                  type="button"
                  className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs ${editingSec[sec.key] ? "bg-zinc-900 text-white" : ""}`}
                  onClick={()=>toggleEdit(sec.key)}
                >
                  <Gear className="h-4 w-4" /> {editingSec[sec.key] ? "Editing" : "Customize"}
                </button>
              </div>

              {/* Add point form (only when editing) */}
              {editingSec[sec.key] && (
                <div className="mb-3 grid gap-2 rounded-lg border bg-zinc-50 p-2">
                  <div className="grid grid-cols-1 gap-2">
                    <Field label="New point label">
                      <Input
                        placeholder="e.g., Cabin Air Filter"
                        value={addDraft[sec.key]?.label || ""}
                        onChange={(e)=>setAddDraft(prev => ({ ...prev, [sec.key]: { ...(prev[sec.key]||{}), label: e.target.value } }))}
                      />
                    </Field>
                    <Field label="Type">
                      <Select
                        value={addDraft[sec.key]?.type || "ryg"}
                        onChange={(e)=>setAddDraft(prev => ({ ...prev, [sec.key]: { ...(prev[sec.key]||{}), type: e.target.value } }))}
                      >
                        <option value="pf">Pass / Fail</option>
                        <option value="ryg">Red / Yellow / Green</option>
                        <option value="text">Text</option>
                        <option value="measure">Measurement</option>
                        <option value="combo_pf_measure">Pass/Fail + Measurement</option>
                        <option value="combo_ryg_measure">RYG + Measurement</option>
                      </Select>
                    </Field>
                    {(addDraft[sec.key]?.type === "measure" ||
                      addDraft[sec.key]?.type === "combo_pf_measure" ||
                      addDraft[sec.key]?.type === "combo_ryg_measure") && (
                      <Field label="Default unit (optional)">
                        <Input
                          placeholder="mm, psi, %, 32nds, etc."
                          value={addDraft[sec.key]?.defaultUnit || ""}
                          onChange={(e)=>setAddDraft(prev => ({ ...prev, [sec.key]: { ...(prev[sec.key]||{}), defaultUnit: e.target.value } }))}
                        />
                      </Field>
                    )}
                    <div>
                      <button
                        type="button"
                        onClick={()=>addPoint(sec)}
                        className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white"
                      >
                        <Plus className="h-4 w-4" /> Add Point
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Points list */}
              <div className="space-y-2">
                {visiblePoints(sec).map(pt => (
                  <div key={pt.key} className="rounded-lg border p-2">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="text-sm">{pt.label}</div>
                      {editingSec[sec.key] && (
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"
                          onClick={()=>removePoint(sec, pt)}
                        >
                          <Trash2 className="h-4 w-4" /> Remove
                        </button>
                      )}
                    </div>
                    {renderPointInput(sec, pt)}
                  </div>
                ))}
                {sec.points.length === 0 && (
                  <div className="rounded-lg border border-dashed p-3 text-xs text-zinc-500">
                    No points added yet. Use <b>Customize</b> → <b>Add Point</b>.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Photos + notes */}
        <div className="mt-3">
          <div className="text-sm font-medium mb-1">Photos</div>
          <PhotoPicker pathPrefix={`shops/${shopId}/inspections/tmp`} onUploaded={onUpload} />
          {photos.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {photos.map((p,i) => <img key={i} src={p.url} alt="" className="h-20 w-full rounded object-cover" />)}
            </div>
          )}
        </div>

        <div className="mt-3">
          <Field label="General Notes">
            <textarea rows={4} className="w-full rounded border px-3 py-2 text-sm"
              value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Measurements, comments, recommendations…" />
          </Field>
        </div>

        <div className="mt-4">
          <button onClick={save} className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
            <Save className="mr-1 inline h-4 w-4" /> Save Inspection
          </button>
        </div>
      </Card>
    </Container>
  );
}

/** ---------- helpers ---------- */
function slugify(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "p_" + Math.random().toString(36).slice(2, 8);
}
function normalizeMeasure(v, defaultUnit) {
  const obj = typeof v === "object" && v !== null ? v : {};
  const value = (obj.value ?? "");
  const unit = (obj.unit ?? defaultUnit ?? "");
  return { value, unit };
}
