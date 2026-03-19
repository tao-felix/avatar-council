// Web Speech API wrapper for STT + MediaRecorder for audio capture

type SpeechCallback = (text: string, isFinal: boolean) => void;

/* eslint-disable @typescript-eslint/no-explicit-any */
export function startSpeechRecognition(onResult: SpeechCallback, onEnd: () => void) {
  const w = window as any;
  const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Your browser does not support speech recognition. Please use Chrome.");
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "zh-CN";

  recognition.onresult = (event: any) => {
    const last = event.results[event.results.length - 1];
    const text = last[0].transcript;
    onResult(text, last.isFinal);
  };

  recognition.onend = onEnd;
  recognition.start();
  return recognition;
}

// Split text into sentences for incremental TTS
export function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？.!?])\s*/)
    .filter((s) => s.trim().length > 0);
}

// MediaRecorder wrapper for capturing human audio
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start() {
    this.chunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: "audio/webm;codecs=opus" });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start();
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
        resolve(new Blob(this.chunks, { type: "audio/webm" }));
        return;
      }
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: "audio/webm" });
        this.stream?.getTracks().forEach((t) => t.stop());
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }
}
