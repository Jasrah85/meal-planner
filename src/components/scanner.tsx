"use client";

import { useEffect, useRef } from "react";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library"; // @zxing/library
// Docs: npmjs.com/package/@zxing/library  (we're using the browser camera APIs). :contentReference[oaicite:2]{index=2}

export default function Scanner({ onResult }: { onResult: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    let active = true;

    async function start() {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // Loop decode without blocking UI
      (async function loop() {
        if (!active) return;
        try {
          const result = await reader.decodeOnceFromVideoDevice(undefined, videoRef.current!);
          if (result?.getText()) onResult(result.getText());
        } catch (e) {
          if (!(e instanceof NotFoundException)) {
            console.warn("Decode error", e);
          }
        } finally {
          // small delay to prevent tight-looping
          setTimeout(loop, 250);
        }
      })();
    }

    start();

    return () => {
      active = false;
      reader.reset();
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, [onResult]);

  return (
    <div className="aspect-video w-full max-w-xl overflow-hidden rounded-md border">
      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
    </div>
  );
}
