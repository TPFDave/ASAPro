import React from "react";

export default function PassFail({ value, onChange }) {
  const b = "flex-1 rounded-lg border px-3 py-2 text-sm";
  const active = (k) => value === k ? "bg-zinc-900 text-white" : "";
  return (
    <div className="flex gap-2">
      <button type="button" className={`${b} ${active("pass")}`} onClick={()=>onChange("pass")}>Pass</button>
      <button type="button" className={`${b} ${active("fail")}`} onClick={()=>onChange("fail")}>Fail</button>
    </div>
  );
}
