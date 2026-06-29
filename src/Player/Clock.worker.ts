import * as Comlink from 'comlink';

export class Clock {
  private isPlaying: boolean = false;
  private animationFrame: number | null = null;

  private lastFrameTime = 0;

  playAudio: Comlink.Local<() => void>;
  pauseAudio: Comlink.Local<() => void>;
  getCurrentTime: Comlink.Local<() => number>;
  render: Comlink.Local<(time: number) => void>;

  constructor(
    playAudio: Comlink.Local<() => void>,
    pauseAudio: Comlink.Local<() => void>,
    getCurrentTime: Comlink.Local<() => number>,
    render: Comlink.Local<(time: number) => void>,
  ) {
    this.playAudio = playAudio;
    this.pauseAudio = pauseAudio;
    this.getCurrentTime = getCurrentTime;
    this.render = render;
  }

  async play() {
    if (this.isPlaying) return;

    this.isPlaying = true;

    // Start audio playback (this starts the timeline)
    await this.playAudio();

    // Start the tick loop
    this.lastFrameTime = performance.now();
    this.tick();
  }

  pause() {
    if (!this.isPlaying) return;

    this.isPlaying = false;

    // Pause audio
    this.pauseAudio();

    // Stop the tick loop
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  // async seek(time: number): Promise<void> {
  //   const clampedTime = Math.max(0, Math.min(time, this.duration));

  //   // Seek both video and audio
  //   this.videoWorker.seek(clampedTime);
  //   await this.audioPlayer.seek(clampedTime);

  //   this.emit('seek', clampedTime);
  // }

  playing() {
    return this.isPlaying;
  }

  private async tick() {
    if (!this.isPlaying) return;

    const now = performance.now();
    const elapsed = now - this.lastFrameTime;

    // Frame rate throttling: only update at TARGET_FPS
    // This prevents unnecessary rendering and saves CPU/battery
    if (elapsed < 24000/1001) {
      this.animationFrame = requestAnimationFrame(() => this.tick());
      return;
    }

    this.lastFrameTime = now;

    // Get current time from audio timeline (source of truth)
    const currentTime = await this.getCurrentTime();

    // Check if we've reached the end
    // if (currentTime >= this.duration - 0.1) {
    //   this.pause();
    //   this.emit('ended');
    //   return;
    // }

    // Emit tick event for UI updates
    // UI should listen to this rather than polling getCurrentTime()
    // this.emit('tick', currentTime);

    // Tell video worker to render at this time (passive)
    // Video worker doesn't track time itself - it just renders whatever we tell it
    await this.render(currentTime);
    // this.audioPlayer.checkForPreLoad();

    // Schedule next tick
    this.animationFrame = requestAnimationFrame(() => this.tick());
  }

}

Comlink.expose(Clock);