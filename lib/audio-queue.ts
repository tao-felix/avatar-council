// Audio queue for sequential TTS playback

export class AudioQueue {
  private queue: string[] = [];
  private playing = false;
  private audio: HTMLAudioElement | null = null;

  enqueue(url: string) {
    this.queue.push(url);
    if (!this.playing) this.playNext();
  }

  private playNext() {
    if (this.queue.length === 0) {
      this.playing = false;
      return;
    }
    this.playing = true;
    const url = this.queue.shift()!;
    this.audio = new Audio(url);
    this.audio.onended = () => this.playNext();
    this.audio.onerror = () => this.playNext();
    this.audio.play().catch(() => this.playNext());
  }

  stop() {
    this.queue = [];
    this.playing = false;
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
  }
}
