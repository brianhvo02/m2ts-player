export default class AudioRenderer {
  private audioContext: AudioContext;
  private sourceNode: AudioBufferSourceNode;

  private startTime: number | null = null;

  private bufferMap: Record<number, AudioBuffer> = {};

  constructor() {
    this.audioContext = new AudioContext();
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.connect(this.audioContext.destination);
  }

  createBuffer(pid: number, sampleRate: number, numOfChannels: number) {
    const secondsSize = 10 * 60 * sampleRate * numOfChannels;
    const buffer = this.audioContext.createBuffer(
      numOfChannels, secondsSize, sampleRate
    );
    
    if (!Object.keys(this.bufferMap).length)
      this.sourceNode.buffer = buffer;

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
    this.sourceNode.start();
    this.startTime = this.audioContext.currentTime;
  }

  pause() {
    this.sourceNode.stop();
  }

  getCurrentTime() {
    if (!this.startTime) return 0;
    return this.audioContext.currentTime - this.startTime;
  }
}