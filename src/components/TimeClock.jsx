import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider.jsx";
import { db } from "../lib/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { Clock, ChevronDown } from "lucide-react";

/** Re-create the same salted hash we stored on the employee doc and compare */
async function verifyPinForEmployee(emp, pin) {
  if (!emp?.pin?.saltB64 || !emp?.pin?.hashB64) return false;
  const salt = Uint8Array.from(atob(emp.pin.saltB64), c => c.charCodeAt(0));
  const enc = new TextEncoder();
  const pinBytes = enc.encode(pin);
  const combined = new Uint8Array(salt.length + pinBytes.length);
  combined.set(salt);
  combined.set(pinBytes, salt.length);
  const digest = await crypto.subtle.digest("SHA-256", combined);
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return hashB64 === emp.pin.hashB64;
}

/** Monday 00:00:00 start-of-week */
function startOfWeek(d = new Date()) {
  const copy = new Date(d);
  const day = copy.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day); // move to Monday
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0,0,0,0);
  return copy;
}

function isoDateOnly(d) {
  // YYYY-MM-DD
  return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10);
}

export default function TimeClock() {
  const { user } = useAuth();
  const shopId = user?.uid;

  const [expanded, setExpanded] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [action, setAction] = useState("clockIn"); // clockIn | clockOut | lunchOut | lunchIn
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    if (!shopId) return;
    const qEmp = query(
      collection(db, "shops", shopId, "employees"),
      orderBy("lastName", "asc")
    );
    const unsub = onSnapshot(qEmp, snap => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [shopId]);

  const submit = async () => {
    setStatusMsg("");
    if (!shopId) return;
    if (!/^\d{4}$/.test(pin)) {
      setStatusMsg("PIN must be exactly 4 digits.");
      return;
    }
    setBusy(true);
    try {
      // Find the employee by matching salted hash
      let match = null;
      for (const emp of employees) {
        // skip inactive
        if (emp.status === "inactive") continue;
        // verify if they have a stored pin
        if (await verifyPinForEmployee(emp, pin)) {
          match = emp;
          break;
        }
      }
      if (!match) {
        setStatusMsg("PIN not recognized. (If multiple employees share the same PIN, set a unique one.)");
        setBusy(false);
        return;
      }

      const now = new Date();
      const weekStart = startOfWeek(now);
      const log = {
        employeeId: match.id,
        employeeName: `${match.firstName || ""} ${match.lastName || ""}`.trim(),
        employeeEmail: match.email || match.contact?.email || null,
        action,                          // clockIn | clockOut | lunchOut | lunchIn
        at: now.toISOString(),           // local timestamp for display/filtering
        atMs: now.getTime(),             // easy sorting
        weekStartISO: isoDateOnly(weekStart),
        createdAt: serverTimestamp(),    // authoritative server time
      };

      await addDoc(collection(db, "shops", shopId, "timeLogs"), log);
      setStatusMsg(`${log.employeeName} — ${action.replace(/([A-Z])/g,' $1').toLowerCase()} recorded.`);
      setPin("");
    } catch (err) {
      console.error(err);
      setStatusMsg(err.message || "Error recording time.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-10">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center justify-between rounded-2xl border bg-white p-4 shadow-sm"
      >
        <div className="flex items-center gap-2 font-semibold">
          <Clock className="h-5 w-5" />
          Time Clock
        </div>
        <ChevronDown className={"h-5 w-5 transition " + (expanded ? "rotate-180" : "")}/>
      </button>

      {expanded && (
        <div className="mt-3 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-1">
              <label className="text-xs font-medium text-zinc-600">4-digit PIN</label>
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={pin}
                maxLength={4}
                onChange={e => setPin(e.target.value.replace(/\D/g,''))}
                placeholder="1234"
                type="password"
              />
              <p className="mt-2 text-xs text-zinc-500">
                Enter your PIN and choose an action.
              </p>
            </div>
            <div className="md:col-span-1">
              <label className="text-xs font-medium text-zinc-600">Action</label>
              <select
                className="mt-1 w-full rounded border px-3 py-2"
                value={action}
                onChange={e => setAction(e.target.value)}
              >
                <option value="clockIn">Clock In</option>
                <option value="clockOut">Clock Out</option>
                <option value="lunchOut">Lunch Out</option>
                <option value="lunchIn">Lunch In</option>
              </select>
            </div>
            <div className="flex items-end md:col-span-1">
              <button
                onClick={submit}
                disabled={busy}
                className="w-full rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Submit"}
              </button>
            </div>
          </div>
          {statusMsg && <div className="mt-3 text-sm text-zinc-700">{statusMsg}</div>}
        </div>
      )}
    </div>
  );
}
