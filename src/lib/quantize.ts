import { LCD_BLACK, LCD_GREEN } from "@/lib/palette";

export type QuantizedFrame = {
  binary: Uint8Array;
  width: number;
  height: number;
};

export function getLuminance(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function quantizeFrame(imageData: ImageData, threshold: number): QuantizedFrame {
  const { data, width, height } = imageData;
  const binary = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i += 1) {
    const idx = i * 4;
    const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
    binary[i] = lum >= threshold ? 0 : 1;
  }

  return { binary, width, height };
}

export function binaryToImageData(binary: Uint8Array, width: number, height: number) {
  const imageData = new ImageData(width, height);
  const lit = hexToRgb(LCD_GREEN);
  const dark = hexToRgb(LCD_BLACK);

  for (let i = 0; i < width * height; i += 1) {
    const idx = i * 4;
    const color = binary[i] ? dark : lit;
    imageData.data[idx] = color.r;
    imageData.data[idx + 1] = color.g;
    imageData.data[idx + 2] = color.b;
    imageData.data[idx + 3] = 255;
  }

  return imageData;
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
