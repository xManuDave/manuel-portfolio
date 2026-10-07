"use client";

import { useFrame } from "@react-three/fiber";
import { Bloom, ChromaticAberration, EffectComposer, GodRays, N8AO, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, Effect, KernelSize, ToneMappingMode } from "postprocessing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

let chunksInstalled = false;

/**
 * Adds a sun-driven rim light to every lit three.js material: edges that face the low sunrise
 * catch a warm fresnel glow, which reads as the backlit silhouettes of an offline render.
 * Patching the shared chunk keeps the many small procedural props on one consistent look.
 */
export function installRenderLookShaderChunks() {
  if (chunksInstalled) return;
  chunksInstalled = true;
  THREE.ShaderChunk.lights_fragment_end = `${THREE.ShaderChunk.lights_fragment_end}
#if NUM_DIR_LIGHTS > 0
{
  vec3 rimLight = directionalLights[ 0 ].direction;
  float rimFresnel = pow( 1.0 - saturate( dot( geometryNormal, geometryViewDir ) ), 3.0 );
  float rimBacklit = 0.35 + 0.65 * saturate( dot( rimLight, - geometryViewDir ) );
  float rimFacing = smoothstep( -0.15, 0.55, dot( geometryNormal, rimLight ) );
  // Sunset backlight: a hot, slightly redder rim that outlines every silhouette against the sky.
  reflectedLight.indirectDiffuse += directionalLights[ 0 ].color * mix( material.diffuseColor, vec3( 1.0, .62, .38 ), .35 ) * rimFresnel * rimBacklit * rimFacing * 0.42;
  reflectedLight.indirectDiffuse = min( reflectedLight.indirectDiffuse, vec3( 1.6 ) );
}
#endif
`;
}

// Low sunset beams pour in under the rear beam of the open pavilion and rake across the floor.
const BEAMS: Array<{ start: [number, number, number]; width: number; length: number; strength: number }> = [
  { start: [-2.3, 4.0, -4.6], width: 1.2, length: 9.6, strength: .85 },
  { start: [-.4, 4.15, -4.6], width: 1.5, length: 9.8, strength: 1 },
  { start: [1.7, 3.95, -4.6], width: 1.1, length: 9.2, strength: .75 },
];

