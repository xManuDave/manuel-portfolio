"use client";

import { Environment, Lightformer, SoftShadows } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import { type CSSProperties, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { asset } from "@/lib/asset";
import { portfolioContent } from "@/lib/portfolio-content";
import { CINEMATIC, CINEMATIC_COLORS } from "@/lib/scene-cinematic";
import { playCinematicSound } from "@/lib/scene-audio";
import Room, { type FocusName } from "./Room";
import CozyRadio, { type CozyRadioHandle } from "./CozyRadio";
import FocusTimer from "./FocusTimer";
import ProjectViewer from "./ProjectViewer";
import { ProjectTheatreHUD, ProjectTheatreScene } from "./ProjectTheatre";
import { ROI_DEMO, type ProjectId } from "@/lib/project-theatre";
import WholesomeQuote from "./WholesomeQuote";
import { installRenderLookShaderChunks, RenderPostFX, WindowLightShafts } from "./RenderLook";

RectAreaLightUniformsLib.init();
installRenderLookShaderChunks();
// Keep motion on the same wall clock as audio/CSS/panel reveals, even after a slow GPU frame.
gsap.ticker.lagSmoothing(0);

type Shot = { position: [number, number, number]; target: [number, number, number] };

const OBJECT_STAGE_SHOT: Shot = { position: [-.55, 3.25, 8.1], target: [0, 1.7, 2.0] };
const MONITOR_ALIGNMENT_SHOT: Shot = { position: [3.39, 1.7, 3.0], target: [3.39, .94, -2.15] };

const SHOTS: Record<FocusName, Shot> = {
  home: { position: [-0.5, 5.3, 10.0], target: [0.1, 0.85, -1.0] },
  projects: OBJECT_STAGE_SHOT,
  about: OBJECT_STAGE_SHOT,
  contact: OBJECT_STAGE_SHOT,
  skills: { position: [3.39, .94, -1.55], target: [3.39, .94, -2.15] },
};

function RoomEnvironment() {
  return (
    <Environment background={false} frames={1} resolution={256} environmentIntensity={0.55}>
      <Lightformer form="rect" intensity={2.5} color="#ffd6a4" position={[0, 3.4, -6]} rotation={[0, 0, 0]} scale={[6, 4.5, 1]} />
      <Lightformer form="rect" intensity={1.25} color="#fff2df" position={[-3, 4.5, 6]} rotation={[0, Math.PI, 0]} scale={[8, 5, 1]} />
      <Lightformer form="rect" intensity={0.6} color="#dce6ec" position={[6, 3, 2]} rotation={[0, -Math.PI / 2, 0]} scale={[5, 4, 1]} />
      <Lightformer form="ring" intensity={0.9} color="#f4eee2" position={[0, 8, 2]} rotation={[Math.PI / 2, 0, 0]} scale={3.5} />
    </Environment>
  );
}

function WarmSceneShaders() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    // Includes invisible selection materials, avoiding a compilation hitch on the first click.
    void gl.compileAsync(scene, camera).catch(() => { /* Normal rendering can still compile on demand. */ });
  }, [gl, scene, camera]);
  return null;
}

// Same low sunrise direction as before, pulled back so the new ceiling stays inside the shadow frustum.
const SUN_POSITION: [number, number, number] = [-4.42, 11.21, -10.3];
const SUN_TARGET: [number, number, number] = [0, 0.5, 1.15];

