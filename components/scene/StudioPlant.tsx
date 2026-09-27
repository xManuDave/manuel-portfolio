"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

type V3 = [number, number, number];

type StudioPlantProps = {
  position: V3;
  scale?: number;
  /** Increasing gust event counter, matching the room's wind context. */
  gust?: number;
};

type LeafPlacement = {
  matrix: THREE.Matrix4;
  color: THREE.Color;
  stem: THREE.Matrix4[];
};

function makeLeafGeometry() {
  const segments = 14;
  const crossSegments = 8;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const sideVertices = (segments + 1) * (crossSegments + 1);

  // A closed leaf with a soft central fold, rounded shoulders and a tapered tip.
  // Its raised midrib catches light geometrically, without a flat sprite edge.
  for (let face = 0; face < 2; face++) {
    for (let row = 0; row <= segments; row++) {
      const t = row / segments;
      const silhouette = Math.pow(Math.sin(t * Math.PI), .76);
      const width = silhouette * (.32 - t * .08);
      for (let column = 0; column <= crossSegments; column++) {
        const across = column / crossSegments * 2 - 1;
        const middle = 1 - Math.abs(across);
        const fold = .066 * silhouette * middle;
        const curve = .095 * Math.sin(t * Math.PI) - .13 * t * t;
        const thickness = .016 * silhouette * Math.sqrt(Math.max(0, 1 - across * across));
        positions.push(across * width, t, curve + fold + (face === 0 ? thickness : -thickness));
        const vein = Math.pow(middle, 14) * silhouette * .045;
        const edge = Math.abs(across) * .035;
        const tone = (face === 0 ? .98 : .83) + vein - edge;
        colors.push(tone, Math.min(1, tone + .008), tone - .015);
      }
    }
    for (let row = 0; row < segments; row++) {
      for (let column = 0; column < crossSegments; column++) {
        const a = face * sideVertices + row * (crossSegments + 1) + column;
        const b = a + 1;
        const c = a + crossSegments + 1;
        const d = c + 1;
        if (face === 0) indices.push(a, b, c, b, d, c);
        else indices.push(a, c, b, b, c, d);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function makePotGeometry() {
  const profile = [
    [0, .012], [.183, .012], [.2, .022], [.208, .04],
    [.214, .09], [.227, .16], [.246, .25], [.267, .345],
    [.276, .369], [.299, .371], [.309, .381], [.311, .409],
    [.303, .428], [.284, .433], [.271, .422], [.266, .403],
    [.267, .377], [.253, .342], [.229, .235], [.203, .11],
    [.187, .065], [0, .065],
  ].map(([radius, y]) => new THREE.Vector2(radius, y));
  const geometry = new THREE.LatheGeometry(profile, 48);
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const base = new THREE.Color("#b9825d");
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const variation = Math.sin(y * 90) * .013 + Math.sin(positions.getX(i) * 15 + y * 11) * .012;
    const rim = y > .37 ? 1.065 : 1;
    colors[i * 3] = base.r * (rim + variation);
    colors[i * 3 + 1] = base.g * (rim + variation);
    colors[i * 3 + 2] = base.b * (rim + variation);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// Small immutable resources are shared by all plant instances in the room.
let sharedResources: ReturnType<typeof createResources> | undefined;
function createResources() {
  return {
    leaf: makeLeafGeometry(),
    stem: new THREE.CylinderGeometry(1, 1, 1, 6),
    pot: makePotGeometry(),
    soil: new THREE.CylinderGeometry(.263, .258, .02, 32),
    leafMaterial: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .69, metalness: 0, envMapIntensity: .35 }),
    stemMaterial: new THREE.MeshStandardMaterial({ color: "#5e7443", roughness: .87 }),
    potMaterial: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .87, metalness: 0 }),
    soilMaterial: new THREE.MeshStandardMaterial({ color: "#3d3022", roughness: 1 }),
  };
}

function buildCrown(): LeafPlacement[] {
  const up = new THREE.Vector3(0, 1, 0);
  const rotation = new THREE.Quaternion();
  const matrix = new THREE.Matrix4();
  const palette = ["#75914e", "#668447", "#8b9e59", "#587941"];
  const placements: LeafPlacement[] = [];
  const rings = [
    { count: 5, height: .1, length: .4, elevation: .39, offset: .1 },
    { count: 4, height: .2, length: .405, elevation: .78, offset: .62 },
    { count: 3, height: .29, length: .395, elevation: 1.17, offset: .24 },
  ];
  for (const [tier, ring] of rings.entries()) {
    for (let i = 0; i < ring.count; i++) {
      const angle = i / ring.count * Math.PI * 2 + ring.offset;
      const radius = tier === 0 ? .035 : .025;
      const origin = new THREE.Vector3(Math.sin(angle) * radius, ring.height, Math.cos(angle) * radius);
      const elevation = ring.elevation + Math.sin(i * 2.3) * .06;
      const direction = new THREE.Vector3(Math.sin(angle) * Math.cos(elevation), Math.sin(elevation), Math.cos(angle) * Math.cos(elevation));
      const right = direction.clone().cross(up).normalize();
      const normal = right.clone().cross(direction).normalize();
      rotation.setFromRotationMatrix(matrix.makeBasis(right, direction, normal));
      const length = ring.length * (1 + Math.sin(i * 1.9 + tier) * .055);
      const leafMatrix = new THREE.Matrix4().compose(origin, rotation, new THREE.Vector3(length * 1.16, length, length));
      const stem: THREE.Matrix4[] = [];
      const start = new THREE.Vector3(Math.sin(angle) * .018, -.016, Math.cos(angle) * .018);
      const tip = origin.clone().addScaledVector(direction, .085);
      const curve = new THREE.QuadraticBezierCurve3(start, new THREE.Vector3(origin.x * .3, ring.height * .9, origin.z * .3), tip);
      for (let segment = 0; segment < 3; segment++) {
        const a = curve.getPoint(segment / 3);
        const b = curve.getPoint((segment + 1) / 3);
        const distance = a.distanceTo(b);
        const stemRotation = new THREE.Quaternion().setFromUnitVectors(up, b.clone().sub(a).normalize());
        stem.push(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5), stemRotation, new THREE.Vector3(.008, distance + .005, .008)));
      }
      placements.push({ matrix: leafMatrix, color: new THREE.Color(palette[(i + tier) % palette.length]), stem });
    }
  }
  return placements;
}

