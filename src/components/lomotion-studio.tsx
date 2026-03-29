"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCameraConstraints } from "@/lib/camera";
import { drawPixelGrid } from "@/lib/grid";
import { encodeGif, type CapturedFrame } from "@/lib/gif";
import { DEFAULT_THRESHOLD, LCD_BLACK, LCD_GREEN, MAX_RECORD_MS, RECORD_FPS, TARGET_WIDTH } from "@/lib/palette";
import { quantizeTo1Bit } from "@/lib/quantize";

type Mode = "live" | "recording" | "processing" | "review";
type AspectMode = "full" | "square" | "classic";

export function LoMotionStudio() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const processCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<CapturedFrame[]>([]);
  const modeRef = useRef<Mode>("live");
  const thresholdRef = useRef(DEFAULT_THRESHOLD);
  const recordStartRef = useRef<number>(0);
  const lastCaptureAtRef = useRef<number>(0);
  const objectUrlRef = useRef<string | null>(null);

  const [mode, setMode] = useState<Mode>("live");
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [gifUrl, setGifUrl] = useState("");
  const [gifBlob, setGifBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const [recordMs, setRecordMs] = useState(0);
  const [aspectMode, setAspectMode] = useState<AspectMode>("full");
  const [previewSize, setPreviewSize] = useState({ width: TARGET_WIDTH, height: 84 });

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    thresholdRef.current = threshold;
  }, [threshold]);

  const displayScale = useMemo(() => {
    if (typeof window === "undefined") return 4;
    const maxWidth = Math.max(320, Math.min(window.innerWidth, 640));
    return Math.max(3, Math.floor(maxWidth / previewSize.width));
  }, [previewSize.width]);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const renderProcessedFrame = useCallback((capture = false, now = performance.now()) => {
    const video = videoRef.current;
    const displayCanvas = displayCanvasRef.current;
    const processCanvas = processCanvasRef.current;
    if (!video || !displayCanvas || !processCanvas) return;
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;

    const sourceAspect = video.videoHeight / video.videoWidth;
    const targetHeight = (() => {
      if (aspectMode === "classic") return 48;
      if (aspectMode === "square") return TARGET_WIDTH;
      return Math.max(48, Math.round(sourceAspect * TARGET_WIDTH));
    })();
    if (processCanvas.width !== TARGET_WIDTH || processCanvas.height !== targetHeight) {
      processCanvas.width = TARGET_WIDTH;
      processCanvas.height = targetHeight;
      setPreviewSize({ width: TARGET_WIDTH, height: targetHeight });
    }

    const pctx = processCanvas.getContext("2d", { willReadFrequently: true });
    const dctx = displayCanvas.getContext("2d");
    if (!pctx || !dctx) return;

    pctx.drawImage(video, 0, 0, TARGET_WIDTH, targetHeight);
    const raw = pctx.getImageData(0, 0, TARGET_WIDTH, targetHeight);
    const quantized = quantizeTo1Bit(raw, thresholdRef.current);

    displayCanvas.width = TARGET_WIDTH * displayScale;
    displayCanvas.height = targetHeight * displayScale;
    dctx.imageSmoothingEnabled = false;
    dctx.fillStyle = LCD_BLACK;
    dctx.fillRect(0, 0, displayCanvas.width, displayCanvas.height);

    for (let y = 0; y < quantized.height; y += 1) {
      for (let x = 0; x < quantized.width; x += 1) {
        const idx = y * quantized.width + x;
        dctx.fillStyle = quantized.binary[idx] ? LCD_GREEN : LCD_BLACK;
        dctx.fillRect(x * displayScale, y * displayScale, displayScale, displayScale);
      }
    }

    drawPixelGrid(dctx, quantized.width, quantized.height, displayScale);

    if (capture) {
      const interval = 1000 / RECORD_FPS;
      if ((now - lastCaptureAtRef.current) >= interval) {
        framesRef.current.push({
          binary: new Uint8Array(quantized.binary),
          width: quantized.width,
          height: quantized.height,
        });
        lastCaptureAtRef.current = now;
      }
    }
  }, [aspectMode, displayScale]);

  const stopRecordingRef = useRef<() => Promise<void>>(async () => {});

  const loop = useCallback((now: number) => {
    const isRecording = modeRef.current === "recording";
    renderProcessedFrame(isRecording, now);

    if (isRecording) {
      const elapsed = now - recordStartRef.current;
      setRecordMs(elapsed);
      if (elapsed >= MAX_RECORD_MS) {
        void stopRecordingRef.current();
        return;
      }
    }

    rafRef.current = window.requestAnimationFrame(loop);
  }, [renderProcessedFrame]);

  const startCamera = useCallback(async () => {
    setError("");
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia(getCameraConstraints(facingMode));
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = window.requestAnimationFrame(loop);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camera unavailable");
    }
  }, [facingMode, stopStream]);

  useEffect(() => {
    void startCamera();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stopStream();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [startCamera, stopStream]);

  useEffect(() => {
    if (!streamRef.current) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = window.requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [loop, displayScale]);

  const startRecording = useCallback(() => {
    if (mode === "processing") return;
    framesRef.current = [];
    recordStartRef.current = performance.now();
    lastCaptureAtRef.current = 0;
    setRecordMs(0);
    setMode("recording");
  }, [mode]);

  const stopRecording = useCallback(async () => {
    if (modeRef.current !== "recording") return;
    setMode("processing");
    modeRef.current = "processing";
    try {
      if (!framesRef.current.length) {
        renderProcessedFrame(true, performance.now());
      }
      const blob = await encodeGif(framesRef.current, RECORD_FPS);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setGifBlob(blob);
      setGifUrl(url);
      setMode("review");
      modeRef.current = "review";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to render GIF");
      setMode("live");
      modeRef.current = "live";
    }
  }, [renderProcessedFrame]);

  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  const retake = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    framesRef.current = [];
    setGifBlob(null);
    setGifUrl("");
    setRecordMs(0);
    setMode("live");
  }, []);

  const saveGif = useCallback(() => {
    if (!gifBlob) return;
    const url = URL.createObjectURL(gifBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lomotion-${Date.now()}.gif`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [gifBlob]);

  const shareGif = useCallback(async () => {
    if (!gifBlob) return;
    const file = new File([gifBlob], "lomotion.gif", { type: "image/gif" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "LoMotion", text: "Made with LoMotion" });
      } else {
        saveGif();
      }
    } catch {
      // ignore cancelled share
    }
  }, [gifBlob, saveGif]);

  const toggleCamera = useCallback(() => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }, []);

  const cycleAspectMode = useCallback(() => {
    setAspectMode((prev) => {
      if (prev === "full") return "square";
      if (prev === "square") return "classic";
      return "full";
    });
  }, []);

  const aspectLabel = aspectMode === "full" ? "Full" : aspectMode === "square" ? "1:1" : "Classic";
  const seconds = Math.min(10, Math.ceil(recordMs / 1000));

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#171916] text-[#96b56f]">
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={processCanvasRef} className="hidden" />

      <div className="pointer-events-none absolute left-4 top-4 z-20 font-mono text-sm tracking-[0.2em] text-[#96b56f]">
        LoMotion
      </div>

      <div className="flex min-h-screen items-center justify-center">
        {mode === "review" && gifUrl ? (
          <img
            src={gifUrl}
            alt="LoMotion GIF preview"
            className="h-[100svh] w-[100vw] bg-[#171916] object-contain"
            style={{ imageRendering: "pixelated" }}
          />
        ) : (
          <canvas
            ref={displayCanvasRef}
            className="h-[100svh] w-[100vw] bg-[#171916] object-contain"
            style={{ imageRendering: "pixelated" }}
          />
        )}
      </div>

      {mode === "review" ? (
        <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-3 bg-gradient-to-t from-[#171916] via-[#171916]/90 to-transparent px-4 pb-8 pt-16">
          <button onClick={saveGif} className="rounded-full border border-[#96b56f] bg-[#171916] px-5 py-3 font-mono text-sm uppercase tracking-wide">Save</button>
          <button onClick={shareGif} className="rounded-full border border-[#96b56f] bg-[#96b56f] px-5 py-3 font-mono text-sm uppercase tracking-wide text-[#171916]">Share</button>
          <button onClick={retake} className="rounded-full border border-[#96b56f] bg-[#171916] px-5 py-3 font-mono text-sm uppercase tracking-wide">Retake</button>
        </div>
      ) : (
        <div className="absolute inset-x-0 bottom-0 z-30 px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-16">
          <div className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-[28px] border border-[#96b56f]/20 bg-[#171916]/70 p-4 backdrop-blur-sm">
            <label className="flex flex-col gap-2 font-mono text-xs uppercase tracking-[0.18em] text-[#96b56f]">
              Threshold
              <input
                type="range"
                min={0}
                max={255}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="accent-[#96b56f]"
              />
            </label>

            <div className="flex items-center justify-between gap-4">
              <button
                onClick={toggleCamera}
                className="rounded-full border border-[#96b56f] bg-[#171916] px-4 py-3 font-mono text-xs uppercase tracking-[0.16em]"
              >
                {facingMode === "environment" ? "Rear" : "Front"}
              </button>

              <button
                onPointerDown={startRecording}
                onPointerUp={() => void stopRecording()}
                onPointerCancel={() => void stopRecording()}
                onPointerLeave={() => void stopRecording()}
                className="grid h-20 w-20 place-items-center rounded-full border-4 border-[#96b56f] bg-[#171916]"
                aria-label="Hold to record"
              >
                <span className={`h-8 w-8 rounded-full ${mode === "recording" ? "bg-[#96b56f]" : "border-2 border-[#96b56f]"}`} />
              </button>

              <div className="flex flex-col items-end gap-2">
                {mode === "recording" ? (
                  <div className="w-16 text-right font-mono text-xs uppercase tracking-[0.14em] text-[#96b56f]">
                    {`${seconds}s`}
                  </div>
                ) : null}
                <button
                  onClick={cycleAspectMode}
                  className="rounded-full border border-[#96b56f] bg-[#171916] px-4 py-3 font-mono text-xs uppercase tracking-[0.16em]"
                >
                  {aspectLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === "processing" ? (
        <div className="absolute inset-0 z-40 grid place-items-center bg-[#171916]/90">
          <div className="font-mono text-sm uppercase tracking-[0.2em] text-[#96b56f]">Rendering GIF…</div>
        </div>
      ) : null}

      {error ? (
        <div className="absolute inset-x-4 top-12 z-40 rounded-xl border border-red-400/40 bg-[#171916]/90 px-4 py-3 font-mono text-xs text-red-300">
          {error}
        </div>
      ) : null}
    </main>
  );
}
