/**
 * Rest timer cues: one soft tick with 10 seconds left, two higher ticks at 0:00,
 * then one tick every 30 seconds of over-rest. Only a cue whose moment has just
 * passed plays, so returning to a sleeping phone does not replay missed cues.
 */
export type RestCue = "soon" | "end" | "over";

/** 0 = more than 10 s left, 1 = last 10 s, 2 = 0:00 to +0:30, 3 = +0:30 to +1:00 … */
export function restStage(end: number, now: number) {
  const left = end - now;
  if (left > 10_000) return 0;
  if (left > 0) return 1;
  return 2 + Math.floor(-left / 30_000);
}

function stageStart(end: number, stage: number) {
  return stage === 1 ? end - 10_000 : end + (stage - 2) * 30_000;
}

/** The cue to play on moving from `previous` to the current stage, if its moment is fresh. */
export function restCue(end: number, now: number, previous: number): RestCue | null {
  const stage = restStage(end, now);
  if (stage <= previous || stage === 0) return null;
  if (now - stageStart(end, stage) > 1500) return null;
  return stage === 1 ? "soon" : stage === 2 ? "end" : "over";
}

export const cueKeys: Record<RestCue, string> = {
  soon: "rest-sound-soon",
  end: "rest-sound-end",
  over: "rest-sound-over",
};

const tones: Record<RestCue, [number, number, number][]> = {
  // [start offset s, pitch Hz, gain]
  soon: [[0, 880, 0.12]],
  end: [[0, 1175, 0.22], [0.22, 1568, 0.22]],
  over: [[0, 988, 0.15]],
};

export function playCue(context: AudioContext, cue: RestCue) {
  for (const [at, pitch, gain] of tones[cue]) {
    const tone = context.createOscillator(), volume = context.createGain();
    tone.frequency.value = pitch;
    volume.gain.setValueAtTime(gain, context.currentTime + at);
    volume.gain.exponentialRampToValueAtTime(0.001, context.currentTime + at + 0.18);
    tone.connect(volume).connect(context.destination);
    tone.start(context.currentTime + at);
    tone.stop(context.currentTime + at + 0.2);
  }
}
