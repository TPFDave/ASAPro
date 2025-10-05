import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider.jsx";
import { db } from "../lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { Plus, Edit2, Trash2, Car, UserPlus, Search, ChevronDown } from "lucide-react";

const Container = ({ children }) => <div className="mx-auto w-full max-w-screen-2xl p-4">{children}</div>;

const Card = ({ children, title, subtitle, className="" }) => (
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
const Textarea = (props) => <textarea {...props} className={"w-full rounded border px-3 py-2 " + (props.className || "")} />;
const Select = (props) => <select {...props} className={"w-full rounded border px-3 py-2 " + (props.className || "")} />;

/* -------------------------- Vehicle Editor -------------------------- */
function VehicleForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState(() => initial || {
    year: "", make: "", model: "", vin: "", lastSeen: "", notes: "",
    pastInspections: [] // placeholder for future link-outs
  });

  const handle = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    const data = { ...form };
    // basic normalization
    if (!data.make && !data.model && !data.vin) {
      throw new Error("Enter at least a VIN or Make/Model.");
    }
    await onSave(data);
  };

  const isEdit = !!initial?.id;
  return (
    <div className="rounded-xl border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold">{isEdit ? "Edit Vehicle" : "Add Vehicle"}</div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="rounded border px-2 py-1 text-xs">Cancel</button>
          <button onClick={save} className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white">Save</button>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        <Field label="Year"><Input value={form.year} onChange={e=>handle("year", e.target.value.replace(/\D/g,''))} placeholder="2018" /></Field>
        <Field label="Make"><Input value={form.make} onChange={e=>handle("make", e.target.value)} placeholder="Toyota" /></Field>
        <Field label="Model"><Input value={form.model} onChange={e=>handle("model", e.target.value)} placeholder="Camry" /></Field>
      </div>
      <div className="grid gap-2 md:grid-cols-3 mt-2">
        <Field label="VIN"><Input value={form.vin} onChange={e=>handle("vin", e.target.value.toUpperCase())} placeholder="17 chars" maxLength={17} /></Field>
        <Field label="Last Seen"><Input type="date" value={form.lastSeen} onChange={e=>handle("lastSeen", e.target.value)} /></Field>
        <div />
      </div>
      <Field label="Notes"><Textarea rows={3} value={form.notes} onChange={e=>handle("notes", e.target.value)} placeholder="Trim, engine, tire sizes, etc." /></Field>
    </div>
  );
}

function VehicleRow({ v, onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-between rounded-xl border p-3">
      <div className="text-sm">
        <div className="font-medium">{v.year || "—"} {v.make || ""} {v.model || ""}</div>
        <div className="text-xs text-zinc-600">VIN: {v.vin || "—"} • Last seen: {v.lastSeen || "—"}</div>
        {v.notes && <div className="mt-1 text-xs text-zinc-600">{v.notes}</div>}
      </div>
      <div className="flex items-center gap-2">
        <button className="rounded border px-2 py-1 text-xs" onClick={()=>onEdit(v)}><Edit2 className="mr-1 inline h-3 w-3" />Edit</button>
        <button className="rounded border px-2 py-1 text-xs text-red-600" onClick={()=>onDelete(v)}><Trash2 className="mr-1 inline h-3 w-3" />Delete</button>
      </div>
    </div>
  );
}

/* -------------------------- Customer Editor -------------------------- */
function CustomerForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState(() => initial || {
    firstName: "", lastName: "",
    contact: { phone:"", email:"" },
    preferences: { preferred: "call", dndStart:"", dndEnd:"" },
    birthday: "", spouse: "", notes: "",
  });

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

  const save = async () => {
    const data = { ...form };
    if (!data.firstName || !data.lastName) throw new Error("First and last name are required.");
    await onSave(data);
  };

  const isEdit = !!initial?.id;

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isEdit ? "Edit Customer" : "New Customer"}</h2>
        <div className="flex gap-2">
          <button onClick={onCancel} className="rounded-xl border px-3 py-2 text-sm">Cancel</button>
          <button onClick={save} className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Save</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-3 md:col-span-1">
          <Field label="First Name"><Input value={form.firstName} onChange={e=>handle("firstName", e.target.value)} placeholder="Jane" /></Field>
          <Field label="Last Name"><Input value={form.lastName} onChange={e=>handle("lastName", e.target.value)} placeholder="Doe" /></Field>
          <Field label="Birthday"><Input type="date" value={form.birthday} onChange={e=>handle("birthday", e.target.value)} /></Field>
          <Field label="Spouse / Secondary Contact"><Input value={form.spouse} onChange={e=>handle("spouse", e.target.value)} placeholder="Name & phone/email" /></Field>
        </div>

        <div className="space-y-3 md:col-span-1">
          <Field label="Phone"><Input value={form.contact.phone} onChange={e=>handle("contact.phone", e.target.value)} placeholder="(555) 555-1234" /></Field>
          <Field label="Email"><Input value={form.contact.email} onChange={e=>handle("contact.email", e.target.value)} placeholder="name@email.com" /></Field>
          <Field label="Preferred Contact">
            <Select value={form.preferences.preferred} onChange={e=>handle("preferences.preferred", e.target.value)}>
              <option value="call">Call</option>
              <option value="text">Text</option>
              <option value="email">Email</option>
            </Select>
          </Field>
          <div className="grid gap-2 md:grid-cols-2">
            <Field label="Do Not Disturb — Start"><Input type="time" value={form.preferences.dndStart} onChange={e=>handle("preferences.dndStart", e.target.value)} /></Field>
            <Field label="Do Not Disturb — End"><Input type="time" value={form.preferences.dndEnd} onChange={e=>handle("preferences.dndEnd", e.target.value)} /></Field>
          </div>
        </div>

        <div className="space-y-3 md:col-span-1">
          <Field label="Notes"><Textarea rows={8} value={form.notes} onChange={e=>handle("notes", e.target.value)} placeholder="Important preferences, prior issues, etc." /></Field>
        </div>
      </div>
    </div>
  );
}

