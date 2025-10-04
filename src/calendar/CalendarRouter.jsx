import React, { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../lib/firebase";
import DayBayView from "./DayBayView.jsx";
import GoogleCalendar from "./GoogleCalendar.jsx";

export default function CalendarRouter() {
  const [uid, setUid] = useState(null);
  const [style, setStyle] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u ? u.uid : null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, "shops", uid, "settings", "calendar");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const v = (snap.data()?.style || "board").toLowerCase();
        setStyle(["board", "grid"].includes(v) ? v : "board");
      },
      () => setStyle("board")
    );
    return () => unsub();
  }, [uid]);

  if (!uid || !style) return <div className="p-6">Loading calendar…</div>;
  return style === "grid" ? <GoogleCalendar /> : <DayBayView />;
}
