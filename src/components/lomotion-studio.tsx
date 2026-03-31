"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCameraConstraints } from "@/lib/camera";
import { drawPixelGrid } from "@/lib/grid";
import { encodeGif, type CapturedFrame } from "@/lib/gif";
import { DEFAULT_THRESHOLD, LCD_BLACK, LCD_GREEN, MAX_RECORD_MS, RECORD_FPS, TARGET_WIDTH } from "@/lib/palette";
import { quantizeFrame } from "@/lib/quantize";
import { LOGO_BITMAP, LOGO_OFFSET_X, LOGO_OFFSET_Y } from "@/lib/logo-mask";
import { triggerHaptic } from "@/lib/haptics";

type Mode = "live" | "recording" | "processing" | "review";
type AspectMode = "full" | "square" | "classic";
type PlaybackMode = "loop" | "boomerang";

function FlipCameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="3.5" y="7" width="17" height="10" rx="2" />
      <path d="M9 4.5h6" />
      <path d="M8 11c.8-1.2 2.2-2 4-2 1.2 0 2.3.4 3.1 1.1" />
      <path d="M14.8 9.8l.9.3-.3.9" />
      <path d="M16 13c-.8 1.2-2.2 2-4 2-1.2 0-2.3-.4-3.1-1.1" />
      <path d="M9.2 14.2l-.9-.3.3-.9" />
    </svg>
  );
}

function PlaybackModeIcon({ mode }: { mode: PlaybackMode }) {
  if (mode === "boomerang") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M16.5 6.5H10a4.5 4.5 0 0 0 0 9h7" />
        <path d="m14 13 3 2.5 3-2.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M5 12h12" />
      <path d="m13 8 4 4-4 4" />
    </svg>
  );
}

function AspectIcon({ mode }: { mode: AspectMode }) {
  if (mode === "full") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="7" y="3.5" width="10" height="17" rx="2" />
      </svg>
    );
  }
  if (mode === "square") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="5.5" y="5.5" width="13" height="13" rx="2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="4" y="7" width="16" height="10" rx="2" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M12 4v10" />
      <path d="m8.5 10.5 3.5 3.5 3.5-3.5" />
      <path d="M5 17.5h14" />
      <rect x="4" y="3.5" width="16" height="17" rx="3" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <circle cx="18" cy="5.5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="18.5" r="2.5" />
      <path d="M8.3 10.8 15.7 6.7" />
      <path d="M8.3 13.2 15.7 17.3" />
    </svg>
  );
}

function RetakeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M8 8a7 7 0 1 1-1.7 5.8" />
      <path d="M8 8 5.2 8.2" />
      <path d="M8 8 6.1 5.9" />
    </svg>
  );
}

