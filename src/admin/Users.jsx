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
  updateDoc,
} from "firebase/firestore";
import { UserPlus, Trash2, Save, X, Edit2, Archive, Search } from "lucide-react";

/** Utility: sha256 with random salt; returns { saltB64, hashB64 } */
async function hashPIN(pin) {
  const enc = new TextEncoder();
  // 16-byte random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const pinBytes = enc.encode(pin);
  const combined = new Uint8Array(salt.length + pinBytes.length);
  combined.set(salt);
  combined.set(pinBytes, salt.length);
  const digest = await crypto.subtle.digest("SHA-256", combined);
  const hash = new Uint8Array(digest);
  const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
  return { saltB64: b64(salt), hashB64: b64(hash) };
}

const Field = ({ label, children }) => (
  <label className="block">
    <div className="text-xs font-medium text-zinc-600">{label}</div>
    <div className="mt-1">{children}</div>
  </label>
);

const Input = (props) => <input {...props} className={"w-full rounded border px-3 py-2 " + (props.className||"")} />;
const Textarea = (props) => <textarea {...props} className={"w-full rounded border px-3 py-2 " + (props.className||"")} />;
const Select = (props) => <select {...props} className={"w-full rounded border px-3 py-2 " + (props.className||"")} />;

function EmployeeForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState(() => initial || {
    firstName: "", lastName: "",
    contact: { phone:"", email:"", address:"", spouse:"", medical:"" },
    payroll: { payType: "hourly", hourlyRate: "", flatRate: "" , hireDate: "", lastRaiseDate: "" },
    notes: "",
    access: { canAccessAdmin:false, canAccessPayroll:false },
    status: "active",
    email: "",
  });
  const [pin, setPin] = useState("");
  const [pinAgain, setPinAgain] = useState("");

  const isEdit = !!(initial && initial.id);

  const handleChange = (path, value) => {
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
    const toNum = (v) => v === "" ? null : Number(v);
    data.payroll.hourlyRate = toNum(data.payroll.hourlyRate);
    data.payroll.flatRate = toNum(data.payroll.flatRate);

    if (!data.firstName || !data.lastName) throw new Error("Name is required.");
    if (!data.contact?.phone && !data.contact?.email) throw new Error("Provide at least a phone or an email.");

    if (!isEdit && (!pin || !/^\d{4}$/.test(pin))) throw new Error("A 4-digit PIN is required for new employees.");
    if (pin || pinAgain) {
      if (pin !== pinAgain) throw new Error("PINs do not match.");
      if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be exactly 4 digits.");
      const { saltB64, hashB64 } = await hashPIN(pin);
      data.pin = { saltB64, hashB64, updatedAt: new Date().toISOString() };
    }

    await onSave(data);
  };

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isEdit ? "Edit Employee" : "New Employee"}</h2>
        <div className="flex gap-2">
          <button onClick={onCancel} className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50">
            <X className="mr-1 inline h-4 w-4"/>Cancel
          </button>
          <button onClick={save} className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            <Save className="mr-1 inline h-4 w-4"/>Save
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-3 md:col-span-1">
          <Field label="First Name"><Input value={form.firstName} onChange={e=>handleChange("firstName", e.target.value)} placeholder="Jane"/></Field>
          <Field label="Last Name"><Input value={form.lastName} onChange={e=>handleChange("lastName", e.target.value)} placeholder="Doe"/></Field>
          <Field label="Employee Email (for kiosk login)"><Input value={form.email} onChange={e=>handleChange("email", e.target.value)} placeholder="jane@shop.com"/></Field>
          <Field label="Status">
            <Select value={form.status} onChange={e=>handleChange("status", e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
          <div className="rounded-xl border p-3">
            <div className="mb-2 text-xs font-semibold text-zinc-700">PIN (4 digits)</div>
            <div className="grid gap-2 md:grid-cols-2">
              <Input type="password" value={pin} maxLength={4} onChange={e=>setPin(e.target.value.replace(/\D/g,''))} placeholder="1234"/>
              <Input type="password" value={pinAgain} maxLength={4} onChange={e=>setPinAgain(e.target.value.replace(/\D/g,''))} placeholder="Repeat PIN"/>
            </div>
            <p className="mt-2 text-xs text-zinc-500">{isEdit ? "Leave blank to keep existing PIN. Setting both fields will update it." : "Required for new employees."}</p>
          </div>
        </div>

        <div className="space-y-3 md:col-span-1">
          <Field label="Phone"><Input value={form.contact.phone} onChange={e=>handleChange("contact.phone", e.target.value)} placeholder="(555) 555-1234"/></Field>
          <Field label="Personal Email"><Input value={form.contact.email} onChange={e=>handleChange("contact.email", e.target.value)} placeholder="name@email.com"/></Field>
          <Field label="Address"><Textarea rows={3} value={form.contact.address} onChange={e=>handleChange("contact.address", e.target.value)} placeholder="Street, City, ST, ZIP"/></Field>
          <Field label="Spouse / Emergency Contact"><Input value={form.contact.spouse} onChange={e=>handleChange("contact.spouse", e.target.value)} placeholder="Name & phone"/></Field>
          <Field label="Medical Notes"><Textarea rows={3} value={form.contact.medical} onChange={e=>handleChange("contact.medical", e.target.value)} placeholder="Allergies, conditions for emergencies"/></Field>
        </div>

        <div className="space-y-3 md:col-span-1">
          <div className="rounded-xl border p-3">
            <div className="mb-2 text-xs font-semibold text-zinc-700">Payroll</div>
            <Field label="Pay Type">
              <Select value={form.payroll.payType} onChange={e=>handleChange("payroll.payType", e.target.value)}>
                <option value="hourly">Hourly</option>
                <option value="flat">Flat Rate</option>
                <option value="both">Both</option>
              </Select>
            </Field>
            <div className="grid gap-2 md:grid-cols-2">
              <Field label="Hourly Rate ($/hr)"><Input value={form.payroll.hourlyRate} onChange={e=>handleChange("payroll.hourlyRate", e.target.value)} placeholder="e.g. 25.00" /></Field>
              <Field label="Flat Rate ($/flag hr)"><Input value={form.payroll.flatRate} onChange={e=>handleChange("payroll.flatRate", e.target.value)} placeholder="e.g. 30.00" /></Field>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <Field label="Hire Date"><Input type="date" value={form.payroll.hireDate} onChange={e=>handleChange("payroll.hireDate", e.target.value)} /></Field>
              <Field label="Last Raise"><Input type="date" value={form.payroll.lastRaiseDate} onChange={e=>handleChange("payroll.lastRaiseDate", e.target.value)} /></Field>
            </div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="mb-2 text-xs font-semibold text-zinc-700">Access</div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.access.canAccessAdmin} onChange={e=>handleChange("access.canAccessAdmin", e.target.checked)} />
              <span>Full Admin Menu</span>
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.access.canAccessPayroll} onChange={e=>handleChange("access.canAccessPayroll", e.target.checked)} />
              <span>Payroll Only</span>
            </label>
            <p className="mt-2 text-xs text-zinc-500">If neither is checked, the employee cannot access Admin. You can still let them use Check-In, Inspections, etc. via PIN.</p>
          </div>

          <Field label="Notes"><Textarea rows={4} value={form.notes} onChange={e=>handleChange("notes", e.target.value)} placeholder="Manager notes (private)"/></Field>
        </div>
      </div>
    </div>
  );
}

