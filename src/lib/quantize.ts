import { LCD_BLACK, LCD_GREEN } from "@/lib/palette";

export type QuantizedFrame = {
  levels: Uint8Array;
  luma: Float32Array;
  width: number;
  height: number;
};

export function getLuminance(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function quantizeFrame(
  imageData: ImageData,
  threshold: number,
  previousLuma?: Float32Array | null,
  persistence = 0,
  levelsCount = 2,
): QuantizedFrame {
  const { data, width, height } = imageData;
  const levels = new Uint8Array(width * height);
  const luma = new Float32Array(width * height);

  for (let i = 0; i < width * height; i += 1) {
    const idx = i * 4;
    const current = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
    const blended = previousLuma ? (current * (1 - persistence) + previousLuma[i] * persistence) : current;
    luma[i] = blended;

    if (levelsCount <= 2) {
      levels[i] = blended >= threshold ? 1 : 0;
      continue;
    }

    const normalized = Math.max(0, Math.min(1, blended / 255));
    levels[i] = Math.max(0, Math.min(levelsCount - 1, Math.round(normalized * (levelsCount - 1))));
  }

  return { levels, luma, width, height };
}

export function levelsToImageData(levels: Uint8Array, width: number, height: number, palette: string[]) {
  const imageData = new ImageData(width, height);
  const colors = palette.map(hexToRgb);

  for (let i = 0; i < width * height; i += 1) {
    const idx = i * 4;
    const color = colors[levels[i]] || colors[0];
    imageData.data[idx] = color.r;
    imageData.data[idx + 1] = color.g;
    imageData.data[idx + 2] = color.b;
    imageData.data[idx + 3] = 255;
  }

  return imageData;
}

export function getLcdPalette(levelsCount: number) {
  if (levelsCount <= 2) return [LCD_BLACK, LCD_GREEN];
  return [LCD_BLACK, "#3f5333", "#6f8a52", LCD_GREEN];
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}
