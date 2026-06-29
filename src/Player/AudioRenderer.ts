export default class AudioRenderer {
  private audioContext: AudioContext;
  private sourceNode: AudioBufferSourceNode;

  private startTime: number | null = null;
  private pauseTime: number | null = null;

  private currentPid = 0x0000;
  private bufferMap: Record<number, AudioBuffer> = {};

  isPlaying = false;

  constructor() {
    this.audioContext = new AudioContext();
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.connect(this.audioContext.destination);
  }

  createBuffer(pid: number, sampleRate: number, numOfChannels: number, seconds: number) {
    const length = seconds * sampleRate * numOfChannels;
    const buffer = this.audioContext.createBuffer(
      numOfChannels, length, sampleRate
    );
    
    if (!Object.keys(this.bufferMap).length) {
      this.sourceNode.buffer = buffer;
      this.currentPid = pid;
    }

    this.bufferMap[pid] = buffer;

    return true;
  }

  addToBuffer(
    pid: number, channels: Float32Array<ArrayBuffer>[], audioOffset: number
  ) {
    channels.forEach((channel, i) => {
      this.bufferMap[pid].copyToChannel(channel, i, audioOffset);
    });
  }

  play() {
    if (this.isPlaying)
      return;
    this.isPlaying = true;
    if (this.startTime && this.pauseTime) {
      const elapsedTime = this.pauseTime - this.startTime;
      this.sourceNode = this.audioContext.createBufferSource();
      this.sourceNode.connect(this.audioContext.destination);
      this.sourceNode.buffer = this.bufferMap[this.currentPid];
      this.sourceNode.start(0, elapsedTime);
      this.startTime = this.audioContext.currentTime - elapsedTime;
      this.pauseTime = null;
    } else {
      this.sourceNode.start();
      this.startTime = this.audioContext.currentTime;
    }
  }

  pause() {
    if (!this.isPlaying)
      return;
    this.isPlaying = false;
    this.pauseTime = this.audioContext.currentTime;
    this.sourceNode.stop();
  }

  getCurrentTime() {
    if (!this.startTime) return 0;
    return this.audioContext.currentTime - this.startTime;
  }

  changeAudioTrack(pid: number) {
    this.currentPid = pid;
    this.sourceNode.stop();
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.connect(this.audioContext.destination);
    this.sourceNode.buffer = this.bufferMap[pid];
    this.sourceNode.start(0, this.getCurrentTime());
  }
}