function EmployeeRow({ e, onEdit, onArchive, onDelete }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border p-3">
      <div className="flex-1">
        <div className="font-medium">
          {e.firstName} {e.lastName}
          <span className="ml-2 rounded-full border px-2 py-0.5 text-xs">{e.status ?? "active"}</span>
        </div>
        <div className="text-xs text-zinc-600">{e.contact?.phone || "—"} • {e.email || e.contact?.email || "—"}</div>
        <div className="text-xs text-zinc-600">
          Pay: {e.payroll?.payType || "—"} {e.payroll?.hourlyRate ? `@$${e.payroll.hourlyRate}/hr`:""} {e.payroll?.flatRate ? `@$${e.payroll.flatRate}/flag`:""}
        </div>
        <div className="text-[11px] text-zinc-500">
          Access: {e.access?.canAccessAdmin ? "Admin" : ""}{e.access?.canAccessPayroll ? (e.access?.canAccessAdmin ? ", Payroll":"Payroll") : (!e.access?.canAccessAdmin ? "None": "")}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="rounded-lg border px-2 py-1 text-xs" onClick={()=>onEdit(e)}><Edit2 className="mr-1 inline h-3 w-3"/>Edit</button>
        <button className="rounded-lg border px-2 py-1 text-xs" onClick={()=>onArchive(e)}><Archive className="mr-1 inline h-3 w-3"/>Archive</button>
        <button className="rounded-lg border px-2 py-1 text-xs text-red-600" onClick={()=>onDelete(e)}><Trash2 className="mr-1 inline h-3 w-3"/>Delete</button>
      </div>
    </div>
  );
}

