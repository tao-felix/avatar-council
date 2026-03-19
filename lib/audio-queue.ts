// Audio queue for sequential TTS playback
// Supports streaming mode with ordered playback:
// Items are enqueued by index, played in order regardless of arrival order.

export class AudioQueue {
  private pending: Map<number, string> = new Map(); // index → url (arrived but not yet playable)
  private nextPlayIndex = 0; // the next index we need to play
  private playing = false;
  private started = false;
  private sealed = false;
  private audio: HTMLAudioElement | null = null;
  onFinish: (() => void) | null = null;
  onPlay: ((index: number) => void) | null = null;

  enqueue(url: string, index: number) {
    this.pending.set(index, url);
    if (this.started && !this.playing) this.playNext();
  }

  startPlayback() {
    this.started = true;
    if (!this.playing) this.playNext();
  }

  seal() {
    this.sealed = true;
    if (this.started && !this.playing && !this.pending.has(this.nextPlayIndex)) {
      this.finish();
    }
  }

  private playNext() {
    const url = this.pending.get(this.nextPlayIndex);
    if (!url) {
      this.playing = false;
      if (this.sealed) this.finish();
      return;
    }
    this.pending.delete(this.nextPlayIndex);
    this.playing = true;
    this.onPlay?.(this.nextPlayIndex);
    this.nextPlayIndex++;
    this.audio = new Audio(url);
    this.audio.onended = () => this.playNext();
    this.audio.onerror = () => this.playNext();
    this.audio.play().catch(() => this.playNext());
  }

  private finish() {
    this.started = false;
    this.sealed = false;
    this.nextPlayIndex = 0;
    this.pending.clear();
    this.onFinish?.();
  }

  isPlaying() {
    return this.playing;
  }

  hasItems() {
    return this.pending.size > 0;
  }

  stop() {
    this.pending.clear();
    this.playing = false;
    this.started = false;
    this.sealed = false;
    this.nextPlayIndex = 0;
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
  }
}
