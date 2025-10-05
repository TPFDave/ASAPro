import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider.jsx";
import { db } from "../lib/firebase";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { Search, Save } from "lucide-react";

const Container = ({ children }) => <div className="mx-auto w-full max-w-screen-2xl p-4">{children}</div>;
const Card = ({ children, title, subtitle }) => (
  <div className="rounded-2xl border bg-white p-6 shadow-sm">
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
const Input = (props) => <input {...props} className={"w-full rounded border px-3 py-2 " + (props.className||"")} />;
const Textarea = (props) => <textarea {...props} className={"w-full rounded border px-3 py-2 " + (props.className||"")} />;
const Checkbox = ({label, checked, onChange}) => (
  <label className="flex items-center gap-2 text-sm">
    <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} />
    <span>{label}</span>
  </label>
);

function isoDate(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,10);
}
function todayISO() { return isoDate(new Date()); }

export default function CheckIn() {
  const { user } = useAuth();
  const shopId = user?.uid;

  // Live customers and vehicles (for prefill)
  const [customers, setCustomers] = useState([]);
  const [vehiclesByCustomer, setVehiclesByCustomer] = useState(new Map());

  useEffect(() => {
    if (!shopId) return;
    const qCust = query(collection(db, "shops", shopId, "customers"), orderBy("lastName", "asc"));
    const unsub = onSnapshot(qCust, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCustomers(list);
    });
    return () => unsub();
  }, [shopId]);

  useEffect(() => {
    if (!shopId) return;
    const unsubscribers = [];
    const map = new Map();
    customers.forEach(c => {
      const qVeh = query(collection(db, "shops", shopId, "customers", c.id, "vehicles"), orderBy("lastSeen", "desc"));
      const u = onSnapshot(qVeh, snap => {
        map.set(c.id, snap.docs.map(d => ({ id: d.id, ...d.data() })));
        // push a new reference to update UI
        setVehiclesByCustomer(prev => new Map(map));
      });
      unsubscribers.push(u);
    });
    return () => unsubscribers.forEach(u => u && u());
  }, [shopId, customers]);

  // Form state
  const [form, setForm] = useState({
    customer: { firstName:"", lastName:"", phone:"", email:"" },
    vehicle: { year:"", make:"", model:"", vin:"" },
    reason: "",
    pickup: { sameDay: true, date: todayISO(), time: "" },
    agreeDiag: false,
    preAuth: "",
  });
  const [status, setStatus] = useState("");

  const handle = (path, value) => {
    const parts = path.split(".");
    setForm(prev => {
      const copy = structuredClone(prev);
      let obj = copy;
      for (let i=0;i<parts.length-1;i++) obj = obj[parts[i]];
      obj[parts.at(-1)] = value;
      return copy;
    });
  };

  // Try to prefill from DB: match by email/phone for customer, VIN for vehicle
  const prefillFromMatches = () => {
    setStatus("");
    const phone = form.customer.phone?.trim();
    const email = form.customer.email?.trim().toLowerCase();
    const vin = form.vehicle.vin?.trim().toUpperCase();

    // 1) Customer by phone/email (exact match)
    let matchCustomer = null;
    if (email) matchCustomer = customers.find(c => c?.contact?.email?.toLowerCase() === email) || null;
    if (!matchCustomer && phone) matchCustomer = customers.find(c => (c?.contact?.phone || "").replace(/\D/g,"") === (phone || "").replace(/\D/g,"")) || null;

    // 2) Vehicle by VIN anywhere
    let matchVehicle = null;
    if (vin) {
      for (const c of customers) {
        const vs = vehiclesByCustomer.get(c.id) || [];
        const found = vs.find(v => v.vin?.toUpperCase() === vin);
        if (found) { matchVehicle = { customer: c, vehicle: found }; break; }
      }
    }

    if (matchCustomer) {
      handle("customer.firstName", matchCustomer.firstName || "");
      handle("customer.lastName", matchCustomer.lastName || "");
      handle("customer.phone", matchCustomer.contact?.phone || "");
      handle("customer.email", matchCustomer.contact?.email || "");
    }

    if (matchVehicle) {
      // trust the vehicle’s owning customer if both found
      const c = matchVehicle.customer;
      const v = matchVehicle.vehicle;
      handle("customer.firstName", c.firstName || "");
      handle("customer.lastName", c.lastName || "");
      handle("customer.phone", c.contact?.phone || "");
      handle("customer.email", c.contact?.email || "");
      handle("vehicle.year", v.year || "");
      handle("vehicle.make", v.make || "");
      handle("vehicle.model", v.model || "");
      handle("vehicle.vin", v.vin || "");
    }

    if (!matchCustomer && !matchVehicle) {
      setStatus("No exact matches found. You can proceed and we’ll create this customer/vehicle on save.");
    } else {
      setStatus("Prefilled from existing records. Edit anything that’s changed.");
    }
  };

  const upsertCustomer = async () => {
    // Find by exact email/phone
    const phone = form.customer.phone?.trim();
    const email = form.customer.email?.trim();
    let existing = null;
    if (email) existing = customers.find(c => c?.contact?.email?.toLowerCase() === email.toLowerCase()) || null;
    if (!existing && phone) existing = customers.find(c => (c?.contact?.phone || "").replace(/\D/g,"") === (phone || "").replace(/\D/g,"")) || null;

    const base = {
      firstName: form.customer.firstName.trim(),
      lastName: form.customer.lastName.trim(),
      contact: { phone: phone || "", email: email || "" },
      updatedAt: serverTimestamp(),
    };

    if (existing) {
      await updateDoc(doc(db, "shops", shopId, "customers", existing.id), base);
      return existing.id;
    }
    const ref = await addDoc(collection(db, "shops", shopId, "customers"), {
      ...base,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  };

  const upsertVehicle = async (customerId) => {
    const vin = (form.vehicle.vin || "").trim().toUpperCase();
    const vehicles = vehiclesByCustomer.get(customerId) || [];
    let existing = null;
    if (vin) existing = vehicles.find(v => (v.vin || "").toUpperCase() === vin) || null;

    const base = {
      year: form.vehicle.year || "",
      make: form.vehicle.make || "",
      model: form.vehicle.model || "",
      vin,
      lastSeen: todayISO(),
      updatedAt: serverTimestamp(),
    };

    if (existing) {
      await updateDoc(doc(db, "shops", shopId, "customers", customerId, "vehicles", existing.id), base);
      return existing.id;
    }
    const ref = await addDoc(collection(db, "shops", shopId, "customers", customerId, "vehicles"), {
      ...base,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  };

  const submit = async () => {
    try {
      setStatus("");

      // basic validation
      if (!form.customer.firstName || !form.customer.lastName) throw new Error("Customer name is required.");
      if (!form.customer.phone && !form.customer.email) throw new Error("Provide at least a phone or an email.");
      if (!form.vehicle.vin && !(form.vehicle.make && form.vehicle.model)) {
        throw new Error("Provide either a VIN or a Make & Model.");
      }
      if (!form.agreeDiag) throw new Error("You must confirm the diagnostic fee agreement.");

      // 1) Upsert customer
      const customerId = await upsertCustomer();

      // 2) Upsert vehicle under that customer
      const vehicleId = await upsertVehicle(customerId);

      // 3) Create a “check-in appointment” the Dashboard can read later
      const pickupISO = form.pickup.sameDay
        ? new Date().toISOString()
        : new Date(`${form.pickup.date}T${form.pickup.time || "17:00"}:00`).toISOString();

      const preAuthAmount = form.preAuth === "" ? 0 : Number(form.preAuth);

      await addDoc(collection(db, "shops", shopId, "appointments"), {
        type: "checkin",
        status: "checked_in", // dashboard can filter these as in-progress
        customerId,
        vehicleId,
        customerName: `${form.customer.firstName} ${form.customer.lastName}`.trim(),
        vehicleLabel: [form.vehicle.year, form.vehicle.make, form.vehicle.model].filter(Boolean).join(" "),
        vin: form.vehicle.vin || "",
        reason: form.reason || "",
        pickup: {
          sameDay: !!form.pickup.sameDay,
          at: pickupISO,
        },
        agreements: {
          diagAccepted: true,
          preAuthAmount: isNaN(preAuthAmount) ? 0 : preAuthAmount,
        },
        createdAt: serverTimestamp(),
      });

      setStatus("Check-in saved and sent to the Dashboard.");
      // (Optional) reset minimal fields for the next customer:
      // setForm(prev => ({ ...prev, reason:"", preAuth:"", agreeDiag:false }));
    } catch (err) {
      setStatus(err.message || "Error saving check-in.");
    }
  };

  return (
    <Container>
      <Card title="Vehicle Check-In" subtitle="Collect the essentials, prefill from your customer database, and send to Dashboard.">
        {/* Prefill helper */}
        <div className="mb-4 rounded-xl border p-3">
          <div className="text-sm font-semibold mb-2">Prefill from existing records</div>
          <div className="grid gap-2 md:grid-cols-3">
            <Field label="Customer Phone">
              <Input placeholder="(555) 555-1234" value={form.customer.phone} onChange={e=>handle("customer.phone", e.target.value)} />
            </Field>
            <Field label="Customer Email">
              <Input placeholder="name@email.com" value={form.customer.email} onChange={e=>handle("customer.email", e.target.value)} />
            </Field>
            <Field label="VIN">
              <Input placeholder="17 chars" maxLength={17} value={form.vehicle.vin} onChange={e=>handle("vehicle.vin", e.target.value.toUpperCase())} />
            </Field>
          </div>
          <button onClick={prefillFromMatches} className="mt-3 rounded-lg border px-3 py-1.5 text-sm">
            <Search className="mr-1 inline h-4 w-4" /> Find Matches
          </button>
          {status && <div className="mt-2 text-sm text-zinc-700">{status}</div>}
        </div>

        {/* Main form */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Customer */}
          <div className="space-y-3">
            <div className="text-sm font-semibold">Customer</div>
            <Field label="First Name"><Input value={form.customer.firstName} onChange={e=>handle("customer.firstName", e.target.value)} /></Field>
            <Field label="Last Name"><Input value={form.customer.lastName} onChange={e=>handle("customer.lastName", e.target.value)} /></Field>
            <Field label="Phone"><Input value={form.customer.phone} onChange={e=>handle("customer.phone", e.target.value)} /></Field>
            <Field label="Email"><Input value={form.customer.email} onChange={e=>handle("customer.email", e.target.value)} /></Field>
          </div>

          {/* Vehicle */}
          <div className="space-y-3">
            <div className="text-sm font-semibold">Vehicle</div>
            <Field label="Year"><Input value={form.vehicle.year} onChange={e=>handle("vehicle.year", e.target.value.replace(/\D/g,''))} /></Field>
            <Field label="Make"><Input value={form.vehicle.make} onChange={e=>handle("vehicle.make", e.target.value)} /></Field>
            <Field label="Model"><Input value={form.vehicle.model} onChange={e=>handle("vehicle.model", e.target.value)} /></Field>
            <Field label="VIN (optional if Make/Model provided)"><Input maxLength={17} value={form.vehicle.vin} onChange={e=>handle("vehicle.vin", e.target.value.toUpperCase())} /></Field>
          </div>

          {/* Visit details */}
          <div className="space-y-3">
            <div className="text-sm font-semibold">Visit</div>
            <Field label="Reason vehicle is at the shop">
              <Textarea rows={4} value={form.reason} onChange={e=>handle("reason", e.target.value)} placeholder="Describe the concern, noises, warning lights, etc." />
            </Field>

            <Checkbox
              label="Pickup is same day"
              checked={form.pickup.sameDay}
              onChange={(v)=>handle("pickup.sameDay", v)}
            />
            {!form.pickup.sameDay && (
              <div className="grid gap-2 md:grid-cols-2">
                <Field label="Pickup Date"><Input type="date" value={form.pickup.date} onChange={e=>handle("pickup.date", e.target.value)} /></Field>
                <Field label="Pickup Time"><Input type="time" value={form.pickup.time} onChange={e=>handle("pickup.time", e.target.value)} /></Field>
              </div>
            )}

            <Checkbox
              label="Customer agrees to standard diagnostic fees"
              checked={form.agreeDiag}
              onChange={(v)=>handle("agreeDiag", v)}
            />
            <Field label="Pre-authorized dollar amount">
              <Input inputMode="decimal" placeholder="0.00" value={form.preAuth} onChange={e=>handle("preAuth", e.target.value.replace(/[^\d.]/g,''))} />
            </Field>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={submit} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            <Save className="mr-1 inline h-4 w-4" /> Save & Send to Dashboard
          </button>
        </div>
      </Card>
    </Container>
  );
}
