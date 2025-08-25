"use client";

import { useEffect, useRef, useState } from "react";
import {
  BrowserMultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  NotFoundException,
  Result,
  Exception,
} from "@zxing/library";

type Props = { onResult: (code: string) => void };

export default function Scanner({ onResult }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Prefer a back/environment camera if label is available
  useEffect(() => {
    (async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter(d => d.kind === "videoinput");
        const back = cams.find(d => /back|rear|environment/i.test(d.label));
        setDeviceId(back?.deviceId ?? cams[0]?.deviceId ?? null);
      } catch {
        // If permission isn’t granted yet, decodeFromVideoDevice will still prompt later.
      }
    })();
  }, []);

  useEffect(() => {
    if (!videoRef.current) return;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.QR_CODE, // keep QR for quick sanity checks
    ]);

    const reader = new BrowserMultiFormatReader(hints);
    readerRef.current = reader;

    let stopped = false;
    let stopFn: (() => void) | null = null;

    reader
      .decodeFromVideoDevice(deviceId, videoRef.current, (
        result: Result | undefined,
        err: Exception | undefined,
        controls?: unknown
      ) => {
        // cache stop() if available
        if (!stopFn && controls && typeof (controls as { stop?: () => void }).stop === "function") {
          stopFn = (controls as { stop: () => void }).stop.bind(controls);
        }

        if (result) {
          const text = result.getText();
          if (text) {
            setLastCode(text);
            onResult(text);
          }
          return;
        }
        if (err && !(err instanceof NotFoundException)) {
          setError(String((err as Error).message || err));
        }
      })
      .catch(e => setError(String((e as Error).message || e)));

    return () => {
      stopped = true;
      try { stopFn?.(); } catch {}
      try { reader.reset(); } catch {}
      const el = videoRef.current;
      const stream = (el?.srcObject as MediaStream | null) || null;
      stream?.getTracks().forEach(t => t.stop());
      if (el) el.srcObject = null;
    };
  }, [deviceId, onResult]);

  return (
    <div className="space-y-2">
      <div className="aspect-video w-full max-w-xl overflow-hidden rounded-md border relative">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        <div className="absolute inset-0 pointer-events-none grid place-items-center">
          <div className="w-3/4 h-1/3 border-2 border-white/80 rounded" />
        </div>
      </div>
      <div className="text-xs text-gray-600">
        {lastCode ? <>Last code: <span className="font-mono">{lastCode}</span></> : "Point at a UPC/EAN or QR…"}
        {error ? <span className="text-red-600 ml-2">{error}</span> : null}
      </div>
    </div>
  );
}