export function LoMotionStudio() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const processCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<CapturedFrame[]>([]);
  const isPressingRef = useRef(false);
  const modeRef = useRef<Mode>("live");
  const thresholdRef = useRef(DEFAULT_THRESHOLD);
  const recordStartRef = useRef<number>(0);
  const lastCaptureAtRef = useRef<number>(0);
  const lastSecondHapticRef = useRef<number>(0);
  const objectUrlRef = useRef<string | null>(null);
  const renderStartRef = useRef<number>(0);
  const cameraStartPromiseRef = useRef<Promise<void> | null>(null);

  const [mode, setMode] = useState<Mode>("live");
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [gifUrl, setGifUrl] = useState("");
  const [gifBlob, setGifBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const [recordMs, setRecordMs] = useState(0);
  const [aspectMode, setAspectMode] = useState<AspectMode>("full");
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("loop");
  const [previewSize, setPreviewSize] = useState({ width: TARGET_WIDTH, height: 84 });
  const [renderElapsedMs, setRenderElapsedMs] = useState(0);
  const [renderFrameProgress, setRenderFrameProgress] = useState({ current: 0, total: 0, phase: "idle" });

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

    const targetAspect = targetHeight / TARGET_WIDTH;
    const videoAspect = video.videoHeight / video.videoWidth;
    let sx = 0;
    let sy = 0;
    let sWidth = video.videoWidth;
    let sHeight = video.videoHeight;

    if (aspectMode !== "full") {
      if (videoAspect > targetAspect) {
        sHeight = Math.round(video.videoWidth * targetAspect);
        sy = Math.round((video.videoHeight - sHeight) / 2);
      } else if (videoAspect < targetAspect) {
        sWidth = Math.round(video.videoHeight / targetAspect);
        sx = Math.round((video.videoWidth - sWidth) / 2);
      }
    }

    pctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, TARGET_WIDTH, targetHeight);
    const raw = pctx.getImageData(0, 0, TARGET_WIDTH, targetHeight);
    const quantized = quantizeFrame(raw, thresholdRef.current);

    const viewportWidth = typeof window !== "undefined"
      ? Math.round(window.visualViewport?.width || window.innerWidth)
      : TARGET_WIDTH * displayScale;
    const viewportHeight = typeof window !== "undefined"
      ? Math.round(window.visualViewport?.height || window.innerHeight)
      : targetHeight * displayScale;
    displayCanvas.width = viewportWidth;
    displayCanvas.height = viewportHeight;
    dctx.imageSmoothingEnabled = false;
    dctx.fillStyle = "#000000";
    dctx.fillRect(0, 0, displayCanvas.width, displayCanvas.height);

    const scaleX = viewportWidth / quantized.width;
    const scaleY = viewportHeight / quantized.height;
    const pixelScale = aspectMode === "full" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
    const drawWidth = quantized.width * pixelScale;
    const drawHeight = quantized.height * pixelScale;
    const offsetX = (viewportWidth - drawWidth) / 2;
    const offsetY = (viewportHeight - drawHeight) / 2;

    dctx.fillStyle = LCD_GREEN;
    dctx.fillRect(offsetX, offsetY, drawWidth, drawHeight);

    for (let y = 0; y < quantized.height; y += 1) {
      for (let x = 0; x < quantized.width; x += 1) {
        const idx = y * quantized.width + x;
        if (!quantized.binary[idx]) continue;
        dctx.fillStyle = LCD_BLACK;
        dctx.fillRect(offsetX + x * pixelScale, offsetY + y * pixelScale, pixelScale, pixelScale);
      }
    }

    dctx.save();
    for (let y = 0; y < LOGO_BITMAP.length; y += 1) {
      const row = LOGO_BITMAP[y];
      for (let x = 0; x < row.length; x += 1) {
        if (row[x] !== "1") continue;
        const px = LOGO_OFFSET_X + x;
        const py = LOGO_OFFSET_Y + y;
        if (px < 0 || py < 0 || px >= quantized.width || py >= quantized.height) continue;
        const drawX = offsetX + px * pixelScale;
        const drawY = offsetY + py * pixelScale;
        const idx = py * quantized.width + px;
        dctx.fillStyle = quantized.binary[idx] ? LCD_GREEN : LCD_BLACK;
        dctx.fillRect(drawX, drawY, pixelScale, pixelScale);
      }
    }
    dctx.restore();

    dctx.save();
    dctx.translate(offsetX, offsetY);
    drawPixelGrid(dctx, quantized.width, quantized.height, pixelScale);
    dctx.restore();

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
      const wholeSeconds = Math.floor(elapsed / 1000);
      if (wholeSeconds > 1 && wholeSeconds !== lastSecondHapticRef.current) {
        lastSecondHapticRef.current = wholeSeconds;
        triggerHaptic("light");
      }
      if (elapsed >= MAX_RECORD_MS) {
        void stopRecordingRef.current();
        return;
      }
    }

    rafRef.current = window.requestAnimationFrame(loop);
  }, [renderProcessedFrame]);

  const startCamera = useCallback(async () => {
    if (cameraStartPromiseRef.current) {
      return cameraStartPromiseRef.current;
    }

    const startPromise = (async () => {
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
        const message = err instanceof Error ? err.message : "Camera unavailable";
        if (!message.includes("interrupted by a new load request")) {
          setError(message);
        }
      } finally {
        cameraStartPromiseRef.current = null;
      }
    })();

    cameraStartPromiseRef.current = startPromise;
    return startPromise;
  }, [facingMode, loop, stopStream]);

  useEffect(() => {
    void startCamera();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stopStream();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [startCamera, stopStream]);

  useEffect(() => {
    const resumePreview = () => {
      if (document.visibilityState !== "visible") return;
      if (modeRef.current !== "live" && modeRef.current !== "recording") return;
      void startCamera();
    };

    document.addEventListener("visibilitychange", resumePreview);
    window.addEventListener("focus", resumePreview);
    window.addEventListener("pageshow", resumePreview);

    return () => {
      document.removeEventListener("visibilitychange", resumePreview);
      window.removeEventListener("focus", resumePreview);
      window.removeEventListener("pageshow", resumePreview);
    };
  }, [startCamera]);

  useEffect(() => {
    if (!streamRef.current) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = window.requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [loop, displayScale]);

  const startRecording = useCallback(() => {
    if (modeRef.current === "processing" || modeRef.current === "recording") return;
    isPressingRef.current = true;
    framesRef.current = [];
    recordStartRef.current = performance.now();
    lastCaptureAtRef.current = 0;
    lastSecondHapticRef.current = 0;
    setRecordMs(0);
    triggerHaptic("medium");
    setMode("recording");
    modeRef.current = "recording";
  }, []);

  const stopRecording = useCallback(async () => {
    if (modeRef.current !== "recording") return;
    triggerHaptic("medium");
    renderStartRef.current = performance.now();
    setRenderElapsedMs(0);
    setRenderFrameProgress({ current: 0, total: framesRef.current.length, phase: "starting" });
    setMode("processing");
    modeRef.current = "processing";
    try {
      if (!framesRef.current.length) {
        renderProcessedFrame(true, performance.now());
      }
      const blob = await encodeGif(
        framesRef.current,
        RECORD_FPS,
        playbackMode === "boomerang",
        (current, total, phase) => {
          setRenderFrameProgress({ current, total, phase: phase || "working" });
        },
      );
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setGifBlob(blob);
      setGifUrl(url);
      setRenderElapsedMs(0);
      setRenderFrameProgress({ current: 0, total: 0, phase: "idle" });
      setMode("review");
      modeRef.current = "review";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to render GIF");
      setRenderElapsedMs(0);
      setRenderFrameProgress({ current: 0, total: 0, phase: "idle" });
      setMode("live");
      modeRef.current = "live";
      }
  }, [renderProcessedFrame]);

  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  useEffect(() => {
    const endPress = () => {
      if (!isPressingRef.current) return;
      isPressingRef.current = false;
      if (modeRef.current === "recording") {
        void stopRecordingRef.current();
      }
    };

    window.addEventListener("pointerup", endPress);
    window.addEventListener("touchend", endPress);
    window.addEventListener("mouseup", endPress);

    return () => {
      window.removeEventListener("pointerup", endPress);
      window.removeEventListener("touchend", endPress);
      window.removeEventListener("mouseup", endPress);
    };
  }, []);

  useEffect(() => {
    if (mode !== "processing") return;
    const t = window.setInterval(() => {
      setRenderElapsedMs(performance.now() - renderStartRef.current);
    }, 100);
    return () => window.clearInterval(t);
  }, [mode]);

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
    triggerHaptic("success");
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
        triggerHaptic("success");
      } else {
        saveGif();
      }
    } catch {
      // ignore cancelled share
    }
  }, [gifBlob, saveGif]);

  const toggleCamera = useCallback(() => {
    triggerHaptic("light");
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }, []);

  const cycleAspectMode = useCallback(() => {
    triggerHaptic("light");
    setAspectMode((prev) => {
      if (prev === "full") return "square";
      if (prev === "square") return "classic";
      return "full";
    });
  }, []);

  const togglePlaybackMode = useCallback(() => {
    triggerHaptic("light");
    setPlaybackMode((prev) => (prev === "loop" ? "boomerang" : "loop"));
  }, []);

  const aspectLabel = aspectMode === "full" ? "Full" : aspectMode === "square" ? "1:1" : "Classic";
  const aspectIcon = aspectMode === "full" ? "▭" : aspectMode === "square" ? "□" : "▦";
  const recordProgress = Math.max(0, Math.min(1, recordMs / MAX_RECORD_MS));
  const recordCircumference = 2 * Math.PI * 46;
  const recordDashOffset = recordCircumference * (1 - recordProgress);

  return (
    <main className="relative h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#171916] text-[#96b56f]">
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={processCanvasRef} className="hidden" />

      <div className="relative h-[100dvh] w-screen overflow-hidden">
        {mode === "review" && gifUrl ? (
          <img
            src={gifUrl}
            alt="LoMotion GIF preview"
            className={`absolute inset-0 h-full w-full bg-[#171916] ${aspectMode === "full" ? "object-cover" : "object-contain"}`}
            style={{ imageRendering: "pixelated" }}
          />
        ) : (
          <canvas
            ref={displayCanvasRef}
            className="absolute inset-0 h-full w-full bg-[#171916]"
            style={{ imageRendering: "pixelated" }}
          />
        )}
      </div>

      {mode === "review" ? (
        <div className="absolute inset-x-0 bottom-0 z-30 flex items-end justify-center gap-4 bg-gradient-to-t from-[#171916] via-[#171916]/90 to-transparent px-4 pb-8 pt-16">
          <button
            onClick={saveGif}
            className="grid h-16 w-16 place-items-center rounded-full border border-[#96b56f] bg-[#171916] text-[#96b56f] shadow-[0_0_0_1px_rgba(150,181,111,0.1)] transition active:scale-95"
            aria-label="Save GIF"
            title="Save"
          >
            <SaveIcon />
          </button>
          <button
            onClick={shareGif}
            className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full border border-[#96b56f] bg-[#96b56f] text-[#171916] shadow-[0_0_0_1px_rgba(150,181,111,0.15)] transition active:scale-95"
            aria-label="Share GIF"
            title="Share"
          >
            <div className="scale-110">
              <ShareIcon />
            </div>
          </button>
          <button
            onClick={retake}
            className="grid h-16 w-16 place-items-center rounded-full border border-[#96b56f] bg-[#171916] text-[#96b56f] shadow-[0_0_0_1px_rgba(150,181,111,0.1)] transition active:scale-95"
            aria-label="Retake"
            title="Retake"
          >
            <RetakeIcon />
          </button>
        </div>
      ) : (
        <div className="absolute inset-x-0 bottom-0 z-30 px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-16">
          <div className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-[28px] border border-[#96b56f]/20 bg-[#171916]/70 p-4 backdrop-blur-sm">
            <label className="flex flex-col gap-2">
              <input
                type="range"
                min={0}
                max={255}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="accent-[#96b56f]"
                aria-label="Threshold"
              />
            </label>

            <div className="relative flex items-center justify-center">
              <button
                onClick={toggleCamera}
                className="absolute left-0 grid h-12 w-12 place-items-center rounded-full border border-[#96b56f] bg-[#171916] text-[#96b56f]"
                aria-label="Flip camera"
                title={facingMode === "environment" ? "Rear camera" : "Front camera"}
              >
                <FlipCameraIcon />
              </button>

              <button
                onClick={togglePlaybackMode}
                className="absolute left-14 grid h-12 w-12 place-items-center rounded-full border border-[#96b56f] bg-[#171916] text-[#96b56f]"
                aria-label={playbackMode === "boomerang" ? "Boomerang playback" : "Loop playback"}
                title={playbackMode === "boomerang" ? "Boomerang" : "Loop"}
              >
                <PlaybackModeIcon mode={playbackMode} />
              </button>

              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  startRecording();
                }}
                className="relative grid h-24 w-24 place-items-center rounded-full bg-[#171916] touch-none select-none"
                style={{ touchAction: "none", WebkitUserSelect: "none", userSelect: "none" }}
                aria-label="Hold to record"
              >
                <svg
                  className="absolute inset-0 -rotate-90"
                  viewBox="0 0 100 100"
                  aria-hidden="true"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    fill="none"
                    stroke="#96b56f"
                    strokeOpacity="0.25"
                    strokeWidth="4"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    fill="none"
                    stroke="#96b56f"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={recordCircumference}
                    strokeDashoffset={recordDashOffset}
                    style={{ transform: "rotate(180deg)", transformOrigin: "50% 50%" }}
                  />
                </svg>
                <span className={`relative z-10 h-10 w-10 rounded-full border-2 border-[#96b56f] ${mode === "recording" ? "bg-[#96b56f]" : "bg-[#171916]"}`} />
              </button>

              <button
                onClick={cycleAspectMode}
                className="absolute right-0 grid h-12 w-12 place-items-center rounded-full border border-[#96b56f] bg-[#171916] text-[#96b56f]"
                aria-label={`Aspect ratio: ${aspectLabel}`}
                title={aspectLabel}
              >
                <AspectIcon mode={aspectMode} />
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === "processing" ? (
        <div className="absolute inset-0 z-40 grid place-items-center bg-[#171916]/90">
          <div className="font-mono text-sm uppercase tracking-[0.2em] text-[#96b56f]">{`Rendering GIF… ${(renderElapsedMs / 1000).toFixed(1)}s`}</div>
          <div className="mt-2 font-mono text-xs uppercase tracking-[0.16em] text-[#96b56f]/80">
            {renderFrameProgress.total
              ? `${renderFrameProgress.phase}: ${renderFrameProgress.current}/${renderFrameProgress.total} frames`
              : "Preparing frames"}
          </div>
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
