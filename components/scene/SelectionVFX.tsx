"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { CINEMATIC, CINEMATIC_COLORS, type CinematicDestination } from "@/lib/scene-cinematic";

type SelectionVFXProps = {
  active: boolean;
  destination: CinematicDestination;
  reducedMotion: boolean;
  /** Relative to the translating stage, not the rotating artifact. */
  center?: [number, number, number];
  radius?: number;
  time?: RefObject<number>;
};

const RADII: Record<CinematicDestination, number> = { projects: 1.15, about: .9, contact: .7, skills: 1.05 };
const ORIGIN: [number, number, number] = [0, 0, 0];
const vertexPlane = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const commonUniforms = `
uniform float uTime;
uniform float uCharge;
uniform float uLiftEnd;
uniform float uReveal;
uniform float uReduced;
uniform float uRadius;
uniform float uMonitor;
uniform vec3 uCore;
uniform vec3 uAccent;
`;

const ringFragment = `${commonUniforms}
varying vec2 vUv;
float ring(float distance, float radius, float width) {
  float edge = (distance - radius) / max(width, fwidth(distance));
  return exp(-edge * edge);
}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float distance = length(p);
  float angle = atan(p.y, p.x);
  float charge = clamp(uTime / uCharge, 0.0, 1.0);
  float contraction = mix(.79, .37, charge * charge);
  float charging = smoothstep(0.0, .13, uTime) * (1.0 - smoothstep(uCharge, uCharge + .18, uTime));
  float chargeRing = ring(distance, contraction, .007) * .9;
  chargeRing += ring(distance, contraction, .036) * .17;
  float dashes = pow(.5 + .5 * cos(angle * 16.0 - uTime * 2.7), 12.0);
  chargeRing += ring(distance, contraction + .037, .006) * dashes * .6;

  float age = max(0.0, uTime - uCharge);
  float shockRadius = .34 + (1.0 - exp(-age * 3.3)) * .7;
  float shockVisibility = step(uCharge, uTime) * (1.0 - smoothstep(.13, .86, age));
  float shock = ring(distance, shockRadius, .008) * .95 + ring(distance, shockRadius, .028) * .25;
  float echo = ring(distance, max(.0, shockRadius - .055), .004) * .2;

  float resting = smoothstep(uLiftEnd - .3, uReveal, uTime);
  float orbit = ring(distance, .52, .0035) * (.15 + .14 * pow(.5 + .5 * cos(angle * 3.0 - uTime * .65), 10.0));
  float alpha = chargeRing * charging + (shock + echo) * shockVisibility + orbit * resting;
  if (uReduced > .5) alpha = ring(distance, .52, .006) * .13;
  alpha *= 1.0 - smoothstep(.93, 1.02, distance);
  if (alpha < .004) discard;
  gl_FragColor = vec4(mix(uAccent, uCore, .72) * 1.15, min(alpha, .92));
  #include <colorspace_fragment>
}`;

const haloFragment = `${commonUniforms}
varying vec2 vUv;
float roundedBox(vec2 p, vec2 bounds, float corner) {
  vec2 q = abs(p) - bounds + corner;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - corner;
}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float distance = length(p);
  float angle = atan(p.y, p.x);
  float age = max(0.0, uTime - uCharge);
  float launch = step(uCharge, uTime) * exp(-age * 3.8) * smoothstep(0.0, .035, age);
  float arriving = smoothstep(0.0, .28, uTime);
  float settling = smoothstep(uLiftEnd, uReveal, uTime);

  // The clear center preserves the artifact silhouette; light gathers around its edge.
  float edge = exp(-pow((distance - .56) / .085, 2.0));
  float innerEdge = exp(-pow((distance - .5) / .012, 2.0));
  float halo = edge * (.13 + launch * .42) + innerEdge * (.025 + launch * .22);
  float rays = pow(max(0.0, cos(angle * 7.0 + .35)), 22.0);
  rays += pow(max(0.0, cos(angle * 11.0 - .1)), 38.0) * .37;
  rays *= smoothstep(.22, .43, distance) * (1.0 - smoothstep(.52, .98, distance));
  halo += rays * launch * .58;
  halo *= arriving * mix(1.0, .43, settling);

  if (uMonitor > .5) {
    float frameDistance = abs(roundedBox(p, vec2(.71, .57), .075));
    float frame = exp(-pow(frameDistance / .007, 2.0));
    float bloom = exp(-pow(frameDistance / .038, 2.0));
    float trace = pow(.5 + .5 * sin((p.x + p.y) * 5.0 - uTime * 3.6), 5.0);
    halo = (frame * (.46 + trace * .2) + bloom * .16) * arriving * mix(1.0, .45, settling);
    halo += bloom * launch * .65;
    if (uReduced > .5) halo = frame * .22 + bloom * .07;
  } else if (uReduced > .5) {
    halo = edge * .1;
  }
  if (halo < .004) discard;
  gl_FragColor = vec4(mix(uAccent, uCore, .78) * 1.15, min(halo, .78));
  #include <colorspace_fragment>
}`;

