type BrowserSpeechRecognitionAlternative = {
  transcript?: string;
};

export type BrowserSpeechRecognitionResult = {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): BrowserSpeechRecognitionAlternative;
  [index: number]: BrowserSpeechRecognitionAlternative | undefined;
};

export type BrowserSpeechRecognitionResultList = {
  readonly length: number;
  item(index: number): BrowserSpeechRecognitionResult;
  [index: number]: BrowserSpeechRecognitionResult | undefined;
};

export type BrowserSpeechRecognitionEvent = Event & {
  readonly resultIndex: number;
  readonly results: BrowserSpeechRecognitionResultList;
};

export type BrowserSpeechRecognitionErrorEvent = Event & {
  readonly error?: string;
};

export type BrowserSpeechRecognition = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type BrowserSpeechRecognitionWindow = Window & {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
};

export function getBrowserSpeechRecognitionCtor(): BrowserSpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as BrowserSpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function isBrowserSpeechRecognitionSupported(): boolean {
  return Boolean(getBrowserSpeechRecognitionCtor());
}

export function readBrowserSpeechRecognitionTranscript(result: BrowserSpeechRecognitionResult | undefined): string {
  return result?.[0]?.transcript ?? result?.item(0)?.transcript ?? "";
}
