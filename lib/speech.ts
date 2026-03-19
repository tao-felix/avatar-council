// Web Speech API wrapper for STT

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
