import * as Comlink from 'comlink';

export class VideoRenderer extends EventTarget {
  private frames: VideoFrame[] = [];
  private videoResize = false;
  private initialTimestamp?: number;
  
  lastRenderedTime: number = 0;

  canvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;
  videoDecoder: VideoDecoder;
  animationId: number | null = null;

  private codec?: string;
  private resetDecoder = false;

  async render(time: number) {
    if (!this.frames[0]) return;

    if (!this.initialTimestamp)
      this.initialTimestamp = this.frames[0].timestamp;
    // console.log(this.frames)

    while ((this.frames[0].timestamp - this.initialTimestamp) / 180000 < time) {
      const frame = this.frames.shift();
      if (!frame) return;

      if (!this.videoResize) {
        this.canvas.width = frame.displayWidth;
        this.canvas.height = frame.displayHeight;
        this.videoResize = true;
      }
  
      this.ctx.drawImage(frame, 0, 0);
      frame.close();

      if (!this.frames[0]) return;
    }
  }

  createDecoder() {
    return new VideoDecoder({
      output: (frame) => {
        this.frames.push(frame);
      },
      error: (e) => {
        this.resetDecoder = true;
        console.error(e);
        this.videoDecoder.close();
        this.videoDecoder = this.createDecoder();
        if (this.codec)
          this.videoDecoder.configure({ codec: this.codec });
      },
    });
  }

  constructor(canvas: OffscreenCanvas) {
    super();

    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot retrieve canvas context!');
    this.ctx = ctx;

    this.videoDecoder = this.createDecoder();
  }

  configure(codec: string) {
    this.codec = codec;
    this.videoDecoder.configure({ codec });
  }

  async flush() {
    return this.videoDecoder.flush();
  }

  decode(chunk: EncodedVideoChunk) {
    if (this.resetDecoder && chunk.type === 'delta') return;
    if (this.videoDecoder.state !== 'configured') return;
    if (this.resetDecoder) this.resetDecoder = false;
    return this.videoDecoder.decode(chunk);
  }
}

Comlink.expose(VideoRenderer);