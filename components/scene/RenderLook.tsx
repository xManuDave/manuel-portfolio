"use client";

import { useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, N8AO, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, Effect, ToneMappingMode } from "postprocessing";
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
  reflectedLight.indirectDiffuse += directionalLights[ 0 ].color * material.diffuseColor * rimFresnel * rimBacklit * rimFacing * 0.2;
}
#endif
`;
}

const BEAMS: Array<{ start: [number, number, number]; width: number; length: number; strength: number }> = [
  { start: [-3.7, 4.15, -4.35], width: .95, length: 7.6, strength: .9 },
  { start: [-2.35, 4.3, -4.35], width: .55, length: 7.2, strength: .65 },
  { start: [-1.2, 4.05, -4.35], width: 1.25, length: 7.9, strength: 1 },
  { start: [.35, 4.25, -4.35], width: .7, length: 6.9, strength: .7 },
  { start: [1.55, 4.1, -4.35], width: 1.1, length: 6.4, strength: .85 },
  { start: [3.05, 4.3, -4.35], width: .6, length: 5.6, strength: .55 },
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
  float core = pow(across, 2.2);
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
    beamColor: { value: new THREE.Color("#ffc983").multiplyScalar(.38) },
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
        ["saturation", new THREE.Uniform(1.24)],
        ["contrast", new THREE.Uniform(.32)],
        ["shadowTint", new THREE.Uniform(new THREE.Vector3(-.012, .004, .022))],
        ["highlightTint", new THREE.Uniform(new THREE.Vector3(.035, .012, -.03))],
      ]),
    });
  }
}

function CinematicGrade() {
  const effect = useMemo(() => new CinematicGradeEffect(), []);
  useEffect(() => () => effect.dispose(), [effect]);
  return <primitive object={effect} />;
}

/** Post stack for the offline-render look: contact AO, soft bloom, filmic tone mapping, a light grade and fine grain. */
export function RenderPostFX({ compact }: { compact: boolean }) {
  return <EffectComposer multisampling={compact ? 0 : 4}>
    <N8AO halfRes quality={compact ? "performance" : "medium"} aoRadius={.55} distanceFalloff={.9} intensity={1.35} color="#3f3127" />
    <Bloom mipmapBlur intensity={.32} luminanceThreshold={.92} luminanceSmoothing={.25} radius={.72} />
    {/* The composer disables renderer tone mapping; compress HDR light after bloom here. */}
    <ToneMapping mode={ToneMappingMode.AGX} />
    <CinematicGrade />
    <Vignette offset={.32} darkness={.42} />
    <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={.12} />
  </EffectComposer>;
}
