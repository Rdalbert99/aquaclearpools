import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  clientId: string;
  label: "Before Photo" | "After Photo";
  onUploaded: (url: string) => void;
};

export function ServicePhotoUpload({ clientId, label, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);

      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const base = label.startsWith("Before") ? "before" : "after";
      const path = `clients/${clientId}/${ts}-${base}.jpg`;

      const { error: upErr } = await supabase
        .storage
        .from("photos")
        .upload(path, file, { upsert: true, cacheControl: "3600", contentType: "image/jpeg" });

      if (upErr) throw upErr;

      const { data } = supabase.storage.from("photos").getPublicUrl(path);
      onUploaded(data.publicUrl);
    } catch (err) {
      console.error(err);
      alert("Upload failed. Try again.");
    } finally {
      setUploading(false);
      e.currentTarget.value = "";
    }
  }

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        disabled={uploading}
        onChange={handleFileChange}
      />
    </div>
  );
}