function WindowLighting({ compact, theatre = false }: { compact: boolean; theatre?: boolean }) {
  const sunlight = useRef<THREE.DirectionalLight>(null);
  useFrame((_,dt)=>{if(sunlight.current)sunlight.current.intensity=THREE.MathUtils.damp(sunlight.current.intensity,theatre?1.15:5.2,3,dt);});
  const tableTarget = useMemo(() => {
    const target = new THREE.Object3D();
    target.position.set(...SUN_TARGET);
    return target;
  }, []);
  return <>
    <primitive object={tableTarget} />
    {/* Low, slightly cool fill keeps shadowed sides readable while the warm sun carries the form. */}
    <ambientLight intensity={0.12} color="#ffe6c8" />
    <hemisphereLight args={["#ffe2bd", "#9a6a45", 0.75]} />
    <rectAreaLight position={[0, 3.05, -3.85]} rotation={[0, Math.PI, 0]} width={5.6} height={4.1} intensity={2.6} color="#ffcf92" />
    {/* A broad reflected fill lets the front-facing wood, paper and ceramic retain their own colors. */}
    <rectAreaLight position={[-2.5, 4.5, 5.4]} rotation={[-.35, 0, 0]} width={8} height={5} intensity={.55} color="#ffe9cc" />
    {/* Warm bounce from the sunlit floor back onto the cream walls and ceiling. */}
    <rectAreaLight position={[0, -1.0, -1.0]} rotation={[Math.PI / 2, 0, 0]} width={9} height={6} intensity={.6} color="#ffc68a" />
    <rectAreaLight position={[4.9, 3.5, .2]} rotation={[0, -Math.PI / 2, 0]} width={4.2} height={3.6} intensity={.5} color="#d4e2ec" />
    <directionalLight
      ref={sunlight}
      castShadow
      target={tableTarget}
      position={SUN_POSITION}
      intensity={5.2}
      color="#ffc480"
      shadow-mapSize={[compact ? 1024 : 2048, compact ? 1024 : 2048]}
      shadow-camera-left={-7.5}
      shadow-camera-right={7.5}
      shadow-camera-top={7}
      shadow-camera-bottom={-7}
      shadow-camera-near={4}
      shadow-camera-far={28}
      shadow-bias={-0.00008}
      shadow-normalBias={0.018}
    />
    {!compact && <SoftShadows size={22} samples={12} focus={0.6} />}
    <pointLight position={[-5.2, 1.25, 1.8]} intensity={1.8} distance={4.8} decay={2} color="#ffc477" />
    <pointLight position={[3.0, 2.15, -1.1]} intensity={1.35} distance={5.2} decay={2} color="#ffd7a0" />
    <pointLight position={[4.25, 4.85, -3.55]} intensity={1.35} distance={3.2} decay={2} color="#ffd779" />
    <WindowLightShafts sun={SUN_POSITION} target={SUN_TARGET} intensity={theatre ? .25 : 1} />
  </>;
}

