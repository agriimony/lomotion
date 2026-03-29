import GIF from "gif.js.optimized";
import { LCD_BLACK, LCD_GREEN } from "@/lib/palette";
import { binaryToImageData } from "@/lib/quantize";
import { drawPixelGrid } from "@/lib/grid";

export type CapturedFrame = {
  binary: Uint8Array;
  width: number;
  height: number;
};

export async function encodeGif(frames: CapturedFrame[], fps: number) {
  if (!frames.length) throw new Error("No frames to encode");

  const { width, height } = frames[0];
  const gif = new GIF({
    workers: 2,
    quality: 1,
    width,
    height,
    workerScript: "/gif.worker.js",
    repeat: 0,
  });

  for (const frame of frames) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");

    const imageData = binaryToImageData(frame.binary, width, height);
    ctx.putImageData(imageData, 0, 0);
    drawPixelGrid(ctx, width, height, 1);
    gif.addFrame(canvas, { delay: Math.round(1000 / fps) });
  }

  return new Promise<Blob>((resolve, reject) => {
    gif.on("finished", (blob: Blob) => resolve(blob));
    gif.on("abort", () => reject(new Error("GIF encoding aborted")));
    gif.render();
  });
}