const ribbonVertex = `${commonUniforms}
attribute float aProgress;
attribute float aSide;
attribute float aStrand;
varying float vProgress;
varying float vAlpha;
void main() {
  float age = max(0.0, uTime - uCharge);
  float appearing = smoothstep(0.0, .38, age);
  float angle = aStrand * 3.14159265 + aProgress * 4.3 - age * 2.65;
  float radius = uRadius * (.83 + .19 * sin(aProgress * 3.14159265));
  radius *= mix(.47, 1.0, appearing);
  float y = (aProgress - .5) * uRadius * 1.24 + sin(age * .8) * .08;
  vec3 outward = vec3(cos(angle), .24, sin(angle));
  vec3 nextPosition = vec3(cos(angle) * radius, y, sin(angle) * radius);
  float ribbonWidth = uRadius * .014 * pow(max(.0, sin(aProgress * 3.14159265)), .6);
  nextPosition += outward * aSide * ribbonWidth;
  vProgress = aProgress;
  vAlpha = appearing * (1.0 - smoothstep(uLiftEnd + .12, uReveal + .18, uTime));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(nextPosition, 1.0);
}`;

const ribbonFragment = `${commonUniforms}
varying float vProgress;
varying float vAlpha;
void main() {
  float taper = pow(max(.0, sin(vProgress * 3.14159265)), .65);
  float head = exp(-pow((vProgress - .77) / .14, 2.0));
  float alpha = taper * vAlpha * (.4 + head * .4);
  if (alpha < .004) discard;
  gl_FragColor = vec4(mix(uAccent, uCore, .35 + head * .65) * 1.28, alpha);
  #include <colorspace_fragment>
}`;

const sparkleVertex = `${commonUniforms}
uniform float uDpr;
attribute vec4 aSeed;
varying float vAlpha;
varying float vWarmth;
void main() {
  float tau = 6.2831853;
  float charge = clamp(uTime / uCharge, 0.0, 1.0);
  float age = max(0.0, uTime - uCharge);
  float launched = smoothstep(0.0, .5, age);
  float settled = smoothstep(uLiftEnd, uReveal, uTime);
  float theta = aSeed.x * tau + uTime * mix(4.0, .45, settled) + aSeed.y * 2.0;
  float radius = uRadius * mix(1.4, .67, charge);
  radius = mix(radius, uRadius * (.92 + sin(theta * 2.0 + aSeed.z) * .14), launched);
  float cycle = fract(aSeed.y + age * .32);
  float height = (cycle - .5) * uRadius * 1.4;
  height = mix(height, sin(theta * 1.5 + aSeed.y * tau) * uRadius * .24, settled);
  vec3 nextPosition = vec3(cos(theta) * radius, height, sin(theta) * radius);
  float glint = .3 + .7 * pow(.5 + .5 * sin(uTime * 1.65 + aSeed.x * 19.0), 5.0);
  float persistent = step(.85, aSeed.z) * glint * .62;
  vAlpha = smoothstep(0.0, .13, uTime) * mix(.48 + launched * .5, persistent, settled);
  if (aSeed.w > .5) {
    float direction = aSeed.x * tau;
    float distance = uRadius * (.42 + age * (1.15 + aSeed.z * .62));
    nextPosition = vec3(cos(direction) * distance, (.08 + age * (.7 + aSeed.y * .55) - age * age * .3) * uRadius, sin(direction) * distance);
    vAlpha = step(uCharge, uTime) * smoothstep(.0, .045, age) * (1.0 - smoothstep(.38, 1.4, age));
  }
  vWarmth = aSeed.y;
  vec4 viewPosition = modelViewMatrix * vec4(nextPosition, 1.0);
  gl_Position = projectionMatrix * viewPosition;
  gl_PointSize = (15.0 + aSeed.z * 12.0) * uDpr * clamp(7.0 / max(1.0, -viewPosition.z), .5, 1.65) * mix(1.0, .74, settled);
}`;

const sparkleFragment = `${commonUniforms}
varying float vAlpha;
varying float vWarmth;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float distance = length(p);
  float core = exp(-distance * distance * 45.0);
  float cross = exp(-abs(p.x) * 37.0 - abs(p.y) * 4.3) + exp(-abs(p.y) * 37.0 - abs(p.x) * 4.3);
  float halo = exp(-distance * distance * 7.0) * .15;
  float alpha = (core + cross * .58 + halo) * vAlpha;
  alpha *= 1.0 - smoothstep(.75, 1.0, distance);
  if (alpha < .004) discard;
  gl_FragColor = vec4(mix(uCore, uAccent, vWarmth * .45) * 1.35, min(alpha, 1.0));
  #include <colorspace_fragment>
}`;

function makeMaterial(uniforms: Record<string, THREE.IUniform>, vertexShader: string, fragmentShader: string) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
  });
}

