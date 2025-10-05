import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider.jsx";
import { db } from "../lib/firebase";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import PassFail from "./components/PassFail.jsx";
import PhotoPicker from "./components/PhotoPicker.jsx";
import { ArrowLeft, Save } from "lucide-react";

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

const DEFAULT_POINTS = [
  { key: "lights", label: "All Exterior Lights", type: "passfail" },
  { key: "tires", label: "Tire Tread Visual", type: "passfail" },
  { key: "brakes", label: "Brake Visual (pads/rotor surface)", type: "passfail" },
  { key: "lugnuts", label: "Lug Nuts Present", type: "passfail" },
  { key: "damage", label: "Pre-existing Body Damage", type: "note" },
];

export default function SafetyInspection({ prefill, onBack }) {
  const { user } = useAuth();
  const [customerName, setCustomerName] = useState(prefill?.customerName || "");
  const [vehicleLabel, setVehicleLabel] = useState(prefill?.vehicleLabel || "");
  const [vin, setVin] = useState(prefill?.vin || "");
  const [points, setPoints] = useState(() => DEFAULT_POINTS.map(p => ({ ...p })));
  const [answers, setAnswers] = useState({}); // key -> value
  const [photos, setPhotos] = useState([]);

  const shopId = user?.uid;

  const updateAnswer = (key, value) => setAnswers(prev => ({ ...prev, [key]: value }));

  const createInspection = async () => {
    const id = crypto.randomUUID();
    const ref = doc(collection(db, "shops", shopId, "inspections"), id);
    const payload = {
      type: "safety",
      appointmentId: prefill?.apptId || null,
      createdAt: serverTimestamp(),
      status: "in_progress",
      customer: { name: customerName },
      vehicle: { label: vehicleLabel, vin: vin || null },
      points, answers, photos,
    };
    await setDoc(ref, payload, { merge: true });
    return { id, ref };
  };

  const onUpload = (p) => setPhotos(prev => [...prev, p]);

  const onSave = async () => {
    if (!shopId) return;
    const { ref } = await createInspection();
    // you could route to a read-only summary page later
    onBack?.();
  };

  return (
    <Container>
      <button onClick={onBack} className="mb-2 flex items-center gap-1 text-sm text-zinc-600">
        <ArrowLeft className="h-4 w-4"/> Back
      </button>

      <Card title="Safety / Liability Inspection">
        {/* Prefill / inputs */}
        <div className="grid gap-2">
          <Field label="Customer">
            <input className="w-full rounded border px-3 py-2 text-sm" value={customerName} onChange={e=>setCustomerName(e.target.value)} />
          </Field>
          <Field label="Vehicle">
            <input className="w-full rounded border px-3 py-2 text-sm" value={vehicleLabel} onChange={e=>setVehicleLabel(e.target.value)} />
          </Field>
          <Field label="VIN (optional)">
            <input className="w-full rounded border px-3 py-2 text-sm" value={vin} onChange={e=>setVin(e.target.value)} />
          </Field>
        </div>

        {/* Points */}
        <div className="mt-3 space-y-3">
          {points.map(p => (
            <div key={p.key} className="rounded-xl border p-3">
              <div className="text-sm font-medium">{p.label}</div>
              <div className="mt-2">
                {p.type === "passfail" && (
                  <PassFail value={answers[p.key]} onChange={(v)=>updateAnswer(p.key, v)} />
                )}
                {p.type === "note" && (
                  <textarea rows={3} className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="Describe pre-existing damage, locations, etc."
                    value={answers[p.key] || ""} onChange={(e)=>updateAnswer(p.key, e.target.value)} />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Photos */}
        <div className="mt-3">
          <div className="text-sm font-medium mb-1">Photos</div>
          <PhotoPicker pathPrefix={`shops/${shopId}/inspections/tmp`} onUploaded={onUpload} />
          {photos.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {photos.map((p,i) => <img key={i} src={p.url} alt="" className="h-20 w-full rounded object-cover" />)}
            </div>
          )}
        </div>

        <div className="mt-4">
          <button onClick={onSave} className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
            <Save className="mr-1 inline h-4 w-4" /> Save Inspection
          </button>
        </div>
      </Card>
    </Container>
  );
}
