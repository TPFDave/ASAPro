import React from "react";

// Red / Yellow / Green selector
export default function RYG({ value, onChange }) {
  const b = "flex-1 rounded-lg border px-3 py-2 text-sm";
  const active = (k) => value === k ? "bg-zinc-900 text-white" : "";
  return (
    <div className="flex gap-2">
      <button type="button" className={`${b} ${active("red")}`} onClick={()=>onChange("red")}>Red</button>
      <button type="button" className={`${b} ${active("yellow")}`} onClick={()=>onChange("yellow")}>Yellow</button>
      <button type="button" className={`${b} ${active("green")}`} onClick={()=>onChange("green")}>Green</button>
    </div>
  );
}
