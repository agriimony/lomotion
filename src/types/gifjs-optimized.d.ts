declare module 'gif.js.optimized' {
  type GIFOptions = {
    workers?: number;
    quality?: number;
    width?: number;
    height?: number;
    workerScript?: string;
    repeat?: number;
  };

  type AddFrameOptions = {
    delay?: number;
    copy?: boolean;
  };

  export default class GIF {
    constructor(options?: GIFOptions);
    addFrame(image: CanvasImageSource, options?: AddFrameOptions): void;
    on(event: 'finished', cb: (blob: Blob) => void): void;
    on(event: 'abort', cb: () => void): void;
    render(): void;
  }
}
