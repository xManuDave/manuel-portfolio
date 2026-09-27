import { CINEMATIC, type CinematicDestination } from "./scene-cinematic";

const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>();
const ROOTS: Record<CinematicDestination, number> = { projects: 196, about: 174.61, contact: 220, skills: 146.83 };
const FLOOR = .0001;

function velvetNoise(context: AudioContext) {
  const cached = noiseBuffers.get(context);
  if (cached) return cached;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 1.4), context.sampleRate);
  const samples = buffer.getChannelData(0);
  let seed = 8171;
  let previous = 0;
  for (let index = 0; index < samples.length; index += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    previous = previous * .78 + (seed / 4294967296 * 2 - 1) * .22;
    samples[index] = previous * 1.8;
  }
  noiseBuffers.set(context, buffer);
  return buffer;
}

/** Schedule one selection score. Call the returned function on switch, mute or unmount. */
export function playCinematicSound(context: AudioContext, destination: CinematicDestination, reducedMotion = false): () => void {
  if (context.state === "closed") return () => {};

  const nodes = new Set<AudioNode>();
  const sources = new Set<AudioScheduledSourceNode>();
  const now = context.currentTime + .012;
  const root = ROOTS[destination];
  const portal = destination === "skills";
  let finished = false;
  let cancelled = false;
  let scheduling = true;
  let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  const own = <T extends AudioNode>(node: T): T => { nodes.add(node); return node; };

  const input = own(context.createGain());
  const mix = own(context.createGain());
  const warmth = own(context.createBiquadFilter());
  const compressor = own(context.createDynamicsCompressor());
  const output = own(context.createGain());
  warmth.type = "lowpass";
  warmth.frequency.value = portal ? 5800 : 4700;
  warmth.Q.value = .35;
  compressor.threshold.value = -16;
  compressor.knee.value = 16;
  compressor.ratio.value = 4.5;
  compressor.attack.value = .006;
  compressor.release.value = .2;
  output.gain.value = .65;
  input.connect(mix);
  mix.connect(warmth).connect(compressor).connect(output).connect(context.destination);

  // Two quiet, non-feedback reflections give the bells space without an endless tail.
  if (!reducedMotion) {
    [[.145, .16, -.55], [.265, .1, .55]].forEach(([delayTime, level, pan]) => {
      const delay = own(context.createDelay(.5));
      const reflection = own(context.createGain());
      const panner = own(context.createStereoPanner());
      delay.delayTime.value = delayTime;
      reflection.gain.value = level;
      panner.pan.value = pan;
      input.connect(delay).connect(reflection).connect(panner).connect(mix);
    });
  }

  const dispose = () => {
    if (finished) return;
    finished = true;
    if (cleanupTimer !== undefined) clearTimeout(cleanupTimer);
    if (watchdog !== undefined) clearTimeout(watchdog);
    sources.forEach(source => {
      source.onended = null;
      try { source.stop(context.currentTime); } catch { /* Already ended or context closed. */ }
    });
    sources.clear();
    nodes.forEach(node => node.disconnect());
    nodes.clear();
  };

  const schedule = (source: AudioScheduledSourceNode, start: number, end: number) => {
    sources.add(source);
    source.onended = () => {
      source.onended = null;
      source.disconnect();
      sources.delete(source);
      if (!scheduling && sources.size === 0 && !cancelled && !finished) {
        cleanupTimer = setTimeout(dispose, reducedMotion ? 30 : 340);
      }
    };
    source.start(now + start);
    source.stop(now + end);
  };

  const envelope = (gain: AudioParam, start: number, duration: number, level: number, attack: number) => {
    gain.setValueAtTime(FLOOR, now + start);
    gain.exponentialRampToValueAtTime(level, now + start + attack);
    gain.exponentialRampToValueAtTime(FLOOR, now + start + duration);
  };

  const note = (start: number, duration: number, frequency: number, level: number, pan = 0, type: OscillatorType = "sine", endFrequency = frequency, attack = .035) => {
    const oscillator = own(context.createOscillator());
    const voice = own(context.createGain());
    const panner = own(context.createStereoPanner());
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now + start);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + start + duration * .88);
    panner.pan.value = pan;
    envelope(voice.gain, start, duration, level, Math.min(attack, duration * .4));
    oscillator.connect(voice).connect(panner).connect(input);
    schedule(oscillator, start, start + duration + .025);
  };

  const bell = (start: number, frequency: number, level: number, pan: number, duration = .62) => {
    note(start, duration, frequency, level, pan, "sine", frequency * .997, .012);
    note(start, duration * .63, frequency * (portal ? 2.006 : 2.015), level * .23, -pan * .65, "sine", frequency * 2, .009);
  };

  const whoosh = (start: number, duration: number, level: number, rising: boolean, wide: boolean) => {
    const source = own(context.createBufferSource());
    const lowCut = own(context.createBiquadFilter());
    const air = own(context.createBiquadFilter());
    const voice = own(context.createGain());
    const panner = own(context.createStereoPanner());
    source.buffer = velvetNoise(context);
    source.loop = true;
    lowCut.type = "highpass";
    lowCut.frequency.value = 180;
    air.type = "lowpass";
    air.Q.value = .55;
    air.frequency.setValueAtTime(rising ? 280 : 1700, now + start);
    air.frequency.exponentialRampToValueAtTime(rising ? 2100 : 310, now + start + duration);
    panner.pan.setValueAtTime(wide ? -.72 : -.24, now + start);
    panner.pan.linearRampToValueAtTime(wide ? .72 : .24, now + start + duration);
    envelope(voice.gain, start, duration, level, duration * (rising ? .68 : .12));
    source.connect(lowCut).connect(air).connect(voice).connect(panner).connect(input);
    schedule(source, start, start + duration + .025);
  };

  if (reducedMotion) {
    bell(0, root * 2, .085, 0, .38);
  } else {
    // Charge: rounded rising breath and a quiet pitched foundation.
    whoosh(0, CINEMATIC.charge + .08, .11, true, false);
    note(0, CINEMATIC.charge + .13, root * .5, .052, -.12, "triangle", root * .5, .1);
    note(.07, CINEMATIC.charge, root * .5, .046, .12, "sine", root * (portal ? 2 : 1.5), .2);

    // Release: a soft low impact and a left-to-right sweep on the visual lift beat.
    note(CINEMATIC.charge, .44, portal ? 132 : 110, .19, 0, "sine", portal ? 58 : 48, .009);
    whoosh(CINEMATIC.charge, .9, .17, false, true);
    bell(CINEMATIC.charge + .035, root * 2, .075, -.2, .85);

    const intervals = portal ? [0, 7, 10, 14, 19, 24] : [0, 7, 12, 16, 19, 24];
    const spacing = (CINEMATIC.liftEnd - CINEMATIC.charge - .2) / intervals.length;
    intervals.forEach((semitones, index) => {
      bell(CINEMATIC.charge + .17 + index * spacing, root * 2 * 2 ** (semitones / 12), .052 - index * .003, (index / (intervals.length - 1) - .5) * 1.1);
    });

    // A soft sustained fifth connects the lift to the arrival without dead air.
    note(CINEMATIC.charge + .14, CINEMATIC.reveal - CINEMATIC.charge, root, .026, -.3, "sine", root, .32);
    note(CINEMATIC.charge + .19, CINEMATIC.reveal - CINEMATIC.charge, root * 1.5, .018, .3, "triangle", root * 1.5, .35);

    if (portal) {
      whoosh(CINEMATIC.monitorAlign + .2, .82, .105, true, true);
      bell(CINEMATIC.liftEnd + .14, root * 4, .045, .45, .65);
    }

    // Arrival: a broad consonant chord with a small answering glint.
    const chord = portal ? [1, 1.5, 2, 2.25] : [1, 1.25, 1.5, 2];
    chord.forEach((ratio, index) => {
      note(CINEMATIC.reveal + index * .018, .86, root * 2 * ratio, index === 0 ? .065 : .038, (index - 1.5) * .24, "sine", root * 2 * ratio, .075);
    });
    bell(CINEMATIC.reveal + .24, root * (portal ? 6 : 4), .039, .28, .56);
  }

  scheduling = false;
  // A suspended/interrupted context must not retain a score indefinitely or play it much later.
  watchdog = setTimeout(dispose, reducedMotion ? 1300 : (CINEMATIC.tail + 1.2) * 1000);

  return () => {
    if (cancelled || finished) return;
    cancelled = true;
    if (cleanupTimer !== undefined) clearTimeout(cleanupTimer);
    if (watchdog !== undefined) clearTimeout(watchdog);
    const stopTime = context.currentTime;
    if (context.state === "closed") { dispose(); return; }
    output.gain.cancelScheduledValues(stopTime);
    output.gain.setValueAtTime(output.gain.value, stopTime);
    output.gain.linearRampToValueAtTime(0, stopTime + .045);
    sources.forEach(source => {
      source.onended = null;
      // stop() before a scheduled start also cancels future reveal/arpeggio notes.
      try { source.stop(stopTime + .05); } catch { /* Source already ended. */ }
    });
    cleanupTimer = setTimeout(dispose, 90);
  };
}