function CinematicCamera({ focus, compact }: { focus: FocusName; compact: boolean }) {
  const { camera, gl, pointer } = useThree();
  const pose = useRef({
    px: SHOTS.home.position[0], py: SHOTS.home.position[1], pz: SHOTS.home.position[2],
    tx: SHOTS.home.target[0], ty: SHOTS.home.target[1], tz: SHOTS.home.target[2],
    parallax: 1, lens: 0,
  });
  const previousFocus = useRef<FocusName>("home");
  const drag = useRef({ active: false, x: 0, y: 0, yaw: 0, pitch: 0 });
  const orbit = useRef({ yaw: 0, pitch: 0 });
  const reducedMotion = useRef(false);
  const [reduceCameraMotion, setReduceCameraMotion] = useState(false);
  const vectors = useRef({
    position: new THREE.Vector3(),
    target: new THREE.Vector3(),
    offset: new THREE.Vector3(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0),
    parallax: new THREE.Vector3(),
  });

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion.current = media.matches;
    const update = () => { reducedMotion.current = media.matches; setReduceCameraMotion(media.matches); };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const shot = SHOTS[focus];
    if (previousFocus.current !== focus) {
      // Start at the rendered pose so a click after dragging cannot snap the camera sideways.
      const distance = Math.hypot(pose.current.px - pose.current.tx, pose.current.py - pose.current.ty, pose.current.pz - pose.current.tz);
      const target = camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(distance).add(camera.position);
      Object.assign(pose.current, { px: camera.position.x, py: camera.position.y, pz: camera.position.z, tx: target.x, ty: target.y, tz: target.z });
      previousFocus.current = focus;
    }
    orbit.current = { yaw: 0, pitch: 0 };
    drag.current.active = false;
    if (focus !== "home") pose.current.parallax = 0;
    if (reducedMotion.current) {
      gsap.set(pose.current, {
        px: shot.position[0], py: shot.position[1], pz: shot.position[2],
        tx: shot.target[0], ty: shot.target[1], tz: shot.target[2],
        parallax: focus === "home" ? 1 : 0, lens: 0,
      });
      return;
    }
    if (focus === "home") {
      const tween = gsap.to(pose.current, {
        px: shot.position[0], py: shot.position[1], pz: shot.position[2],
        tx: shot.target[0], ty: shot.target[1], tz: shot.target[2],
        parallax: 1, lens: 0,
        duration: 1.45, ease: "power3.inOut", overwrite: "auto",
      });
      return () => { tween.kill(); };
    }
    if (focus !== "skills") {
      const timeline = gsap.timeline();
      timeline.to(pose.current, { lens: 2.2, duration: CINEMATIC.charge, ease: "power2.inOut" })
      .to(pose.current, {
        px: shot.position[0], py: shot.position[1], pz: shot.position[2],
        tx: shot.target[0], ty: shot.target[1], tz: shot.target[2],
        lens: -2,
        duration: CINEMATIC.reveal - CINEMATIC.charge, ease: "power3.inOut", overwrite: "auto",
      }, CINEMATIC.charge);
      return () => { timeline.kill(); };
    }
    const timeline = gsap.timeline();
    timeline.to(pose.current, {
      px: MONITOR_ALIGNMENT_SHOT.position[0], py: MONITOR_ALIGNMENT_SHOT.position[1], pz: MONITOR_ALIGNMENT_SHOT.position[2],
      tx: MONITOR_ALIGNMENT_SHOT.target[0], ty: MONITOR_ALIGNMENT_SHOT.target[1], tz: MONITOR_ALIGNMENT_SHOT.target[2],
      lens: 1.5, duration: CINEMATIC.monitorAlign, ease: "power2.inOut", overwrite: "auto",
    }).to(pose.current, {
      px: shot.position[0], py: shot.position[1], pz: shot.position[2],
      tx: shot.target[0], ty: shot.target[1], tz: shot.target[2],
      lens: -3, duration: CINEMATIC.monitorTravel, ease: "power3.inOut",
    });
    return () => { timeline.kill(); };
  }, [camera, focus, reduceCameraMotion]);

  useEffect(() => {
    const element = gl.domElement;
    const down = (event: PointerEvent) => {
      if (focus !== "home") return;
      drag.current = { active: true, x: event.clientX, y: event.clientY, yaw: orbit.current.yaw, pitch: orbit.current.pitch };
      element.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!drag.current.active || focus !== "home") return;
      orbit.current.yaw = THREE.MathUtils.clamp(drag.current.yaw - (event.clientX - drag.current.x) * 0.0013, -0.13, 0.13);
      orbit.current.pitch = THREE.MathUtils.clamp(drag.current.pitch + (event.clientY - drag.current.y) * 0.001, -0.055, 0.065);
    };
    const up = (event: PointerEvent) => {
      drag.current.active = false;
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    };
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", up);
    return () => {
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
    };
  }, [focus, gl]);

  useFrame(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      const fov = (compact ? 48 : 41) + pose.current.lens;
      if (Math.abs(camera.fov - fov) > .001) { camera.fov = fov; camera.updateProjectionMatrix(); }
    }
    const scratch = vectors.current;
    const basePosition = scratch.position.set(pose.current.px, pose.current.py, pose.current.pz);
    const target = scratch.target.set(pose.current.tx, pose.current.ty, pose.current.tz);
    if (focus === "home") {
      const mx = reducedMotion.current || drag.current.active ? 0 : pointer.x * 0.09 * pose.current.parallax;
      const my = reducedMotion.current || drag.current.active ? 0 : pointer.y * 0.055 * pose.current.parallax;
      const offset = scratch.offset.copy(basePosition).sub(target).applyAxisAngle(scratch.up, orbit.current.yaw + mx * 0.1);
      const right = scratch.right.crossVectors(offset, scratch.up).normalize();
      offset.applyAxisAngle(right, orbit.current.pitch - my * 0.08);
      camera.position.copy(target).add(offset).add(scratch.parallax.set(mx, my, 0));
      camera.lookAt(target.x + mx * 0.3, target.y + my * 0.15, target.z);
    } else {
      camera.position.set(pose.current.px, pose.current.py, pose.current.pz);
      camera.lookAt(target);
    }
  });
  return null;
}