export default function StudioPlant({ position, scale = 1, gust = 0 }: StudioPlantProps) {
  const crown = useRef<THREE.Group>(null);
  const leaves = useRef<THREE.InstancedMesh>(null);
  const stems = useRef<THREE.InstancedMesh>(null);
  const reducedMotion = useRef(false);
  const gustAge = useRef(10);
  const resources = useMemo(() => sharedResources ??= createResources(), []);
  const placements = useMemo(buildCrown, []);

  useLayoutEffect(() => {
    if (!leaves.current || !stems.current) return;
    placements.forEach((placement, index) => {
      leaves.current!.setMatrixAt(index, placement.matrix);
      leaves.current!.setColorAt(index, placement.color);
      placement.stem.forEach((stem, segment) => stems.current!.setMatrixAt(index * 3 + segment, stem));
    });
    leaves.current.instanceMatrix.needsUpdate = true;
    if (leaves.current.instanceColor) leaves.current.instanceColor.needsUpdate = true;
    stems.current.instanceMatrix.needsUpdate = true;
    leaves.current.computeBoundingSphere();
    stems.current.computeBoundingSphere();
  }, [placements]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reducedMotion.current = media.matches; };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => { if (gust > 0) gustAge.current = 0; }, [gust]);

  useFrame(({ clock }, delta) => {
    if (!crown.current) return;
    const step = Math.min(delta, .05);
    gustAge.current += step;
    const age = gustAge.current;
    const wind = THREE.MathUtils.smoothstep(age, 0, .48) * (1 - THREE.MathUtils.smoothstep(age, 1.55, 3.4));
    const idle = Math.sin(clock.elapsedTime * .72 + position[0] * 1.4) * .012;
    const flutter = Math.sin(clock.elapsedTime * 7 + position[2]) * .012 * wind;
    const targetZ = reducedMotion.current ? 0 : idle + wind * .082 + flutter;
    const targetX = reducedMotion.current ? 0 : wind * .06;
    const damping = 1 - Math.exp(-4.5 * step);
    crown.current.rotation.z = THREE.MathUtils.lerp(crown.current.rotation.z, targetZ, damping);
    crown.current.rotation.x = THREE.MathUtils.lerp(crown.current.rotation.x, targetX, damping);
  });

  return <group position={position} scale={scale} dispose={null}>
    <mesh geometry={resources.pot} material={resources.potMaterial} castShadow receiveShadow />
    <mesh geometry={resources.soil} material={resources.soilMaterial} position={[0, .393, 0]} receiveShadow />
    <group ref={crown} position={[0, .402, 0]}>
      <instancedMesh ref={stems} args={[resources.stem, resources.stemMaterial, placements.length * 3]} castShadow receiveShadow />
      <instancedMesh ref={leaves} args={[resources.leaf, resources.leafMaterial, placements.length]} castShadow receiveShadow />
    </group>
  </group>;
}