/** Four draws: charge/shockwave, clear-center halo, paired ascent ribbons and GPU sparkles. */
export default function SelectionVFX({ active, destination, reducedMotion, center = ORIGIN, radius = RADII[destination], time }: SelectionVFXProps) {
  const root = useRef<THREE.Group>(null);
  const billboard = useRef<THREE.Mesh>(null);
  const startedAt = useRef(-1);
  const parentQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const assets = useMemo(() => {
    const palette = CINEMATIC_COLORS[destination];
    const uniforms = {
      uTime: { value: 0 },
      uCharge: { value: CINEMATIC.charge },
      uLiftEnd: { value: CINEMATIC.liftEnd },
      uReveal: { value: CINEMATIC.reveal },
      uReduced: { value: reducedMotion ? 1 : 0 },
      uRadius: { value: radius },
      uMonitor: { value: destination === "skills" ? 1 : 0 },
      uCore: { value: new THREE.Color(palette.core) },
      uAccent: { value: new THREE.Color(palette.accent) },
      uDpr: { value: 1 },
    };
    const plane = new THREE.PlaneGeometry(2, 2);
    const ribbons = new THREE.BufferGeometry();
    const positions: number[] = [];
    const progress: number[] = [];
    const sides: number[] = [];
    const strands: number[] = [];
    const indices: number[] = [];
    const segments = 100;
    for (let strand = 0; strand < 2; strand++) {
      const start = positions.length / 3;
      for (let segment = 0; segment <= segments; segment++) {
        for (const side of [-1, 1]) {
          positions.push(0, 0, 0);
          progress.push(segment / segments);
          sides.push(side);
          strands.push(strand);
        }
        if (segment < segments) {
          const index = start + segment * 2;
          indices.push(index, index + 1, index + 3, index, index + 3, index + 2);
        }
      }
    }
    ribbons.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    ribbons.setAttribute("aProgress", new THREE.Float32BufferAttribute(progress, 1));
    ribbons.setAttribute("aSide", new THREE.Float32BufferAttribute(sides, 1));
    ribbons.setAttribute("aStrand", new THREE.Float32BufferAttribute(strands, 1));
    ribbons.setIndex(indices);

    const sparks = new THREE.BufferGeometry();
    const seeds = new Float32Array(112 * 4);
    for (let index = 0; index < 112; index++) {
      seeds[index * 4] = (index * .61803398875) % 1;
      seeds[index * 4 + 1] = (index * .38196601125 + .17) % 1;
      seeds[index * 4 + 2] = (index * .754877666 + .3) % 1;
      seeds[index * 4 + 3] = index >= 88 ? 1 : 0;
    }
    sparks.setAttribute("position", new THREE.BufferAttribute(new Float32Array(112 * 3), 3));
    sparks.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
    const ringMaterial = makeMaterial(uniforms, vertexPlane, ringFragment);
    const haloMaterial = makeMaterial(uniforms, vertexPlane, haloFragment);
    const ribbonMaterial = makeMaterial(uniforms, ribbonVertex, ribbonFragment);
    const sparkleMaterial = makeMaterial(uniforms, sparkleVertex, sparkleFragment);
    return { uniforms, plane, ribbons, sparks, ringMaterial, haloMaterial, ribbonMaterial, sparkleMaterial };
  }, [destination, radius, reducedMotion]);

  useEffect(() => {
    startedAt.current = active ? performance.now() : -1;
  }, [active, destination, reducedMotion]);
  useEffect(() => () => {
    assets.plane.dispose();
    assets.ribbons.dispose();
    assets.sparks.dispose();
    assets.ringMaterial.dispose();
    assets.haloMaterial.dispose();
    assets.ribbonMaterial.dispose();
    assets.sparkleMaterial.dispose();
  }, [assets]);

  useFrame(({ camera, gl }) => {
    if (!active) return;
    if (startedAt.current < 0) startedAt.current = performance.now();
    assets.uniforms.uTime.value = reducedMotion ? CINEMATIC.reveal + 1 : time ? time.current : (performance.now() - startedAt.current) / 1000;
    assets.uniforms.uDpr.value = Math.min(1.6, gl.getPixelRatio());
    if (billboard.current && root.current && destination !== "skills") {
      root.current.getWorldQuaternion(parentQuaternion);
      parentQuaternion.invert();
      billboard.current.quaternion.copy(parentQuaternion).multiply(camera.quaternion);
    }
  });

  const monitor = destination === "skills";
  return <group ref={root} position={center} visible={active} dispose={null}>
    <mesh geometry={assets.plane} material={assets.ringMaterial} position={[0, monitor ? -.6 : -.32, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={radius * 2.2} raycast={() => {}} />
    <mesh ref={billboard} geometry={assets.plane} material={assets.haloMaterial} position={[0, 0, monitor ? .15 : -.12]} scale={monitor ? [radius * 1.34, radius * 1.1, 1] : [radius * 1.55, radius * 1.55, 1]} raycast={() => {}} />
    <mesh geometry={assets.ribbons} material={assets.ribbonMaterial} visible={!reducedMotion && !monitor} frustumCulled={false} raycast={() => {}} />
    <points geometry={assets.sparks} material={assets.sparkleMaterial} visible={!reducedMotion} frustumCulled={false} raycast={() => {}} />
  </group>;
}
