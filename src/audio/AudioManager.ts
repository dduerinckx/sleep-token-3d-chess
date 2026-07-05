const AMBIENT_URL = "https://cdn.pixabay.com/audio/2022/03/15/audio_3a7d3c8c3b.mp3";
const MOVE_URL = "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3";
const CAPTURE_URL = "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3";
const CHECK_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

export class AudioManager {
  private ambient: HTMLAudioElement;
  private move: HTMLAudioElement;
  private capture: HTMLAudioElement;
  private check: HTMLAudioElement;
  private volume = 0.45;
  private muted = false;

  constructor() {
    this.ambient = this.makeAudio(AMBIENT_URL, true);
    this.move = this.makeAudio(MOVE_URL);
    this.capture = this.makeAudio(CAPTURE_URL);
    this.check = this.makeAudio(CHECK_URL);
    this.applyVolume();
  }

  private makeAudio(src: string, loop = false): HTMLAudioElement {
    const audio = new Audio(src);
    audio.loop = loop;
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    return audio;
  }

  startAmbient(): void {
    if (this.muted) return;
    void this.ambient.play().catch(() => undefined);
  }

  playMove(captured = false): void {
    this.playOne(captured ? this.capture : this.move);
  }

  playCheck(): void {
    this.playOne(this.check);
  }

  private playOne(audio: HTMLAudioElement): void {
    if (this.muted) return;
    const clone = audio.cloneNode() as HTMLAudioElement;
    clone.volume = this.volume;
    void clone.play().catch(() => undefined);
  }

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    this.applyVolume();
  }

  getVolume(): number {
    return this.volume;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.ambient.pause();
    } else {
      void this.ambient.play().catch(() => undefined);
    }
    this.applyVolume();
  }

  isMuted(): boolean {
    return this.muted;
  }

  private applyVolume(): void {
    this.ambient.volume = this.muted ? 0 : this.volume * 0.35;
    this.move.volume = this.volume;
    this.capture.volume = this.volume;
    this.check.volume = this.volume;
  }
}