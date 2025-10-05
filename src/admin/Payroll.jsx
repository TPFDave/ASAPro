import React, { useEffect, useMemo, useState } from "react";
import { db } from "../lib/firebase";
import { useAuth } from "../auth/AuthProvider.jsx";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

function startOfWeek(d = new Date()) {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = (day === 0 ? -6 : 1 - day); // Monday
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0,0,0,0);
  return copy;
}
function isoDateOnly(d) {
  return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10);
}
function endOfWeek(weekStart) {
  const e = new Date(weekStart);
  e.setDate(e.getDate() + 7);
  return e;
}
function fmt(dtIso) {
  const d = new Date(dtIso);
  return d.toLocaleString();
}
function hours(ms) {
  return Math.round((ms/36e5)*100)/100;
}

/** Greedy pairing: ClockIn→ClockOut is “work”; LunchOut→LunchIn subtracts from work. */
function computeEmployeeWeeklyHours(logs) {
  // logs: sorted for a single employee in the chosen week
  let totalMs = 0;
  let currentIn = null;
  let lunchOut = null;

  for (const log of logs) {
    if (log.action === "clockIn") {
      currentIn = new Date(log.at);
      lunchOut = null;
    } else if (log.action === "lunchOut") {
      lunchOut = new Date(log.at);
    } else if (log.action === "lunchIn") {
      // only meaningful if lunchOut exists
      if (currentIn && lunchOut) {
        // we'll subtract this lunch later when we clockOut
      }
    } else if (log.action === "clockOut") {
      if (currentIn) {
        const out = new Date(log.at);
        let stint = out - currentIn;
        if (lunchOut) {
          // find matching lunchIn after lunchOut before clockOut
          const lunchIn = logs.find(l => l.action === "lunchIn" && new Date(l.at) > lunchOut && new Date(l.at) <= out);
          if (lunchIn) {
            stint -= (new Date(lunchIn.at) - lunchOut);
          }
        }
        if (stint > 0) totalMs += stint;
        currentIn = null;
        lunchOut = null;
      }
    }
  }
  return hours(totalMs);
}

