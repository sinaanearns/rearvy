const PREFERRED_VOICE_PATTERNS = [
  "microsoft aria online",
  "microsoft jenny online",
  "microsoft ava online",
  "microsoft emma",
  "microsoft zira",
  "google us english",
  "google uk english female",
  "samantha",
  "zira",
];

function getSpeechSynthesis() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.speechSynthesis || null;
}

function getVoiceScore(voice: SpeechSynthesisVoice, index: number) {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  const preferredIndex = PREFERRED_VOICE_PATTERNS.findIndex((pattern) => name.includes(pattern));

  if (preferredIndex !== -1) {
    return 1000 - preferredIndex;
  }

  if (lang === "en-us") {
    return 600 - index;
  }

  if (lang.startsWith("en-")) {
    return 500 - index;
  }

  return 0;
}

export function warmClickyVoices() {
  const synthesis = getSpeechSynthesis();
  if (!synthesis) {
    return;
  }

  synthesis.getVoices();
}

export function selectClickyVoice() {
  const synthesis = getSpeechSynthesis();
  if (!synthesis) {
    return null;
  }

  const voices = synthesis.getVoices();
  if (!voices.length) {
    return null;
  }

  return voices
    .map((voice, index) => ({ voice, score: getVoiceScore(voice, index) }))
    .sort((left, right) => right.score - left.score)[0]?.voice ?? null;
}

export function configureClickyUtterance(utterance: SpeechSynthesisUtterance) {
  const voice = selectClickyVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang || "en-US";
  } else {
    utterance.lang = "en-US";
  }

  utterance.rate = 0.96;
  utterance.pitch = 1.06;
  utterance.volume = 1;
}
