#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  module._compile(compiled.outputText, filename);
};

const { playCinematicSound } = require("../lib/scene-audio.ts");
const { CINEMATIC } = require("../lib/scene-cinematic.ts");

class Param {
  constructor(value = 0) { this.value = value; this.events = []; }
  setValueAtTime(value, time) {
    assert(Number.isFinite(value) && Number.isFinite(time));
    this.events.push(["set", value, time]);
    this.value = value;
  }
  exponentialRampToValueAtTime(value, time) { assert(value > 0); this.events.push(["exponential", value, time]); }
  linearRampToValueAtTime(value, time) { this.events.push(["linear", value, time]); }
  cancelScheduledValues(time) { this.events.push(["cancel", time]); }
}

class Node {
  constructor(context, kind) {
    this.context = context;
    this.kind = kind;
    this.connections = [];
    this.disconnected = false;
    ["gain", "frequency", "Q", "pan", "delayTime", "threshold", "knee", "ratio", "attack", "release"].forEach(key => { this[key] = new Param(); });
    context.nodes.push(this);
  }
  connect(target) { this.connections.push(target); return target; }
  disconnect() { this.connections = []; this.disconnected = true; }
}

class Source extends Node {
  constructor(context, kind) { super(context, kind); context.sources.push(this); this.stops = []; }
  start(time) { assert.equal(this.started, undefined); this.started = time; }
  stop(time) { this.stops.push(time); }
}

class Context {
  constructor(state = "running") {
    this.state = state;
    this.currentTime = 10;
    this.sampleRate = 48000;
    this.nodes = [];
    this.sources = [];
    this.buffers = 0;
    this.destination = {};
  }
  createGain() { return new Node(this, "gain"); }
  createBiquadFilter() { return new Node(this, "filter"); }
  createDynamicsCompressor() { return new Node(this, "compressor"); }
  createStereoPanner() { return new Node(this, "panner"); }
  createDelay() { return new Node(this, "delay"); }
  createOscillator() { return new Source(this, "oscillator"); }
  createBufferSource() { return new Source(this, "bufferSource"); }
  createBuffer(_channels, length) {
    this.buffers++;
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
}

const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;
const timers = new Map();
let nextTimer = 0;
global.setTimeout = (callback, delay) => {
  const id = ++nextTimer;
  timers.set(id, { callback, delay });
  return id;
};
global.clearTimeout = id => timers.delete(id);
const flush = () => {
  const pending = [...timers.values()];
  timers.clear();
  pending.forEach(timer => timer.callback());
};

try {
  for (const destination of ["projects", "about", "contact", "skills"]) {
    const context = new Context();
    const cancel = playCinematicSound(context, destination);
    const startedAt = Math.min(...context.sources.map(source => source.started));
    assert(context.sources.length >= 25, `${destination}: layered score`);
    assert(context.sources.some(source => Math.abs(source.started - startedAt - CINEMATIC.charge) < .00001), `${destination}: release on charge beat`);
    assert(context.sources.some(source => Math.abs(source.started - startedAt - CINEMATIC.reveal) < .00001), `${destination}: arrival on reveal beat`);
    assert.equal(context.buffers, 1, `${destination}: noise buffer reused`);
    cancel();
    assert(context.sources.every(source => source.stops.at(-1) <= context.currentTime + .051), `${destination}: every future source stopped promptly`);
    const scheduled = timers.size;
    cancel();
    assert.equal(timers.size, scheduled, `${destination}: cancellation idempotent`);
    context.currentTime += .09;
    flush();
    assert(context.nodes.every(node => node.disconnected), `${destination}: all audio nodes disconnected`);
    assert.equal(timers.size, 0);
  }

  const natural = new Context();
  playCinematicSound(natural, "projects");
  natural.sources.forEach(source => source.onended?.());
  flush();
  assert(natural.nodes.every(node => node.disconnected), "natural finish disconnects graph");

  const reduced = new Context();
  const stopReduced = playCinematicSound(reduced, "skills", true);
  assert.equal(reduced.sources.length, 2, "single reduced-motion bell with one partial");
  assert.equal(reduced.buffers, 0, "reduced cue skips noise");
  assert(reduced.sources.every(source => source.started < reduced.currentTime + .02 && source.stops[0] < reduced.currentTime + .45));
  stopReduced();
  flush();

  const suspended = new Context("suspended");
  playCinematicSound(suspended, "contact");
  flush();
  assert(suspended.nodes.every(node => node.disconnected), "watchdog cleans up suspended context");

  const closed = new Context("closed");
  playCinematicSound(closed, "about")();
  assert.equal(closed.nodes.length, 0, "closed context is a no-op");
  assert.equal(timers.size, 0);
  process.stdout.write("PASS: four beat schedules, prompt/idempotent cancellation, natural cleanup, reduced motion, suspended watchdog, closed context.\n");
} finally {
  global.setTimeout = originalSetTimeout;
  global.clearTimeout = originalClearTimeout;
}