export default function Users() {
  const { user } = useAuth();
  const shopId = user?.uid;
  const [employees, setEmployees] = useState([]);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!shopId) return;
    const q = query(collection(db, "shops", shopId, "employees"), orderBy("lastName", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEmployees(list);
    });
    return () => unsub();
  }, [shopId]);

  const filtered = useMemo(() => {
    if (!filter) return employees;
    const f = filter.toLowerCase();
    return employees.filter(e =>
      [e.firstName, e.lastName, e.contact?.phone, e.email, e.contact?.email]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(f))
    );
  }, [employees, filter]);

  const startNew = () => { setEditing(null); setIsCreating(true); };

  const saveEmployee = async (data) => {
    if (!shopId) throw new Error("Missing shop id.");
    if (editing?.id) {
      await updateDoc(doc(db, "shops", shopId, "employees", editing.id), { ...data, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, "shops", shopId, "employees"), { ...data, createdAt: serverTimestamp() });
    }
    setEditing(null); setIsCreating(false);
  };

  const archiveEmployee = async (e) => {
    if (!shopId) return;
    await updateDoc(doc(db, "shops", shopId, "employees", e.id), { status: "inactive", updatedAt: serverTimestamp() });
  };

  const deleteEmployee = async (e) => {
    if (!shopId) return;
    if (!confirm(`Delete ${e.firstName} ${e.lastName}? This cannot be undone.`)) return;
    await deleteDoc(doc(db, "shops", shopId, "employees", e.id));
  };

  return (
    <div className="mx-auto w-full max-w-screen-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Admin — Users</h1>
          <p className="text-sm text-zinc-600">Create employee accounts, store payroll & emergency info, and manage access.</p>
        </div>
        <button onClick={startNew} className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          <UserPlus className="mr-1 inline h-4 w-4"/>New Employee
        </button>
      </div>

      {(isCreating || editing) ? (
        <EmployeeForm initial={editing} onCancel={()=>{setIsCreating(false); setEditing(null);}} onSave={saveEmployee} />
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2">
            <div className="relative w-full md:w-80">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-zinc-500" />
              <input className="w-full rounded border pl-8 pr-3 py-2" placeholder="Search by name, phone, or email" value={filter} onChange={e=>setFilter(e.target.value)} />
            </div>
            <div className="text-xs text-zinc-600">{filtered.length} employees</div>
          </div>

          <div className="grid gap-2">
            {filtered.map(e => (
              <EmployeeRow key={e.id} e={e} onEdit={setEditing} onArchive={archiveEmployee} onDelete={deleteEmployee} />
            ))}
            {filtered.length === 0 && (
              <div className="rounded-xl border p-6 text-center text-sm text-zinc-600">
                No employees yet. Click <b>New Employee</b> to add your first team member.
              </div>
            )}
          </div>

          <div className="mt-6 rounded-xl border p-4 text-xs text-zinc-600">
            <div className="mb-1 font-semibold">How “sub-logins” work</div>
            <ol className="list-inside list-decimal space-y-1">
              <li>You (the shop owner) stay signed in with your normal email/password.</li>
              <li>Employees are created here and assigned a unique email and 4-digit PIN. The PIN is stored securely as a salted hash; never in plain text.</li>
              <li>Elsewhere in the app (e.g., Check-In, Inspections, Time Clock), employees can enter their email + PIN to identify themselves without needing full Firebase accounts.</li>
              <li>Access toggles above control whether they can open the Admin menu and/or Payroll screens while the shop account is signed in.</li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