function IntroScreen({ onEnter }: { onEnter: () => void }) {
  const [phase, setPhase] = useState<"arriving" | "leaving" | "gone">("arriving");
  const exitTimer = useRef<number | null>(null);
  useEffect(() => () => { if (exitTimer.current) window.clearTimeout(exitTimer.current); }, []);
  const enter = () => {
    if (phase !== "arriving") return;
    onEnter();
    setPhase("leaving");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    exitTimer.current = window.setTimeout(() => setPhase("gone"), reducedMotion ? 80 : 1250);
  };
  if (phase === "gone") return null;
  return <button type="button" className={`portfolio-intro${phase === "leaving" ? " is-leaving" : ""}`} onClick={enter} aria-label="Enter Manuel Strunz portfolio and start the room radio">
    <span className="portfolio-intro-backdrop" aria-hidden="true" style={{ "--intro-backdrop": `url("${asset("/reference/current-homepage-reference-match-pass-68.png")}")` } as CSSProperties}/>
    <span className="portfolio-intro-wash" aria-hidden="true"/>
    <span className="portfolio-intro-title" aria-hidden="true"><span>Manuel</span><span>Strunz</span></span>
    <span className="portfolio-intro-prompt"><i aria-hidden="true"/> Click anywhere to enter <small>Sound on</small></span>
  </button>;
}

