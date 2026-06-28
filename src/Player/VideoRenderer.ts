import * as Comlink from 'comlink';

export class VideoRenderer extends EventTarget {
  private frames: VideoFrame[] = [];
  private videoResize = false;
  private frameCount = 0;
  
  lastRenderedTime: number = 0;

  canvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;
  videoDecoder: VideoDecoder;
  animationId: number | null = null;

  async render(time: number) {
    if (!this.frames.length) return;

    while (time * 24000/1001 > this.frameCount) {
      const frame = this.frames.shift();
      if (!frame) break;

      if (!this.videoResize) {
        this.canvas.width = frame.codedWidth;
        this.canvas.height = frame.codedHeight;
        this.videoResize = true;
      }
      this.ctx.drawImage(frame, 0, 0);

      frame.close();
      this.frameCount++;
    }
  }

  constructor(canvas: OffscreenCanvas) {
    super();

    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot retrieve canvas context!');
    this.ctx = ctx;

    this.videoDecoder = new VideoDecoder({
      output: (frame) => {
        this.frames.push(frame);
      },
      error(e) {
        console.error(e);
      },
    });
  }

  configure(codec: string) {
    this.videoDecoder.configure({ codec });
  }

  async flush() {
    return this.videoDecoder.flush();
  }

  async decode(chunk: EncodedVideoChunk) {
    return this.videoDecoder.decode(chunk);
  }
}

Comlink.expose(VideoRenderer);