const beamVertex = `
attribute vec3 beamStart;
attribute vec4 beamParams; // width, length, seed, strength
uniform vec3 sunDirection;
varying vec2 vBeam;
varying float vSeed;
varying float vStrength;
varying float vFacing;
void main() {
  vBeam = uv;
  vSeed = beamParams.z;
  vStrength = beamParams.w;
  vec3 axis = normalize(sunDirection);
  vec3 along = beamStart + axis * uv.y * beamParams.y;
  vec3 toCamera = normalize(cameraPosition - along);
  vec3 side = normalize(cross(axis, toCamera));
  // Beams fan out slightly as they travel, like light through a wide opening.
  float spread = beamParams.x * (1.0 + uv.y * .55);
  vec3 world = along + side * (uv.x - .5) * spread;
  // Thin beams viewed end-on would flicker; fade them by how broadside they are.
  vFacing = 1.0 - abs(dot(axis, toCamera));
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const beamFragment = `
uniform float time;
uniform vec3 beamColor;
uniform float intensity;
varying vec2 vBeam;
varying float vSeed;
varying float vStrength;
varying float vFacing;
void main() {
  float across = 1.0 - abs(vBeam.x - .5) * 2.0;
  float core = pow(across, 3.2);
  float head = smoothstep(0.0, .14, vBeam.y);
  float tail = 1.0 - smoothstep(.38, 1.0, vBeam.y);
  float drift = .78 + .22 * sin(time * .21 + vSeed * 6.283 + vBeam.y * 3.0);
  float streaks = .82 + .18 * sin(vBeam.x * 23.0 + vSeed * 17.0 + time * .07);
  float alpha = core * head * tail * drift * streaks * vStrength * smoothstep(.05, .45, vFacing) * intensity;
  gl_FragColor = vec4(beamColor * alpha, 1.0);
}`;

/** Soft volumetric-looking sunbeams through the open window, drawn as one additive draw call. */
export function WindowLightShafts({ sun, target, intensity = 1 }: { sun: [number, number, number]; target: [number, number, number]; intensity?: number }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const reducedMotion = useRef(false);
  const geometry = useMemo(() => {
    const vertsPerBeam = 4;
    const positions = new Float32Array(BEAMS.length * vertsPerBeam * 3);
    const uvs = new Float32Array(BEAMS.length * vertsPerBeam * 2);
    const starts = new Float32Array(BEAMS.length * vertsPerBeam * 3);
    const params = new Float32Array(BEAMS.length * vertsPerBeam * 4);
    const index: number[] = [];
    BEAMS.forEach((beam, b) => {
      [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([u, v], corner) => {
        const i = b * vertsPerBeam + corner;
        uvs.set([u, v], i * 2);
        starts.set(beam.start, i * 3);
        positions.set(beam.start, i * 3);
        params.set([beam.width, beam.length, (b * .618) % 1, beam.strength], i * 4);
      });
      const o = b * vertsPerBeam;
      index.push(o, o + 1, o + 2, o + 2, o + 1, o + 3);
    });
    const next = new THREE.BufferGeometry();
    next.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    next.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    next.setAttribute("beamStart", new THREE.BufferAttribute(starts, 3));
    next.setAttribute("beamParams", new THREE.BufferAttribute(params, 4));
    next.setIndex(index);
    // The vertex shader moves every corner; keep the beams from being frustum culled.
    next.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 30);
    return next;
  }, []);
  const uniforms = useMemo(() => ({
    time: { value: 0 },
    intensity: { value: intensity },
    beamColor: { value: new THREE.Color("#ff9c57").multiplyScalar(.5) },
    sunDirection: { value: new THREE.Vector3(...target).sub(new THREE.Vector3(...sun)).normalize() },
  }), [intensity, sun, target]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reducedMotion.current = media.matches; };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useFrame(({ clock }, delta) => {
    if (!material.current) return;
    if (!reducedMotion.current) material.current.uniforms.time.value = clock.elapsedTime;
    const u = material.current.uniforms.intensity;
    u.value = THREE.MathUtils.damp(u.value, intensity, 2.5, delta);
  });
  return <mesh geometry={geometry} frustumCulled={false} renderOrder={5}>
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={beamVertex} fragmentShader={beamFragment} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false}/>
  </mesh>;
}

const gradeFragment = `
uniform float saturation;
uniform float contrast;
uniform vec3 shadowTint;
uniform vec3 highlightTint;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 color = clamp(inputColor.rgb, 0.0, 1.0);
  float luma = dot(color, vec3(.2126, .7152, .0722));
  // Split-tone: cool, slightly teal shade against warm sunlit highlights, the classic golden-hour render grade.
  color += shadowTint * pow(1.0 - luma, 2.0) + highlightTint * luma * luma;
  // Gentle S-curve around mid grey for depth without crushing the painted backdrop.
  color = mix(color, color * color * (3.0 - 2.0 * color), contrast);
  luma = dot(color, vec3(.2126, .7152, .0722));
  color = mix(vec3(luma), color, saturation);
  outputColor = vec4(clamp(color, 0.0, 1.0), inputColor.a);
}`;

/** Final display-referred grade after AgX: restores the warm saturation AgX trades for highlight roll-off. */
class CinematicGradeEffect extends Effect {
  constructor() {
    super("CinematicGrade", gradeFragment, {
      uniforms: new Map<string, THREE.Uniform>([
        ["saturation", new THREE.Uniform(1.3)],
        ["contrast", new THREE.Uniform(.52)],
        ["shadowTint", new THREE.Uniform(new THREE.Vector3(-.025, -.008, .055))],
        ["highlightTint", new THREE.Uniform(new THREE.Vector3(.055, .012, -.04))],
      ]),
    });
  }
}

function CinematicGrade() {
  const effect = useMemo(() => new CinematicGradeEffect(), []);
  useEffect(() => () => effect.dispose(), [effect]);
  return <primitive object={effect} />;
}

/** Post stack for the sunset look: contact AO, crepuscular god rays from the sun disc, wide bloom, filmic tone mapping, a dramatic grade, a touch of lens fringing and grain. */
export function RenderPostFX({ compact, sun }: { compact: boolean; sun: THREE.Mesh | null }) {
  const fringe = useMemo(() => new THREE.Vector2(.0005, .0005), []);
  return <EffectComposer multisampling={compact ? 0 : 4}>
    <N8AO halfRes quality={compact ? "performance" : "medium"} aoRadius={.55} distanceFalloff={.9} intensity={1.4} color="#241a3a" />
    {sun && !compact ? <GodRays sun={sun} samples={64} density={.95} decay={.9} weight={.3} exposure={.2} clampMax={1} kernelSize={KernelSize.SMALL} blur /> : <></>}
    <Bloom mipmapBlur intensity={.68} luminanceThreshold={.86} luminanceSmoothing={.3} radius={.82} />
    {/* The composer disables renderer tone mapping; compress HDR light after bloom here. */}
    <ToneMapping mode={ToneMappingMode.AGX} />
    <CinematicGrade />
    <ChromaticAberration offset={fringe} radialModulation modulationOffset={.42} />
    <Vignette offset={.24} darkness={.72} />
    <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={.12} />
  </EffectComposer>;
}

const flareVertex = `
attribute vec2 corner;
attribute vec4 flare; // position along the sun-centre axis, size, shape, strength
attribute vec3 tint;
uniform vec2 sunNdc;
uniform float aspect;
uniform float intensity;
varying vec2 vCorner;
varying float vShape;
varying vec3 vTint;
void main() {
  vCorner = corner;
  vShape = flare.z;
  // Fade the whole flare as the sun slides toward the frame edge.
  float onScreen = 1.0 - smoothstep(.75, 1.25, max(abs(sunNdc.x), abs(sunNdc.y)));
  vTint = tint * flare.w * intensity * onScreen;
  vec2 size = flare.z > 1.5 ? vec2(flare.y * 7.0, flare.y * .09) : vec2(flare.y);
  vec2 centre = sunNdc * flare.x;
  gl_Position = vec4(centre + corner * size * vec2(1.0 / aspect, 1.0), 0.0, 1.0);
}`;

const flareFragment = `
varying vec2 vCorner;
varying float vShape;
varying vec3 vTint;
void main() {
  float r = length(vCorner);
  float a;
  if (vShape < .5) a = pow(max(1.0 - r, 0.0), 2.4);
  else if (vShape < 1.5) a = smoothstep(.62, .8, r) * smoothstep(1.0, .82, r);
  else a = pow(max(1.0 - abs(vCorner.x), 0.0), 3.0) * pow(max(1.0 - abs(vCorner.y), 0.0), 1.5);
  gl_FragColor = vec4(vTint * a, 1.0);
}`;

// t: position along the sun -> screen-centre line (1 = on the sun), size in NDC, shape (0 glow, 1 ring, 2 anamorphic streak).
const FLARES: Array<{ t: number; size: number; shape: number; strength: number; tint: string }> = [
  { t: 1, size: .3, shape: 2, strength: .3, tint: "#ff9d5c" },
  { t: 1, size: .3, shape: 0, strength: .18, tint: "#ffb070" },
];

/** A cheap clip-space lens flare tied to the sun disc: a faint anamorphic streak and glow. */
export function SunFlare({ sun, intensity = 1 }: { sun: THREE.Mesh | null; intensity?: number }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const scratch = useMemo(() => new THREE.Vector3(), []);
  const geometry = useMemo(() => {
    const corners: number[] = [], flare: number[] = [], tint: number[] = [], index: number[] = [];
    FLARES.forEach((item, f) => {
      const color = new THREE.Color(item.tint);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, y]) => {
        corners.push(x, y); flare.push(item.t, item.size, item.shape, item.strength); tint.push(color.r, color.g, color.b);
      });
      const o = f * 4;
      index.push(o, o + 1, o + 2, o + 2, o + 1, o + 3);
    });
    const next = new THREE.BufferGeometry();
    next.setAttribute("position", new THREE.Float32BufferAttribute(new Array(corners.length / 2 * 3).fill(0), 3));
    next.setAttribute("corner", new THREE.Float32BufferAttribute(corners, 2));
    next.setAttribute("flare", new THREE.Float32BufferAttribute(flare, 4));
    next.setAttribute("tint", new THREE.Float32BufferAttribute(tint, 3));
    next.setIndex(index);
    return next;
  }, []);
  const uniforms = useMemo(() => ({ sunNdc: { value: new THREE.Vector2(0, .5) }, aspect: { value: 1 }, intensity: { value: 0 } }), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ camera, size, clock }, delta) => {
    if (!material.current || !sun) return;
    sun.getWorldPosition(scratch).project(camera);
    const u = material.current.uniforms;
    u.sunNdc.value.set(scratch.x, scratch.y);
    u.aspect.value = size.width / size.height;
    const behind = scratch.z > 1 ? 0 : 1;
    const shimmer = 1 + Math.sin(clock.elapsedTime * .6) * .05;
    u.intensity.value = THREE.MathUtils.damp(u.intensity.value, intensity * behind * shimmer, 3, delta);
  });
  return <mesh geometry={geometry} frustumCulled={false} renderOrder={999}>
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={flareVertex} fragmentShader={flareFragment} transparent depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false}/>
  </mesh>;
}
