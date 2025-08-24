"use client";

import { useEffect, useRef } from "react";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";

export default function Scanner({ onResult }: { onResult: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const videoEl = videoRef.current; // capture once for cleanup
    const reader = new BrowserMultiFormatReader();
    let active = true;

    // start camera + continuous decode; do NOT make the effect async
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (!videoEl) return;
        videoEl.srcObject = stream;
        await videoEl.play();

        // don't assign/await this; it returns a Promise
        reader.decodeFromVideoDevice(null, videoEl, (result, err) => {
          if (!active) return;
          if (result) {
            const text = result.getText();
            if (text) onResult(text);
          } else if (err && !(err instanceof NotFoundException)) {
            // eslint-disable-next-line no-console
            console.warn("ZXing decode error:", err);
          }
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Camera start failed:", e);
      }
    })();

    // ✅ cleanup must be sync and return void
    return () => {
      active = false;
      try {
        reader.reset(); // stops ZXing loop
      } catch {/* ignore */}
      const stream = (videoEl?.srcObject as MediaStream | null) ?? null;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (videoEl) videoEl.srcObject = null;
    };
  }, [onResult]);

  return (
    <div className="aspect-video w-full max-w-xl overflow-hidden rounded-md border">
      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
    </div>
  );
}