export default function Payroll() {
  const { user } = useAuth();
  const shopId = user?.uid;

  const [employees, setEmployees] = useState([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek());
  const [logs, setLogs] = useState([]);
  const [view, setView] = useState("byEmployee"); // byEmployee | allLogs | timeCard
  const [selectedEmp, setSelectedEmp] = useState(null);

  const weekStartISO = isoDateOnly(weekStart);

  useEffect(() => {
    if (!shopId) return;
    const unsubEmp = onSnapshot(
      query(collection(db, "shops", shopId, "employees"), orderBy("lastName", "asc")),
      (snap) => setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsubEmp();
  }, [shopId]);

  useEffect(() => {
    if (!shopId) return;
    // We stored weekStartISO on each time log; pull just this week
    const qLogs = query(
      collection(db, "shops", shopId, "timeLogs"),
      where("weekStartISO", "==", weekStartISO),
      orderBy("atMs", "asc")
    );
    const unsub = onSnapshot(qLogs, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [shopId, weekStartISO]);

  const logsByEmp = useMemo(() => {
    const map = new Map();
    for (const l of logs) {
      if (!map.has(l.employeeId)) map.set(l.employeeId, []);
      map.get(l.employeeId).push(l);
    }
    // ensure time order
    for (const arr of map.values()) arr.sort((a,b)=>a.atMs-b.atMs);
    return map;
  }, [logs]);

  const weeklyRows = useMemo(() => {
    const rows = [];
    for (const emp of employees) {
      const elogs = logsByEmp.get(emp.id) || [];
      const total = computeEmployeeWeeklyHours(elogs);
      rows.push({ employee: emp, totalHours: total });
    }
    // show actives first with hours, then zeros, then inactive
    rows.sort((a, b) => {
      const aInactive = (a.employee.status === "inactive") ? 1 : 0;
      const bInactive = (b.employee.status === "inactive") ? 1 : 0;
      if (aInactive !== bInactive) return aInactive - bInactive;
      return b.totalHours - a.totalHours;
    });
    return rows;
  }, [employees, logsByEmp]);

  const selectedEmpLogs = useMemo(() => {
    if (!selectedEmp) return [];
    const elogs = (logsByEmp.get(selectedEmp.id) || []).slice();
    elogs.sort((a,b)=>a.atMs-b.atMs);
    return elogs;
  }, [logsByEmp, selectedEmp]);

  return (
    <div className="mx-auto w-full max-w-screen-2xl p-4">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Admin — Payroll</h1>
          <p className="text-sm text-zinc-600">Weekly summary, raw logs, and individual time cards.</p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row">
          <label className="text-xs font-medium text-zinc-600">Week starting (Mon)</label>
          <input
            type="date"
            value={isoDateOnly(weekStart)}
            onChange={e => setWeekStart(new Date(e.target.value + "T00:00:00"))}
            className="rounded border px-3 py-2"
          />
          <select className="rounded border px-3 py-2" value={view} onChange={e=>setView(e.target.value)}>
            <option value="byEmployee">By Employee (Week)</option>
            <option value="allLogs">All Logs (Week)</option>
            <option value="timeCard">Employee Time Card</option>
          </select>
          {view === "timeCard" && (
            <select
              className="rounded border px-3 py-2"
              value={selectedEmp?.id || ""}
              onChange={e => setSelectedEmp(employees.find(x => x.id === e.target.value) || null)}
            >
              <option value="">Select Employee</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {view === "byEmployee" && (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm text-zinc-600">Week of {isoDateOnly(weekStart)} – {isoDateOnly(endOfWeek(weekStart))}</div>
          <div className="overflow-x-auto">
            <table className="min-w-[600px] w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="border-b p-2">Employee</th>
                  <th className="border-b p-2">Status</th>
                  <th className="border-b p-2">Total Hours</th>
                </tr>
              </thead>
              <tbody>
                {weeklyRows.map(row => (
                  <tr key={row.employee.id} className="hover:bg-zinc-50">
                    <td className="border-b p-2">{row.employee.firstName} {row.employee.lastName}</td>
                    <td className="border-b p-2 text-zinc-600">{row.employee.status ?? "active"}</td>
                    <td className="border-b p-2 font-semibold">{row.totalHours.toFixed(2)}</td>
                  </tr>
                ))}
                {weeklyRows.length === 0 && (
                  <tr><td className="p-3 text-zinc-600" colSpan={3}>No employees/logs.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === "allLogs" && (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm text-zinc-600">Week of {isoDateOnly(weekStart)}</div>
          <div className="overflow-x-auto">
            <table className="min-w-[800px] w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="border-b p-2">When</th>
                  <th className="border-b p-2">Employee</th>
                  <th className="border-b p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} className="hover:bg-zinc-50">
                    <td className="border-b p-2">{fmt(l.at)}</td>
                    <td className="border-b p-2">{l.employeeName}</td>
                    <td className="border-b p-2">{l.action}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td className="p-3 text-zinc-600" colSpan={3}>No logs for this week.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === "timeCard" && (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          {!selectedEmp ? (
            <div className="text-sm text-zinc-600">Select an employee to view their time card.</div>
          ) : (
            <>
              <div className="mb-2 text-sm text-zinc-600">
                Time card for <b>{selectedEmp.firstName} {selectedEmp.lastName}</b> — week of {isoDateOnly(weekStart)}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[800px] w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="border-b p-2">When</th>
                      <th className="border-b p-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEmpLogs.map(l => (
                      <tr key={l.id} className="hover:bg-zinc-50">
                        <td className="border-b p-2">{fmt(l.at)}</td>
                        <td className="border-b p-2">{l.action}</td>
                      </tr>
                    ))}
                    {selectedEmpLogs.length === 0 && (
                      <tr><td className="p-3 text-zinc-600" colSpan={2}>No logs.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 text-sm">
                <span className="mr-2 font-medium">Total (computed):</span>
                {(() => {
                  const total = computeEmployeeWeeklyHours(selectedEmpLogs);
                  return <b>{total.toFixed(2)} hours</b>;
                })()}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
