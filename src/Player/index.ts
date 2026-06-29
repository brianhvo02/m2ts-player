import * as Comlink from 'comlink';
import type { Demuxer } from './Demuxer.worker';
import type { VideoRenderer } from './VideoRenderer.worker';
import AudioRenderer from './AudioRenderer';
import type { Clock } from './Clock.worker';
import DemuxerWorker from './Demuxer.worker?worker';
import VideoRendererWorker from './VideoRenderer.worker?worker';
import ClockWorker from './Clock.worker?worker';

const DemuxerLink = Comlink.wrap<typeof Demuxer>(new DemuxerWorker());
const VideoRendererLink = Comlink.wrap<typeof VideoRenderer>(new VideoRendererWorker());
const ClockLink = Comlink.wrap<typeof Clock>(new ClockWorker());

export default class Player {
  demuxer: Comlink.Remote<Demuxer>;
  videoRenderer: Comlink.Remote<VideoRenderer>;
  audioRenderer: AudioRenderer;
  clock: Comlink.Remote<Clock>;

  static async init() {
    const file = await new Promise<File | null>(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.addEventListener('change', () => resolve(input.files?.[0] ?? null));
      input.addEventListener('cancel', () => resolve(null));
      input.click();
    });

    if (!file) return null;

    console.log('Selected file:', file.name);

    const canvasEl = document.getElementById('video') as HTMLCanvasElement;
    const canvas = canvasEl.transferControlToOffscreen();

    const demuxer = await new DemuxerLink(file);
    const videoRenderer = await new VideoRendererLink(Comlink.transfer(canvas, [canvas]));
    const audioRenderer = new AudioRenderer();
    const clock = await new ClockLink(
      Comlink.proxy(() => audioRenderer.play()),
      Comlink.proxy(() => audioRenderer.pause()),
      Comlink.proxy(() => audioRenderer.getCurrentTime()),
      Comlink.proxy((time: number) => videoRenderer.render(time)),
    );

    demuxer.demux(
      Comlink.proxy((codec: string) => videoRenderer.configure(codec)),
      Comlink.proxy(() => videoRenderer.flush()),
      Comlink.proxy((chunk: EncodedVideoChunk) => videoRenderer.decode(chunk)),
      Comlink.proxy((
        pid: number, sampleRate: number, numOfChannels: number, seconds: number
      ) => audioRenderer.createBuffer(pid, sampleRate, numOfChannels, seconds)),
      Comlink.proxy((
        pid: number, channels: Float32Array<ArrayBuffer>[], audioOffset: number
      ) => audioRenderer.addToBuffer(pid, channels, audioOffset)),
      Comlink.proxy(() => clock.play()),
    );

    return new this(demuxer, videoRenderer, audioRenderer, clock);
  }

  constructor(
    demuxer: Comlink.Remote<Demuxer>, 
    videoRenderer: Comlink.Remote<VideoRenderer>,
    audioRenderer: AudioRenderer,
    clock: Comlink.Remote<Clock>,
  ) {
    this.demuxer = demuxer;
    this.videoRenderer = videoRenderer;
    this.audioRenderer = audioRenderer;
    this.clock = clock;
  }

  play() {
    this.clock.play();
  }
  
  pause() {
    this.clock.pause();
  }
}