/* -------------------------- Rows -------------------------- */
function CustomerRow({ c, vehicles, onEdit, onDelete, onAddVehicle, onEditVehicle, onDeleteVehicle }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">
            {c.firstName} {c.lastName}
            {c.preferences?.preferred && (
              <span className="ml-2 rounded-full border px-2 py-0.5 text-xs">
                Pref: {c.preferences.preferred}
              </span>
            )}
          </div>
          <div className="text-xs text-zinc-600">
            {c.contact?.phone || "—"} • {c.contact?.email || "—"}
            {c.birthday ? ` • Birthday: ${c.birthday}` : ""}
          </div>
          {c.notes && <div className="mt-1 text-xs text-zinc-600">{c.notes}</div>}
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded border px-2 py-1 text-xs" onClick={()=>setOpen(v=>!v)}>
            <ChevronDown className={"mr-1 inline h-3 w-3 transition " + (open ? "rotate-180" : "")} />
            Vehicles
          </button>
          <button className="rounded border px-2 py-1 text-xs" onClick={()=>onEdit(c)}><Edit2 className="mr-1 inline h-3 w-3" />Edit</button>
          <button className="rounded border px-2 py-1 text-xs text-red-600" onClick={()=>onDelete(c)}><Trash2 className="mr-1 inline h-3 w-3" />Delete</button>
        </div>
      </div>

      {open && (
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold">Vehicles</div>
            <button className="rounded bg-zinc-900 px-2 py-1 text-xs text-white" onClick={()=>onAddVehicle(c)}>
              <Plus className="mr-1 inline h-3 w-3" /> Add Vehicle
            </button>
          </div>
          <div className="grid gap-2">
            {vehicles?.map(v => (
              <VehicleRow
                key={v.id}
                v={v}
                onEdit={()=>onEditVehicle(c, v)}
                onDelete={()=>onDeleteVehicle(c, v)}
              />
            ))}
            {(!vehicles || vehicles.length === 0) && (
              <div className="rounded-xl border p-4 text-sm text-zinc-600">No vehicles yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------- Main Customers Screen -------------------------- */
export default function Customers() {
  const { user } = useAuth();
  const shopId = user?.uid;

  const [customers, setCustomers] = useState([]);
  const [vehiclesByCustomer, setVehiclesByCustomer] = useState(new Map());
  const [filter, setFilter] = useState("");
  const [sortBy, setSortBy] = useState("lastName"); // lastName | firstName | recent
  const [editing, setEditing] = useState(null); // customer doc (for edit)
  const [creating, setCreating] = useState(false);
  const [vehEditing, setVehEditing] = useState(null); // { customer, vehicle? }

  // Subscribe to customers
  useEffect(() => {
    if (!shopId) return;
    const qCust = query(collection(db, "shops", shopId, "customers"), orderBy("lastName", "asc"));
    const unsub = onSnapshot(qCust, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCustomers(list);
    });
    return () => unsub();
  }, [shopId]);

  // Subscribe to each customer's vehicles (lightweight; good enough for small/med lists)
  useEffect(() => {
    if (!shopId) return;
    const unsubscribers = [];
    const newMap = new Map();
    customers.forEach(c => {
      const qVeh = query(collection(db, "shops", shopId, "customers", c.id, "vehicles"), orderBy("lastSeen", "desc"));
      const unsub = onSnapshot(qVeh, snap => {
        newMap.set(c.id, snap.docs.map(d => ({ id: d.id, ...d.data() })));
        // trigger a new Map reference to update UI
        setVehiclesByCustomer(prev => new Map(newMap));
      });
      unsubscribers.push(unsub);
    });
    return () => unsubscribers.forEach(u => u && u());
  }, [shopId, customers]);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    let list = customers.slice();
    if (f) {
      list = list.filter(c => {
        const vehicles = vehiclesByCustomer.get(c.id) || [];
        const vehicleText = vehicles.map(v => [v.vin, v.make, v.model, v.year].filter(Boolean).join(" ")).join(" ");
        const hay = [
          c.firstName, c.lastName,
          c.contact?.phone, c.contact?.email,
          c.spouse, c.notes,
          vehicleText
        ].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(f);
      });
    }
    if (sortBy === "recent") {
      // last seen of newest vehicle or fallback to createdAt
      list.sort((a,b) => {
        const av = (vehiclesByCustomer.get(a.id) || [])[0]?.lastSeen || "";
        const bv = (vehiclesByCustomer.get(b.id) || [])[0]?.lastSeen || "";
        return (bv || "").localeCompare(av || "");
      });
    } else if (sortBy === "firstName") {
      list.sort((a,b)=> (a.firstName||"").localeCompare(b.firstName||""));
    } else {
      list.sort((a,b)=> (a.lastName||"").localeCompare(b.lastName||""));
    }
    return list;
  }, [customers, filter, vehiclesByCustomer, sortBy]);

  const saveCustomer = async (data) => {
    if (!shopId) throw new Error("Missing shop id.");
    if (editing?.id) {
      await updateDoc(doc(db, "shops", shopId, "customers", editing.id), { ...data, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, "shops", shopId, "customers"), { ...data, createdAt: serverTimestamp() });
    }
    setEditing(null); setCreating(false);
  };

  const deleteCustomer = async (c) => {
    if (!shopId) return;
    if (!confirm(`Delete ${c.firstName} ${c.lastName}? Their vehicles will be orphaned.`)) return;
    await deleteDoc(doc(db, "shops", shopId, "customers", c.id));
  };

  const addVehicle = (customer) => setVehEditing({ customer, vehicle: null });
  const editVehicle = (customer, vehicle) => setVehEditing({ customer, vehicle });
  const deleteVehicle = async (customer, vehicle) => {
    if (!shopId) return;
    if (!confirm(`Delete ${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""}?`)) return;
    await deleteDoc(doc(db, "shops", shopId, "customers", customer.id, "vehicles", vehicle.id));
  };

  const saveVehicle = async (customer, data, existingVehicle) => {
    if (!shopId) throw new Error("Missing shop id.");
    if (existingVehicle?.id) {
      await updateDoc(doc(db, "shops", shopId, "customers", customer.id, "vehicles", existingVehicle.id), {
        ...data, updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(collection(db, "shops", shopId, "customers", customer.id, "vehicles"), {
        ...data, createdAt: serverTimestamp()
      });
    }
    setVehEditing(null);
  };

  return (
    <Container>
      <Card title="Customer Database" subtitle="Search, edit, and link vehicles.">
        {/* Toolbar */}
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <div className="relative w-full md:w-96">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                className="w-full rounded border pl-8 pr-3 py-2"
                placeholder="Search by name, phone, email, vehicle (make/model/VIN)"
                value={filter}
                onChange={e=>setFilter(e.target.value)}
              />
            </div>
            <select className="rounded border px-3 py-2 text-sm" value={sortBy} onChange={e=>setSortBy(e.target.value)}>
              <option value="lastName">Sort: Last Name</option>
              <option value="firstName">Sort: First Name</option>
              <option value="recent">Sort: Most Recently Seen</option>
            </select>
          </div>
          <button className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700" onClick={()=>{setCreating(true); setEditing(null);}}>
            <UserPlus className="mr-1 inline h-4 w-4" /> New Customer
          </button>
        </div>

        {(creating || editing) ? (
          <CustomerForm
            initial={editing}
            onCancel={()=>{ setCreating(false); setEditing(null); }}
            onSave={saveCustomer}
          />
        ) : (
          <div className="grid gap-2">
            {filtered.map(c => (
              <CustomerRow
                key={c.id}
                c={c}
                vehicles={vehiclesByCustomer.get(c.id) || []}
                onEdit={setEditing}
                onDelete={deleteCustomer}
                onAddVehicle={addVehicle}
                onEditVehicle={editVehicle}
                onDeleteVehicle={deleteVehicle}
              />
            ))}
            {filtered.length === 0 && (
              <div className="rounded-xl border p-6 text-center text-sm text-zinc-600">No customers match your search.</div>
            )}
          </div>
        )}

        {/* Vehicle modal-ish block inline */}
        {vehEditing && (
          <div className="mt-4">
            <VehicleForm
              initial={vehEditing.vehicle}
              onCancel={()=>setVehEditing(null)}
              onSave={(data)=>saveVehicle(vehEditing.customer, data, vehEditing.vehicle)}
            />
          </div>
        )}
      </Card>

      <Card title="How this connects" className="mt-4">
        <ul className="list-inside list-disc text-sm text-zinc-700 space-y-1">
          <li>Check-In can create a customer + vehicle here automatically if they don’t exist.</li>
          <li>Inspections can link to a specific vehicle and write a “last seen” date.</li>
          <li>Future: forms across the app can prefill using this database (contact prefs, vehicles, etc.).</li>
        </ul>
      </Card>
    </Container>
  );
}
