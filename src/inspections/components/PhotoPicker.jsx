import React, { useRef, useState } from "react";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function PhotoPicker({ pathPrefix, onUploaded }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handlePick = () => fileRef.current?.click();

  const handleFiles = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const resizedBlob = await resizeImage(file, 1600); // limit width ~1600px
      const storage = getStorage();
      const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
      const fullPath = `${pathPrefix}/${filename}`;
      const sref = ref(storage, fullPath);
      await uploadBytes(sref, resizedBlob, { contentType: "image/jpeg" });
      const url = await getDownloadURL(sref);
      onUploaded?.({ url, path: fullPath });
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFiles} />
      <button type="button" disabled={busy}
        onClick={handlePick}
        className="rounded-lg border px-3 py-2 text-sm disabled:opacity-60">
        {busy ? "Uploading…" : "Add Photo"}
      </button>
    </div>
  );
}

// resize to maxWidth, JPEG ~0.7 quality
async function resizeImage(file, maxWidth=1600) {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.7 });
  return blob;
}