export default function PortfolioScene() {
  const [focus, setFocus] = useState<FocusName>("home");
  const [visiblePanel, setVisiblePanel] = useState<FocusName | null>(null);
  const [compact, setCompact] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [transitionKey, setTransitionKey] = useState(0);
  const [windGust, setWindGust] = useState(0);
  const [windActive, setWindActive] = useState(false);
  const [entered, setEntered] = useState(false);
  const [theatre, setTheatre] = useState<{selected:ProjectId|null;sequence:number;startedAt:number;reading:boolean;investment:number}>({selected:null,sequence:0,startedAt:0,reading:false,investment:ROI_DEMO.investment});
  const accentAt = useRef(0);
  const audioContext = useRef<AudioContext | null>(null);
  const cozyRadio = useRef<CozyRadioHandle>(null);
  const soundEnabledRef = useRef(true);
  const cancelSelectionSound = useRef<(() => void) | null>(null);
  const cancelProjectAccent = useRef<(() => void) | null>(null);
  const cancelWindSound = useRef<(() => void) | null>(null);
  const soundGeneration = useRef(0);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    if (!soundEnabled) { soundGeneration.current += 1; cancelSelectionSound.current?.(); cancelWindSound.current?.(); cancelProjectAccent.current?.(); }
  }, [soundEnabled]);
  useEffect(() => () => {
    soundGeneration.current += 1;
    cancelSelectionSound.current?.();
    cancelProjectAccent.current?.();
    cancelWindSound.current?.();
    void audioContext.current?.close();
    audioContext.current = null;
  }, []);

  const playWindSound = useCallback(() => {
    const context = audioContext.current;
    if (!soundEnabledRef.current || !context || context.state !== "running") return;
    cancelWindSound.current?.();
    const now = context.currentTime;
    const duration = 2.75;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    let smoothed = 0;
    for (let index = 0; index < samples.length; index += 1) {
      const noise = Math.random() * 2 - 1;
      smoothed = smoothed * .91 + noise * .09;
      samples[index] = smoothed * (.7 + Math.sin(index / context.sampleRate * 11) * .12);
    }
    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    const panner = context.createStereoPanner();
    const output = context.createGain();
    source.buffer = buffer;
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(95, now);
    lowpass.type = "lowpass";
    lowpass.Q.value = .7;
    lowpass.frequency.setValueAtTime(380, now);
    lowpass.frequency.exponentialRampToValueAtTime(1250, now + .72);
    lowpass.frequency.exponentialRampToValueAtTime(310, now + duration);
    panner.pan.setValueAtTime(-.72, now);
    panner.pan.linearRampToValueAtTime(.62, now + 1.85);
    panner.pan.linearRampToValueAtTime(.18, now + duration);
    output.gain.setValueAtTime(.0001, now);
    output.gain.exponentialRampToValueAtTime(.085, now + .42);
    output.gain.setValueAtTime(.072, now + 1.15);
    output.gain.exponentialRampToValueAtTime(.0001, now + duration);
    source.connect(highpass).connect(lowpass).connect(panner).connect(output).connect(context.destination);
    source.onended = () => { source.disconnect(); highpass.disconnect(); lowpass.disconnect(); panner.disconnect(); output.disconnect(); };
    source.start(now);
    source.stop(now + duration);
    cancelWindSound.current = () => {
      if (context.state === "closed") return;
      const time = context.currentTime;
      output.gain.cancelScheduledValues(time);
      output.gain.setValueAtTime(output.gain.value, time);
      output.gain.linearRampToValueAtTime(0, time + .04);
      source.stop(time + .045);
    };
  }, []);

  useEffect(() => {
    if (!entered) return;
    let windEnd: number | undefined;
    const interval = window.setInterval(() => {
      setWindGust((gust) => gust + 1);
      setWindActive(true);
      if (windEnd) window.clearTimeout(windEnd);
      windEnd = window.setTimeout(() => setWindActive(false), 3400);
      playWindSound();
    }, 30_000);
    return () => {
      window.clearInterval(interval);
      if (windEnd) window.clearTimeout(windEnd);
    };
  }, [entered, playWindSound]);

  const playFocusSound = useCallback((destination: FocusName) => {
    cancelSelectionSound.current?.();
    cancelSelectionSound.current = null;
    const generation = ++soundGeneration.current;
    if (!soundEnabled || destination === "home") return;
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = audioContext.current ?? new AudioContextClass();
    audioContext.current = context;
    const play = () => {
      if (generation !== soundGeneration.current || !soundEnabledRef.current || context.state !== "running") return;
      cancelSelectionSound.current = playCinematicSound(context, destination, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    };
    if (context.state === "running") play();
    else void context.resume().then(play).catch(() => { /* Muted/browser-blocked audio never blocks navigation. */ });
  }, [soundEnabled]);

  const selectFocus = useCallback((destination: FocusName) => {
    if (destination === focus) return;
    cancelProjectAccent.current?.();
    playFocusSound(destination);
    setVisiblePanel(null);
    setTheatre(value=>({...value,selected:null,reading:false}));
    setTransitionKey((value) => value + 1);
    setFocus(destination);
  }, [focus, playFocusSound]);

  const selectProject = useCallback((id:ProjectId)=>{
    playFocusSound(id === "roi" ? "projects" : "about");
    setTheatre(value=>({...value,selected:id,reading:false,startedAt:performance.now(),sequence:value.sequence+1}));
  },[playFocusSound]);
  const projectAccent = useCallback(()=>{
    const context=audioContext.current;
    if(!soundEnabledRef.current || !context || context.state!=="running" || performance.now()-accentAt.current<220)return;
    accentAt.current=performance.now();
    const voice=context.createOscillator(), gain=context.createGain(), now=context.currentTime;
    voice.type="sine";voice.frequency.setValueAtTime(660,now);voice.frequency.exponentialRampToValueAtTime(880,now+.18);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.035,now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+.22);
    const cancel=()=>{if(context.state==="closed")return;const end=context.currentTime;gain.gain.cancelScheduledValues(end);gain.gain.setTargetAtTime(0,end,.008);voice.stop(end+.03);};
    cancelProjectAccent.current?.();cancelProjectAccent.current=cancel;
    voice.connect(gain).connect(context.destination);voice.onended=()=>{voice.disconnect();gain.disconnect();if(cancelProjectAccent.current===cancel)cancelProjectAccent.current=null;};voice.start();voice.stop(now+.24);
  },[]);
  const readProject = useCallback(()=>{cancelSelectionSound.current?.();cancelProjectAccent.current?.();setTheatre(value=>({...value,reading:true}));},[]);

  const enterPortfolio = useCallback(() => {
    if (entered) return;
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      const context = audioContext.current ?? new AudioContextClass();
      audioContext.current = context;
      void context.resume();
    }
    cozyRadio.current?.start();
    setEntered(true);
  }, [entered]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const update = () => setCompact(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { if(theatre.reading)setTheatre(value=>({...value,reading:false}));else selectFocus("home"); } };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectFocus, theatre.reading]);

  useEffect(() => {
    setVisiblePanel(null);
    if (focus === "home") return;
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 20 : (focus === "skills" ? CINEMATIC.monitorPanel : CINEMATIC.objectPanel) * 1000;
    const timeout = window.setTimeout(() => setVisiblePanel(focus), delay);
    return () => window.clearTimeout(timeout);
  }, [focus]);

  return (
    <div className="canvas-shell" data-focus={focus} data-panel-open={(visiblePanel !== null && visiblePanel !== "projects") || theatre.reading} data-project-stage={visiblePanel === "projects"} data-project={theatre.selected ?? "choose"} data-project-reading={theatre.reading} data-camera-phase={focus === "home" ? "overview" : visiblePanel ? "content" : focus === "skills" ? "screen-entry" : "object-focus"} data-wind-gust={windGust} data-wind-active={windActive} data-entered={entered}>
      <Canvas aria-label="Interactive stylized workroom" shadows="soft" frameloop={entered && !theatre.reading ? "always" : "demand"} camera={{ position: SHOTS.home.position, fov: compact ? 48 : 41, near: 0.1, far: 80 }} dpr={compact ? [1, 1.2] : [1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping, toneMappingExposure: 1.05 }}>
        <color attach="background" args={["#d99558"]} />
        <fog attach="fog" args={["#dcc2a4", 17, 38]} />
        <WindowLighting compact={compact} theatre={visiblePanel === "projects"}/>
        <Suspense fallback={null}>
          <RoomEnvironment />
          <Room activeFocus={focus} onFocus={selectFocus} windGust={windGust} projectTheatre={visiblePanel === "projects"}/>
          {visiblePanel === "projects" && <ProjectTheatreScene {...theatre} compact={compact} onSelect={selectProject} onAccent={projectAccent}/>}
          <WarmSceneShaders />
        </Suspense>
        <RenderPostFX compact={compact} />
        <CinematicCamera focus={focus} compact={compact} />
      </Canvas>
      {focus === "home" && <div className="scene-callouts" aria-label="Scene objects">
        <span className="scene-callout hobbies-callout">Hobbies</span>
        <button className="scene-callout projects-callout" aria-label="Projects" onClick={() => selectFocus("projects")}>Projekte</button>
        <button className="scene-callout about-callout" aria-label="About me" onClick={() => selectFocus("about")}>About Me</button>
        <button className="scene-callout contact-callout" aria-label="Contact" onClick={() => selectFocus("contact")}>Contacts</button>
        <button className="scene-callout skills-callout" aria-label="Skills" onClick={() => selectFocus("skills")}>Skills</button>
      </div>}
      {transitionKey > 0 && focus !== "home" && <div key={transitionKey} className="cinematic-sequence" data-destination={focus} aria-hidden="true" style={{ "--sequence-length": `${CINEMATIC.tail}s`, "--accent": CINEMATIC_COLORS[focus].core } as CSSProperties}>
        <div className="cinematic-shade"/>
        <div className="cinematic-letterbox cinematic-letterbox-top"/><div className="cinematic-letterbox cinematic-letterbox-bottom"/>
        <div className="cinematic-light-pulse"/>
        <div className="cinematic-lens-streak"/>
        <div className="cinematic-caption"><span>{focus === "skills" ? "ENTERING THE WORKSPACE" : "A LITTLE MAGIC, A CLOSER LOOK"}</span><strong>{focus === "projects" ? "Ideas, brought to life." : focus === "about" ? "The person behind the work." : focus === "contact" ? "Every connection starts somewhere." : "Step into my world."}</strong></div>
      </div>}
      {focus !== "home" && <button className="home-button" onClick={() => selectFocus("home")} aria-label="Return to room overview"><span>←</span> Room overview</button>}
      <button className="sound-toggle" onClick={() => setSoundEnabled((enabled) => !enabled)} aria-pressed={soundEnabled} aria-label={soundEnabled ? "Mute interaction sounds" : "Enable interaction sounds"}>{soundEnabled ? "Sound on" : "Sound off"}</button>
      <div className="focus-readout" aria-live="polite">{focus === "home" ? "Choose an object" : focus}</div>
      <nav className="scene-nav" aria-label="Room destinations">
        {(["projects","about","skills","contact"] as FocusName[]).map(destination => <button key={destination} onClick={() => selectFocus(destination)} aria-pressed={focus === destination}>{destination}</button>)}
      </nav>
      {visiblePanel === "projects" && !theatre.reading && <ProjectTheatreHUD selected={theatre.selected} onSelect={selectProject} onReplay={()=>theatre.selected&&selectProject(theatre.selected)} onRead={readProject} investment={theatre.investment} onInvestment={investment=>{setTheatre(value=>({...value,investment}));projectAccent();}}/>}
      {visiblePanel === "projects" && theatre.reading && <ProjectViewer projectId={theatre.selected ?? "roi"} onSelect={selectProject} onClose={()=>setTheatre(value=>({...value,reading:false}))}/>}
      {visiblePanel === "about" && <aside className="scene-panel journal-sheet" aria-label="About Manuel">
        <div className="sheet-index">Journal entry · About</div>
        <h1>{portfolioContent.about.title}</h1>
        <p className="sheet-lede">{portfolioContent.about.body}</p>
        <div className="rule-label">Working style</div>
        <ul className="tag-list">{portfolioContent.about.traits.map(item => <li key={item}>{item}</li>)}</ul>
        <div className="rule-label">Away from the desk</div>
        <p className="hand-note">{portfolioContent.about.interests.join(" · ")}</p>
      </aside>}
      {visiblePanel === "skills" && <aside className="scene-panel monitor-panel skills-panel" aria-label="Skills and experience overview">
        <div className="terminal-bar"><i/><i/><i/><span>skills.profile</span></div>
        <div className="monitor-copy">
          <div className="sheet-index">CV snapshot · Skills & experience</div>
          <h1>{portfolioContent.skills.title}</h1>
          <p>{portfolioContent.skills.body}</p>
          <ul className="skill-grid">{portfolioContent.skills.competencies.map(item=><li key={item}>{item}</li>)}</ul>
          <div className="cv-facts"><div><span>Education</span><strong>{portfolioContent.skills.education}</strong></div><div><span>Languages</span><strong>{portfolioContent.skills.languages.join(" · ")}</strong></div></div>
          <div className="experience-list">{portfolioContent.skills.experience.map(item=><article key={`${item.company}-${item.period}`}><div><span>{item.period}</span><strong>{item.company}</strong></div><h2>{item.role}</h2><p>{item.detail}</p></article>)}</div>
        </div>
      </aside>}
      {visiblePanel === "contact" && <aside className="scene-panel phone-panel" aria-label="Contact Manuel">
        <div className="phone-notch"/><div className="sheet-index">Contact</div><h1>{portfolioContent.contact.title}</h1><p>{portfolioContent.contact.body}</p>
        <div className="contact-links"><a href={`mailto:${portfolioContent.contact.email}`}><span>Email</span><strong>{portfolioContent.contact.email}</strong></a><a href={`tel:${portfolioContent.contact.phoneHref}`}><span>Phone</span><strong>{portfolioContent.contact.phoneLabel}</strong></a></div>
        <div className="contact-status"><span/>{portfolioContent.contact.status}</div><p className="contact-note">Email and phone open directly on your device.</p>
      </aside>}
      <CozyRadio ref={cozyRadio}/>
      <FocusTimer/>
      <WholesomeQuote active={entered}/>
      <IntroScreen onEnter={enterPortfolio}/>
    </div>
  );
}
