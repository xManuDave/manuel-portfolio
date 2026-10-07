"use client";

import { asset } from "@/lib/asset";
import { RoundedBox, useGLTF, useTexture } from "@react-three/drei";
import { ThreeEvent, useFrame } from "@react-three/fiber";
import { createContext, ReactNode, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { furnitureAssetNames, furnitureAssetPath, type FurnitureAssetName } from "@/lib/scene-assets";
import StudioPlant from "./StudioPlant";
import { CoffeeMug, ContactPhone, DesktopKeyboard } from "./HeroProps";
import { CINEMATIC, CINEMATIC_COLORS } from "@/lib/scene-cinematic";
import SelectionVFX from "./SelectionVFX";
import CozyCat from "./CozyCat";

export type FocusName = "home" | "projects" | "about" | "contact" | "skills";
type V3 = [number, number, number];
type Surface = "paint" | "wood" | "floor" | "plaster" | "fabric" | "curtain" | "paper";
const P = { wood: "#9b6038", dark: "#5b3925", plaster: "#e1c3a1", cream: "#f0ddbe", sage: "#74866a", green: "#48634a", coral: "#c9724f", blue: "#718c91" };

const surfaceCache = new Map<string, THREE.CanvasTexture>();
type PbrTextureSet = { color: THREE.Texture; normal: THREE.Texture; roughness: THREE.Texture; ao?: THREE.Texture };
type SurfaceTextureSet = { wood: PbrTextureSet; floor: PbrTextureSet; plaster: PbrTextureSet; curtain: PbrTextureSet; fabric: THREE.Texture; stylizedWood: THREE.Texture };
const SurfaceTextureContext = createContext<SurfaceTextureSet | null>(null);
const WindGustContext = createContext(0);
const ProjectTheatreContext = createContext(false);

function windEnvelope(age: number) {
  if (age < 0 || age > 3.4) return 0;
  const attack = THREE.MathUtils.smoothstep(age, 0, .48);
  const release = 1 - THREE.MathUtils.smoothstep(age, 1.55, 3.4);
  return attack * release;
}

function surfaceTexture(surface: Surface, data = false) {
  const key = `${surface}-${data ? "data" : "color"}`;
  const cached = surfaceCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const context = canvas.getContext("2d")!;
  const seed = (x: number, y: number) => {
    const value = Math.sin(x * 12.9898 + y * 78.233 + surface.length * 19.19) * 43758.5453;
    return value - Math.floor(value);
  };
  context.fillStyle = data ? "#7f7f7f" : "#f7eee3";
  context.fillRect(0, 0, 256, 256);

  if (surface === "wood") {
    for (let y = 0; y < 256; y += 18) {
      context.beginPath();
      for (let x = 0; x <= 256; x += 4) {
        const wave = Math.sin(x * .055 + y * .07) * 2.2 + (seed(x, y) - .5) * 1.6;
        x === 0 ? context.moveTo(x, y + wave) : context.lineTo(x, y + wave);
      }
      context.strokeStyle = data ? "rgba(210,210,210,.42)" : "rgba(91,47,24,.28)";
      context.lineWidth = data ? 2.4 : 3.2;
      context.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const x = seed(i, 2) * 256; const y = seed(i, 8) * 256;
      context.strokeStyle = data ? "rgba(75,75,75,.14)" : "rgba(89,48,27,.1)";
      context.beginPath(); context.ellipse(x, y, 10 + seed(i, 3) * 18, 2.5, 0, 0, Math.PI * 2); context.stroke();
    }
  } else {
    const count = surface === "fabric" ? 950 : surface === "plaster" ? 520 : 280;
    for (let i = 0; i < count; i++) {
      const x = seed(i, 4) * 256; const y = seed(i, 7) * 256;
      const alpha = surface === "fabric" ? .22 : surface === "plaster" ? .13 : .16;
      const shade = seed(i, 3) > .5 ? 180 : 70;
      context.fillStyle = data ? `rgba(${shade},${shade},${shade},${alpha})` : `rgba(88,63,42,${alpha})`;
      const size = surface === "plaster" ? 1.3 + seed(i, 9) * 2.2 : .7 + seed(i, 9) * 1.2;
      context.fillRect(x, y, size, size);
    }
    if (surface === "fabric") {
      context.strokeStyle = data ? "rgba(205,205,205,.25)" : "rgba(255,255,255,.17)";
      context.lineWidth = 1;
      for (let i = 0; i < 256; i += 8) { context.beginPath(); context.moveTo(i, 0); context.lineTo(i, 256); context.stroke(); }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(surface === "wood" ? .72 : 2.2, surface === "wood" ? 1.35 : 2.2);
  texture.anisotropy = 4;
  texture.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  surfaceCache.set(key, texture);
  return texture;
}

function SurfaceTextureProvider({ children }: { children: ReactNode }) {
  const textures = useTexture([
    asset("/textures/polyhaven/wood-table/diffuse.jpg"),
    asset("/textures/polyhaven/wood-table/normal-gl.jpg"),
    asset("/textures/polyhaven/wood-table/roughness.jpg"),
    asset("/textures/polyhaven/white-plaster-02/diffuse.jpg"),
    asset("/textures/polyhaven/white-plaster-02/normal-gl.jpg"),
    asset("/textures/polyhaven/white-plaster-02/roughness.jpg"),
    asset("/textures/polyhaven/fabric-pattern-07/diffuse.jpg"),
    asset("/textures/polyhaven/fabric-pattern-07/normal-gl.jpg"),
    asset("/textures/polyhaven/fabric-pattern-07/roughness.jpg"),
    asset("/textures/stylized-sage-fabric-v1.png"),
    asset("/textures/stylized-warm-wood-v1.png"),
    asset("/textures/polyhaven/plank-flooring-02/diffuse.jpg"),
    asset("/textures/polyhaven/plank-flooring-02/normal-gl.jpg"),
    asset("/textures/polyhaven/plank-flooring-02/roughness.jpg"),
    asset("/textures/polyhaven/plank-flooring-02/ao.jpg"),
  ]);
  const [woodColor, woodNormal, woodRoughness, plasterColor, plasterNormal, plasterRoughness, curtainColor, curtainNormal, curtainRoughness, paintedFabric, stylizedWood, floorColor, floorNormal, floorRoughness, floorAo] = textures;
  useEffect(() => {
    const configure = (texture: THREE.Texture, repeat: [number, number], color = false) => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(...repeat);
      texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.anisotropy = 8;
      texture.needsUpdate = true;
    };
    [woodColor, woodNormal, woodRoughness].forEach((texture, index) => configure(texture, [1.15, 1.15], index === 0));
    [plasterColor, plasterNormal, plasterRoughness].forEach((texture, index) => configure(texture, [2.1, 2.1], index === 0));
    [curtainColor, curtainNormal, curtainRoughness].forEach((texture, index) => configure(texture, [2.4, 3.2], index === 0));
    [floorColor, floorNormal, floorRoughness, floorAo].forEach((texture, index) => configure(texture, [2.8, 1.05], index === 0));
    floorAo.channel = 0;
    configure(paintedFabric, [2.6, 2.6], true);
    configure(stylizedWood, [.85, 1.25], true);
  }, [curtainColor, curtainNormal, curtainRoughness, floorAo, floorColor, floorNormal, floorRoughness, paintedFabric, plasterColor, plasterNormal, plasterRoughness, stylizedWood, woodColor, woodNormal, woodRoughness]);
  const value = useMemo(() => ({
    wood: { color: woodColor, normal: woodNormal, roughness: woodRoughness },
    floor: { color: floorColor, normal: floorNormal, roughness: floorRoughness, ao: floorAo },
    plaster: { color: plasterColor, normal: plasterNormal, roughness: plasterRoughness },
    curtain: { color: curtainColor, normal: curtainNormal, roughness: curtainRoughness },
    fabric: paintedFabric,
    stylizedWood,
  }), [curtainColor, curtainNormal, curtainRoughness, floorAo, floorColor, floorNormal, floorRoughness, paintedFabric, plasterColor, plasterNormal, plasterRoughness, stylizedWood, woodColor, woodNormal, woodRoughness]);
  return <SurfaceTextureContext.Provider value={value}>{children}</SurfaceTextureContext.Provider>;
}

function StylizedMaterial({ color, surface = "paint" }: { color: string; surface?: Surface }) {
  const painted = useContext(SurfaceTextureContext);
  const maps = useMemo(() => ({ map: surfaceTexture(surface), bump: surfaceTexture(surface, true) }), [surface]);
  const roughness = surface === "floor" ? .92 : surface === "wood" ? .78 : surface === "paper" ? .92 : surface === "fabric" || surface === "curtain" ? .96 : .9;
  const bumpScale = surface === "wood" ? .05 : surface === "fabric" ? .026 : surface === "plaster" ? .022 : .014;
  const tint = useMemo(() => surface === "floor" ? new THREE.Color(color).lerp(new THREE.Color("#e8d4b8"), .48) : surface === "wood" ? new THREE.Color("#dbc9b4") : surface === "plaster" ? new THREE.Color(color) : surface === "fabric" ? new THREE.Color(color).lerp(new THREE.Color("#ffffff"), .18) : surface === "curtain" ? new THREE.Color(color).multiplyScalar(.82) : new THREE.Color(color), [color, surface]);
  const pbr = surface === "floor" ? painted?.floor : surface === "wood" ? painted?.wood : surface === "plaster" ? painted?.plaster : surface === "curtain" ? painted?.curtain : undefined;
  const colorMap = surface === "floor" ? painted?.floor.color ?? maps.map : surface === "wood" ? painted?.stylizedWood ?? maps.map : surface === "plaster" ? maps.map : surface === "curtain" ? maps.map : surface === "fabric" ? painted?.fabric ?? maps.map : maps.map;
  const stylizeShader = useMemo(() => (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = `varying vec3 vStylizedWorldPosition; varying vec3 vStylizedWorldNormal;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `#include <worldpos_vertex>\n      vStylizedWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;\n      vStylizedWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`,
    );
    shader.fragmentShader = `varying vec3 vStylizedWorldPosition; varying vec3 vStylizedWorldNormal;\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `float stylizedUp = smoothstep(-0.35, 0.92, vStylizedWorldNormal.y);\n      float stylizedHeight = smoothstep(-1.0, 5.5, vStylizedWorldPosition.y);\n      float windowFacing = smoothstep(-0.75, 0.65, -vStylizedWorldNormal.z);\n      float formShade = mix(0.88, 1.07, stylizedUp);\n      vec3 paintedGrade = mix(vec3(1.035, 0.95, 0.88), vec3(1.045, 1.01, 0.95), stylizedUp * 0.62 + stylizedHeight * 0.08);\n      outgoingLight *= paintedGrade * formShade;\n      vec3 warmBounce = diffuseColor.rgb * vec3(0.065, 0.04, 0.022) * (0.45 + (1.0 - stylizedUp) * 0.42);\n      vec3 sunriseEdge = diffuseColor.rgb * vec3(0.05, 0.025, 0.01) * windowFacing;\n      outgoingLight += warmBounce + sunriseEdge;\n      #include <opaque_fragment>`,
    );
  }, []);
  // Fabric gets a soft velvet sheen and wood a thin satin finish; both read far more tactile under the low sun.
  const soft = surface === "fabric" || surface === "curtain";
  const sheenColor = useMemo(() => new THREE.Color(color).lerp(new THREE.Color("#fff1dc"), .55), [color]);
  return <meshPhysicalMaterial sheen={soft ? .85 : 0} sheenRoughness={.72} sheenColor={sheenColor} clearcoat={surface === "wood" ? .22 : 0} clearcoatRoughness={.42} color={tint} map={colorMap} normalMap={surface === "floor" ? undefined : pbr?.normal} normalScale={pbr ? new THREE.Vector2(surface === "wood" ? .12 : .07) : undefined} roughnessMap={surface === "floor" ? undefined : pbr?.roughness} bumpMap={surface === "floor" ? painted?.stylizedWood : pbr ? undefined : maps.bump} bumpScale={surface === "floor" ? .008 : bumpScale} roughness={roughness} metalness={0} envMapIntensity={surface === "floor" ? .16 : .3} onBeforeCompile={stylizeShader} customProgramCacheKey={() => `cozy-painted-pbr-v6-${surface}`} />;
}

function Box({ position, scale, color, rotation = [0, 0, 0], radius = 0.06, surface }: { position: V3; scale: V3; color: string; rotation?: V3; radius?: number; surface?: Surface }) {
  const woodColors = [P.wood, "#a9683e", "#9a6d49", "#b57b4e", "#744829", "#74492f", "#825437", "#7c492f", "#a9764d"];
  const paperColors = [P.cream, "#eadcbf", "#e8d9b9", "#d8ceb3", "#e4d5b5", "#e4d6b8", "#dbc79f", "#d8c39a", "#e7d1ad", "#ead8b8"];
  const resolvedSurface = surface ?? (woodColors.includes(color) ? "wood" : color === P.plaster ? "plaster" : paperColors.includes(color) ? "paper" : "paint");
  return <RoundedBox castShadow receiveShadow position={position} rotation={rotation} args={scale} radius={Math.min(radius, Math.min(...scale) * .45)} smoothness={4}><StylizedMaterial color={color} surface={resolvedSurface} /></RoundedBox>;
}

const woodFurniture = new Set<FurnitureAssetName>(["cabinet_medium", "cabinet_small", "shelf_A_big", "shelf_A_small", "shelf_B_large_decorated", "shelf_B_small_decorated", "table_medium_long", "table_low", "table_small"]);
const fabricFurniture = new Set<FurnitureAssetName>(["armchair_pillows", "chair_A", "chair_C", "chair_stool", "couch_pillows", "pillow_A", "pillow_B", "rug_oval_A"]);

function FurnitureAsset({ name, position, rotation = [0,0,0], scale = [1,1,1], tint }: { name: FurnitureAssetName; position: V3; rotation?: V3; scale?: V3; tint?: string }) {
  const surfaces = useContext(SurfaceTextureContext);
  const detailMap = woodFurniture.has(name) ? surfaces?.stylizedWood : fabricFurniture.has(name) ? surfaces?.fabric : undefined;
  const detailKind = woodFurniture.has(name) ? "wood" : fabricFurniture.has(name) ? "fabric" : "plain";
  const path = furnitureAssetPath(name);
  const { scene } = useGLTF(path);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      // Keep the kit's silhouette, but give large tabletops a furniture-scale edge.
      if (name === "table_low" || name === "table_medium_long") {
        child.geometry = child.geometry.clone();
        const positions = child.geometry.attributes.position;
        const split = name === "table_low" ? .3 : .8;
        const top = name === "table_low" ? .5 : 1;
        const underside = name === "table_low" ? .405 : .91;
        for (let i = 0; i < positions.count; i++) {
          const y = positions.getY(i);
          positions.setY(i, y < split ? y * underside / split : underside + (y - split) * (top - underside) / (top - split));
        }
        child.geometry.computeVertexNormals();
        child.geometry.computeBoundingSphere();
      }
      const source = child.material as THREE.MeshStandardMaterial;
      // Upholstery gets a velvet sheen and wooden pieces a satin coat, matching the procedural surfaces.
      const material = new THREE.MeshPhysicalMaterial({
        map: source.map, color: source.color, normalMap: source.normalMap, vertexColors: source.vertexColors,
        sheen: detailKind === "fabric" ? .8 : 0, sheenRoughness: .7, sheenColor: new THREE.Color(tint ?? "#ffffff").lerp(new THREE.Color("#fff1dc"), .6),
        clearcoat: detailKind === "wood" ? .2 : 0, clearcoatRoughness: .45,
      });
      material.name = source.name;
      child.material = material;
      if (tint) {
        const original = material.color.clone();
        material.color.copy(original.lerp(new THREE.Color(tint), .58));
      }
      material.roughness = detailKind === "fabric" ? .94 : .67;
      material.metalness = 0;
      material.envMapIntensity = detailKind === "fabric" ? .35 : .52;
      material.onBeforeCompile = (shader) => {
        shader.vertexShader = `varying vec3 vKitWorldNormal; varying vec3 vKitWorldPosition;\n${shader.vertexShader}`;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <worldpos_vertex>",
          `#include <worldpos_vertex>\n          vKitWorldNormal = inverseTransformDirection(transformedNormal, viewMatrix);\n          vKitWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
        );
        if (detailMap) shader.uniforms.kitDetailMap = { value: detailMap };
        if (tint) shader.uniforms.kitTint = { value: new THREE.Color(tint) };
        const detailUniform = detailMap ? "uniform sampler2D kitDetailMap;" : "";
        const tintUniform = tint ? "uniform vec3 kitTint;" : "";
        const solidWood = ["table_low", "table_medium_long", "table_small"].includes(name);
        const detailShader = detailMap ? `vec3 kitWeights = pow(abs(normalize(vKitWorldNormal)), vec3(5.0));
          kitWeights /= max(kitWeights.x + kitWeights.y + kitWeights.z, 0.0001);
          vec3 p = vKitWorldPosition * ${detailKind === "wood" ? "vec3(.24, .85, .7)" : "vec3(2.8)"};
          vec3 kitDetail = texture2D(kitDetailMap, p.yz).rgb * kitWeights.x + texture2D(kitDetailMap, p.xz).rgb * kitWeights.y + texture2D(kitDetailMap, p.xy).rgb * kitWeights.z;
          float kitGrain = dot(kitDetail, vec3(.299, .587, .114));
          ${solidWood ? "float kitLumaWood = dot(kitDetail, vec3(.299,.587,.114)); diffuseColor.rgb = mix(vec3(kitLumaWood), kitDetail, .72) * vec3(1.02, .95, .86);" : "diffuseColor.rgb *= mix(.8, 1.18, smoothstep(.08, .48, kitGrain));"}` : "";
        const tintShader = tint ? `float kitLuma = dot(diffuseColor.rgb, vec3(.299,.587,.114));
          float upholstery = smoothstep(.13,.3,kitLuma);
          diffuseColor.rgb = mix(diffuseColor.rgb, kitTint * (.62 + kitLuma * .68), upholstery * .83);` : "";
        shader.fragmentShader = `${detailUniform} ${tintUniform} varying vec3 vKitWorldNormal; varying vec3 vKitWorldPosition;\n${shader.fragmentShader}`;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          `#include <map_fragment>\n${detailShader}\n${tintShader}`,
        );
      };
      material.customProgramCacheKey = () => `kit-furniture-form-v5-${name}-${tint ? "tinted" : "base"}`;
    });
    return clone;
  }, [detailKind, detailMap, scene, tint]);
  useEffect(() => () => model.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    (child.material as THREE.Material).dispose();
    if (name === "table_low" || name === "table_medium_long") child.geometry.dispose();
  }), [model, name]);
  return <primitive object={model} position={position} rotation={rotation} scale={scale}/>;
}

furnitureAssetNames.forEach(name => useGLTF.preload(furnitureAssetPath(name)));

function PaperLabel({ text, position, rotation = [-Math.PI / 2, 0, 0], scale = [.8,.28,1] }: { text: string; position: V3; rotation?: V3; scale?: V3 }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 180;
    const context = canvas.getContext("2d");
    if (context) {
      context.clearRect(0,0,canvas.width,canvas.height);
      context.fillStyle = "#4d3a2d";
      context.font = "600 72px Georgia, serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text,canvas.width/2,canvas.height/2+2);
    }
    const next = new THREE.CanvasTexture(canvas);
    next.colorSpace = THREE.SRGBColorSpace;
    next.anisotropy = 4;
    return next;
  }, [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={position} rotation={rotation} scale={scale}><planeGeometry args={[1,1]}/><meshBasicMaterial map={texture} transparent toneMapped={false} depthWrite={false}/></mesh>;
}

function Hotspot({ name, position, children, active, onFocus }: { name: Exclude<FocusName, "home">; position: V3; children: ReactNode; active: boolean; onFocus: (name: FocusName) => void }) {
  const theatre = useContext(ProjectTheatreContext);
  const group = useRef<THREE.Group>(null);
  const subject = useRef<THREE.Group>(null);
  const auraLight = useRef<THREE.PointLight>(null);
  const selection = useRef({ progress: 0, charge: 0, twist: 0, bank: 0, light: 0, hover: 0 });
  const reducedMotion = useReducedMotionRef();
  const [reduceEffects, setReduceEffects] = useState(false);
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceEffects(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const motion = selection.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeline = gsap.timeline();
    if (reduced) {
      gsap.set(motion, { progress: active ? 1 : 0, charge: 0, twist: 0, bank: 0, light: active ? .5 : 0 });
    } else if (active) {
      // A physical anticipation, one deliberate reveal turn, then a quiet suspended pose.
      timeline.to(motion, { charge: 1, light: .65, duration: CINEMATIC.charge, ease: "power2.in" }, 0)
        .to(motion, { charge: 0, light: 2.8, duration: .18, ease: "power3.out" }, CINEMATIC.charge)
        .to(motion, { progress: 1.075, duration: CINEMATIC.liftEnd - CINEMATIC.charge, ease: "power3.inOut" }, CINEMATIC.charge)
        .to(motion, { twist: name === "skills" ? 0 : Math.PI * 2, bank: name === "skills" ? 0 : -.12, duration: CINEMATIC.liftEnd - CINEMATIC.charge, ease: "power3.inOut" }, CINEMATIC.charge)
        .to(motion, { progress: 1, bank: 0, light: 1.1, duration: CINEMATIC.reveal - CINEMATIC.liftEnd, ease: "sine.inOut" }, CINEMATIC.liftEnd)
        .to(motion, { light: 2.1, duration: .12, ease: "power2.out" }, CINEMATIC.reveal)
        .to(motion, { light: .85, duration: .65, ease: "sine.out" });
    } else {
      setHovered(false);
      // Normalize the completed turn so returning never performs an accidental second spin.
      motion.twist = THREE.MathUtils.euclideanModulo(motion.twist + Math.PI, Math.PI * 2) - Math.PI;
      timeline.to(motion, { progress: 0, charge: 0, twist: 0, bank: 0, light: 0, duration: 1.15, ease: "power3.inOut" });
    }
    return () => { timeline.kill(); };
  }, [active, name, reduceEffects]);
  useFrame(({ clock }, delta) => {
    if (!group.current || !subject.current) return;
    const motion = selection.current;
    const progress = motion.progress;
    const floatWave = reducedMotion.current ? 0 : Math.sin(clock.elapsedTime * 1.35) * progress;
    // Bring each desk object to the same world-space stage, keeping the camera frontal.
    const stage: V3 = name === "projects" ? [.961, 1.18, .3] : name === "about" ? [-.959, 1.4, -.2] : name === "contact" ? [-1.87, 1.6, -.1] : [0, .12, 0];
    const monitor = name === "skills";
    motion.hover = THREE.MathUtils.damp(motion.hover, hovered && !active ? 1 : 0, 10, delta);
    group.current.position.x = stage[0] * progress;
    group.current.position.y = stage[1] * progress + (monitor ? 0 : floatWave * .045 - motion.charge * .06) + motion.hover * .045;
    group.current.position.z = stage[2] * progress;
    subject.current.scale.setScalar(monitor ? 1 : 1 + progress * .08 + motion.hover * .018 - motion.charge * .025);
    subject.current.rotation.x = monitor ? 0 : (name === "contact" ? .68 : name === "about" ? .42 : .12) * progress;
    subject.current.rotation.y = monitor ? 0 : motion.twist + (reducedMotion.current ? 0 : Math.sin(clock.elapsedTime * .52) * .025 * progress);
    subject.current.rotation.z = monitor ? 0 : motion.bank + floatWave * .015;
    if (auraLight.current) auraLight.current.intensity = motion.light * (monitor ? .5 : 2.6);
  });
  const stop = (event: ThreeEvent<PointerEvent | MouseEvent>) => event.stopPropagation();
  const auraY = name === "skills" ? .82 : name === "projects" ? .42 : .08;
  return <group visible={name !== "projects" || !theatre} position={position} onPointerOver={(e) => { stop(e); if(theatre)return; setHovered(true); document.body.style.cursor = "pointer"; }} onPointerOut={() => { setHovered(false); document.body.style.cursor = "default"; }} onClick={(e) => { stop(e); if(!theatre)onFocus(name); }}>
    <group ref={group}>
      <pointLight ref={auraLight} position={[0,auraY,.7]} color={CINEMATIC_COLORS[name].core} intensity={0} distance={4.8} decay={2}/>
      <SelectionVFX active={active} destination={name} reducedMotion={reduceEffects} center={[0,auraY,0]} radius={name === "projects" ? 1.4 : name === "skills" ? .95 : .9}/>
      <group ref={subject}>{children}</group>
    </group>
  </group>;
}

function Plant({ position, scale = 1 }: { position: V3; scale?: number }) {
  const gust = useContext(WindGustContext);
  return <StudioPlant position={position} scale={scale} gust={gust}/>;
}

const dustVertex = `
attribute vec4 seed;
uniform float time;
uniform float pixelRatio;
varying float vGlow;
void main() {
  // Each mote wanders on its own slow Lissajous path instead of the cloud moving as one block.
  vec3 p = position;
  p.x += sin(time * (.11 + seed.x * .09) + seed.y * 6.283) * .22;
  p.y += sin(time * (.07 + seed.z * .06) + seed.x * 6.283) * .16 + mod(time * (.012 + seed.w * .01) + seed.y, 1.0) * .25;
  p.z += cos(time * (.09 + seed.w * .08) + seed.z * 6.283) * .2;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  // Motes glint as they turn, like real dust catching low sun.
  vGlow = .35 + .65 * pow(.5 + .5 * sin(time * (.8 + seed.x * 1.6) + seed.w * 40.0), 3.0);
  gl_PointSize = (2.2 + seed.z * 2.6) * pixelRatio * (9.0 / -mv.z);
}`;

const dustFragment = `
uniform vec3 color;
uniform float opacity;
varying float vGlow;
void main() {
  float d = length(gl_PointCoord - .5) * 2.0;
  float soft = smoothstep(1.0, 0.0, d);
  gl_FragColor = vec4(color * soft * soft * vGlow * opacity, 1.0);
}`;

function WarmDust() {
  const material = useRef<THREE.ShaderMaterial>(null);
  const reducedMotion = useReducedMotionRef();
  const count = 140;
  const { positions, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 4);
    const rand = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
    for (let i = 0; i < count; i++) {
      // Weight the motes toward the sunlit band between the balcony door and the desk.
      const inBeam = i % 3 !== 0;
      positions[i * 3] = inBeam ? -2 + rand(i) * 4.5 : -5.5 + rand(i) * 11;
      positions[i * 3 + 1] = .5 + rand(i + 1000) * 4.4;
      positions[i * 3 + 2] = inBeam ? -4 + rand(i + 2000) * 5.5 : -4 + rand(i + 2000) * 7.5;
      seeds.set([rand(i + 3000), rand(i + 4000), rand(i + 5000), rand(i + 6000)], i * 4);
    }
    return { positions, seeds };
  }, []);
  const uniforms = useMemo(() => ({ time: { value: 0 }, pixelRatio: { value: 1 }, color: { value: new THREE.Color("#ffd9a0") }, opacity: { value: .55 } }), []);
  useFrame(({ clock, gl }) => {
    if (!material.current) return;
    material.current.uniforms.pixelRatio.value = gl.getPixelRatio();
    if (!reducedMotion.current) material.current.uniforms.time.value = clock.elapsedTime;
  });
  return <points frustumCulled={false}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /><bufferAttribute attach="attributes-seed" args={[seeds, 4]} /></bufferGeometry>
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={dustVertex} fragmentShader={dustFragment} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false}/>
  </points>;
}

function FloorBoards() {
  const boardColors = ["#a8875f", "#9e7d58", "#b08f68", "#a2815c"];
  return <group>
    {Array.from({length:16}).map((_, row) => {
      const z = -5.72 + row * .66;
      return Array.from({length:4}).map((_, column) =>
        <Box key={`plank-${row}-${column}`} position={[-4.575 + column * 3.05,.028,z]} scale={[3.025,.14,.644]} color={boardColors[(row + column * 3) % 4]} radius={.012} surface="floor"/>
      );
    })}
  </group>;
}

function Poster({ lines, position, rotation = [0,0,0], size = [1.2, 1.6] }: { lines: string[]; position: V3; rotation?: V3; size?: [number, number] }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = Math.round(512 * size[1] / size[0]);
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#efe2c4";
    context.fillRect(0, 0, canvas.width, canvas.height);
    // Slight paper mottling so the print does not read as a flat UI card.
    for (let i = 0; i < 900; i++) {
      context.fillStyle = `rgba(120,90,55,${Math.random() * .05})`;
      context.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }
    context.fillStyle = "#3f3326";
    context.textAlign = "center";
    context.textBaseline = "middle";
    const lineHeight = canvas.height * .62 / lines.length;
    const fontSize = Math.min(lineHeight * .78, 92);
    context.font = `800 ${fontSize}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
    lines.forEach((line, index) => {
      const y = canvas.height * .18 + lineHeight * (index + .5);
      context.save(); context.translate(canvas.width / 2, y); context.scale(.82, 1);
      context.fillText(line, 0, 0, canvas.width * 1.05);
      context.restore();
    });
    // Small leaf mark, a nod to the cozy-game emblem without copying it.
    context.fillStyle = "#6f8a55";
    context.save(); context.translate(canvas.width / 2, canvas.height * .88); context.rotate(-.5);
    context.beginPath(); context.ellipse(0, 0, 26, 15, 0, 0, Math.PI * 2); context.fill();
    context.strokeStyle = "#efe2c4"; context.lineWidth = 3; context.beginPath(); context.moveTo(-22, 0); context.lineTo(22, 0); context.stroke();
    context.restore();
    const next = new THREE.CanvasTexture(canvas);
    next.colorSpace = THREE.SRGBColorSpace;
    next.anisotropy = 8;
    return next;
  }, [lines, size]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <group position={position} rotation={rotation}>
    <Box position={[0,0,0]} scale={[size[0] + .16, size[1] + .16, .08]} color="#7a4f31" radius={.025} surface="wood"/>
    <mesh position={[0,0,.045]} receiveShadow><planeGeometry args={size}/><meshStandardMaterial map={texture} roughness={.92}/></mesh>
  </group>;
}

/** Wall, ceiling and window shell that turns the open pavilion into the cozy room of the reference. */
const WINDOW = { left: -2.45, right: 2.45, top: 5.15, wall: -4.3 };

function Architecture() {
  const wallZ = WINDOW.wall - .14;
  const wall = "#efd2ac";
  return <group>
    <Box position={[0,-.15,-.45]} scale={[13.2,.22,10.7]} color="#70452f" radius={.03} surface="floor"/>
    <Box position={[0,.03,4.78]} scale={[13.25,.36,.22]} color="#6f432d" radius={.05} surface="wood"/>
    {/* Back wall around the balcony door */}
    <Box position={[(WINDOW.left - 6.45) / 2,3.05,wallZ]} scale={[WINDOW.left + 6.45,6.3,.28]} color={wall} radius={.02} surface="plaster"/>
    <Box position={[(WINDOW.right + 6.45) / 2,3.05,wallZ]} scale={[6.45 - WINDOW.right,6.3,.28]} color={wall} radius={.02} surface="plaster"/>
    <Box position={[0,(WINDOW.top + 6.2) / 2,wallZ]} scale={[WINDOW.right - WINDOW.left + .1,6.2 - WINDOW.top,.28]} color={wall} radius={.02} surface="plaster"/>
    {/* Side walls */}
    <Box position={[-6.32,3.05,.3]} scale={[.26,6.3,9.4]} color={wall} radius={.02} surface="plaster"/>
    <Box position={[6.32,3.05,.3]} scale={[.26,6.3,9.4]} color={wall} radius={.02} surface="plaster"/>
    {/* Ceiling and timber beams */}
    <Box position={[0,6.12,.2]} scale={[12.9,.18,9.6]} color="#d9c19c" radius={.02} surface="plaster"/>
    <Box position={[0,5.88,-4.05]} scale={[12.6,.32,.34]} color="#8b5534" radius={.05} surface="wood"/>
    <Box position={[0,5.8,3.78]} scale={[12.6,.3,.3]} color="#7f5233" radius={.045} surface="wood"/>
    {[-6.05,6.05].map(x=><Box key={x} position={[x,5.84,-.2]} scale={[.36,.38,8.4]} color="#75462e" radius={.055} surface="wood"/>)}
    {[-3.0,-1.2,.6,2.4].map((z,index)=><Box key={z} position={[0,5.9,z]} scale={[12.2,.24,.3]} color={index%2?"#a5683f":"#8e5735"} radius={.04} surface="wood"/>)}
    {/* Corner timber posts and skirting */}
    {[-6.08,6.08].map(x=><Box key={`post-${x}`} position={[x,2.95,-4.08]} scale={[.3,5.9,.3]} color="#8b5534" radius={.05} surface="wood"/>)}
    {[-1,1].map(side=><Box key={`skirt-${side}`} position={[side * 6.16,.18,.3]} scale={[.06,.2,9.3]} color="#7d4f31" radius={.02} surface="wood"/>)}
    <Box position={[(WINDOW.left - 6.2) / 2,.18,WINDOW.wall + .03]} scale={[WINDOW.left + 6.2,.2,.06]} color="#7d4f31" radius={.02} surface="wood"/>
    <Box position={[(WINDOW.right + 6.2) / 2,.18,WINDOW.wall + .03]} scale={[6.2 - WINDOW.right,.2,.06]} color="#7d4f31" radius={.02} surface="wood"/>
    {/* Door frame */}
    {[WINDOW.left, WINDOW.right].map(x=><Box key={`jamb-${x}`} position={[x,WINDOW.top / 2,WINDOW.wall]} scale={[.2,WINDOW.top + .1,.42]} color="#8f5a36" radius={.035} surface="wood"/>)}
    <Box position={[0,WINDOW.top,WINDOW.wall]} scale={[WINDOW.right - WINDOW.left + .4,.24,.44]} color="#8f5a36" radius={.04} surface="wood"/>
    <Box position={[0,.08,WINDOW.wall]} scale={[WINDOW.right - WINDOW.left,.1,.46]} color="#7d4f31" radius={.03} surface="wood"/>
    <Poster lines={["DISCIPLINE", "CONSISTENCY", "CURIOSITY"]} position={[-6.17,3.0,-.9]} rotation={[0,Math.PI / 2,0]} size={[1.25,1.5]}/>
    <Poster lines={["PROGRESS", "NOT", "PERFECTION"]} position={[6.17,3.05,-1.4]} rotation={[0,-Math.PI / 2,0]} size={[1.15,1.5]}/>
  </group>;
}

function gingham() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#e9e3c6";
  context.fillRect(0, 0, 128, 128);
  context.fillStyle = "rgba(108,140,88,.55)";
  for (let i = 0; i < 128; i += 32) { context.fillRect(i, 0, 16, 128); context.fillRect(0, i, 128, 16); }
  context.fillStyle = "rgba(82,112,66,.45)";
  for (let x = 0; x < 128; x += 32) for (let y = 0; y < 128; y += 32) context.fillRect(x, y, 16, 16);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 22);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Gingham drape with real folds, gathered by a tie-back like the curtain in the reference. */
function DrapedCurtain({ position, width = 1.05, height = 5.0, tieAt = 2.15, side = 1 }: { position: V3; width?: number; height?: number; tieAt?: number; side?: number }) {
  const geometry = useMemo(() => {
    const next = new THREE.PlaneGeometry(width, height, 48, 60);
    const positions = next.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i) + height / 2;
      // Gather toward the wall-side edge around the tie, flaring out above and below it.
      const gather = THREE.MathUtils.lerp(.38, 1, THREE.MathUtils.smoothstep(Math.abs(y - tieAt), 0, 1.6));
      const edge = side * width / 2;
      const nx = edge + (x - edge) * gather;
      const folds = Math.sin((x / width) * Math.PI * 9) * .07 * (1.25 - gather * .45) + Math.sin((x / width) * Math.PI * 3.3 + 1.1) * .035;
      positions.setXYZ(i, nx, y - height / 2, folds);
    }
    next.computeVertexNormals();
    return next;
  }, [height, side, tieAt, width]);
  const texture = useMemo(gingham, []);
  useEffect(() => () => { geometry.dispose(); texture.dispose(); }, [geometry, texture]);
  return <group position={position}>
    <mesh geometry={geometry} castShadow receiveShadow position={[0,height / 2,0]}>
      <meshPhysicalMaterial map={texture} side={THREE.DoubleSide} roughness={.9} sheen={.8} sheenRoughness={.6} sheenColor="#fff4dc"/>
    </mesh>
    <mesh position={[side * width * .16,tieAt,.09]} rotation={[0,0,.15 * side]}><torusGeometry args={[.17,.04,10,24]}/><meshPhysicalMaterial color="#c9b47c" roughness={.8} sheen={.6}/></mesh>
    <mesh position={[0,height + .04,.04]} rotation={[0,0,Math.PI / 2]}><cylinderGeometry args={[.035,.035,width + .6,16]}/><meshStandardMaterial color="#5f3d27" roughness={.5}/></mesh>
  </group>;
}

function Curtain({ x, flip = 1 }: { x: number; flip?: number }) {
  return <group position={[x,3.25,.7]} rotation={[0,0,flip*.025]}><Box position={[0,0,0]} scale={[.78,4.2,.2]} color="#7f946c" radius={.12} surface="curtain"/>{[-.27,-.09,.09,.27].map((v,i)=><Box key={v} position={[v,0,.115]} scale={[.055,4.02,.045]} color={i%2?"#d7cf9b":"#aeb780"} radius={.025} surface="curtain"/>)}{[-1.48,-.82,-.16,.5,1.16].map((y,i)=><Box key={y} position={[0,y,.135]} scale={[.73,.075,.035]} color={i%2?"#687e5d":"#d2c58d"} radius={.025} surface="curtain"/>)}{[-.26,0,.26].map((v,i)=><Box key={`fold-${v}`} position={[v,-.05,.18]} scale={[.12,3.96,.075]} color={i===1?"#8ca074":"#718665"} radius={.055} surface="curtain"/>)}<Box position={[flip*.18,-.35,.24]} scale={[.5,.16,.22]} color="#d2b77d" radius={.06} surface="fabric"/></group>;
}

function Exterior() {
  const reference = useTexture(asset("/reference/target-homepage.png"));
  const backdrop = useMemo(() => {
    const texture = reference.clone();
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(.315, .47);
    texture.offset.set(.318, .465);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  }, [reference]);
  useEffect(() => () => backdrop.dispose(), [backdrop]);
  return <group position={[0,0,-4.52]}>
    <mesh position={[0,3.15,-.5]}>
      <planeGeometry args={[6.4,4.8]}/>
      <shaderMaterial
        uniforms={{
          topColor: { value: new THREE.Color("#cc5e43") },
          horizonColor: { value: new THREE.Color("#ffbd58") },
          lowerColor: { value: new THREE.Color("#e56f3e") },
        }}
        vertexShader={`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`}
        fragmentShader={`
          uniform vec3 topColor;
          uniform vec3 horizonColor;
          uniform vec3 lowerColor;
          varying vec2 vUv;
          float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          void main(){
            float horizonGlow=exp(-pow((vUv.y-.43)*4.8,2.0));
            vec3 base=mix(lowerColor,topColor,smoothstep(.05,1.0,vUv.y));
            base=mix(base,horizonColor,horizonGlow*.52);
            float sunWash=exp(-distance(vUv,vec2(.5,.53))*5.0)*.1;
            float grain=(hash(gl_FragCoord.xy)-.5)*.018;
            gl_FragColor=vec4(base+sunWash+grain,1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `}
      />
    </mesh>
    <mesh position={[0,3.88,-.3]}><planeGeometry args={[3.2,3.2]}/><shaderMaterial transparent depthWrite={false} toneMapped={false} uniforms={{ glowColor: { value: new THREE.Color("#ffd87d") } }} vertexShader={`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`} fragmentShader={`uniform vec3 glowColor; varying vec2 vUv; void main(){float d=distance(vUv,vec2(.5));float a=smoothstep(.5,0.0,d)*.42;gl_FragColor=vec4(glowColor,a);}`}/></mesh>
    <mesh position={[0,3.88,-.26]}><circleGeometry args={[.46,32]}/><meshBasicMaterial color="#ffe08a" toneMapped={false}/></mesh>
    <mesh position={[0,3.14,.24]}><planeGeometry args={[6.05,4.72]}/><meshBasicMaterial map={backdrop} color="#fff3de" toneMapped={false}/></mesh>
    <Box position={[0,1.05,.9]} scale={[6.5,.16,.18]} color={P.dark}/>{[-2.55,-1.25,0,1.25,2.55].map(x=><Box key={x} position={[x,.65,.9]} scale={[.14,.95,.14]} color={P.dark}/>)}
    <Box position={[-3.12,2.9,.82]} scale={[.2,4.5,.22]} color={P.dark}/><Box position={[3.12,2.9,.82]} scale={[.2,4.5,.22]} color={P.dark}/>
    <Curtain x={-2.78}/><Curtain x={2.78} flip={-1}/>
  </group>;
}

function LandscapeDepth() {
  return <FloorBoards/>;
}

function ExteriorPine({ position, scale = 1, color = "#365d42" }: { position: V3; scale?: number; color?: string }) {
  return <group position={position} scale={scale}><mesh position={[0,-.18,0]}><cylinderGeometry args={[.07,.09,.72,12]}/><meshStandardMaterial color="#68472e" roughness={1}/></mesh>{[0,.32,.62].map((y,index)=><mesh key={y} position={[0,y,0]}><coneGeometry args={[.5-index*.08,.78,14]}/><meshStandardMaterial color={index===1?"#456b47":color} roughness={1}/></mesh>)}</group>;
}

function ExteriorRock({ position, scale = 1, color = "#8f674e" }: { position: V3; scale?: number; color?: string }) {
  return <mesh position={position} scale={[scale,scale*.62,scale*.76]} rotation={[.08,.2,.12]}><dodecahedronGeometry args={[.38,0]}/><meshBasicMaterial color={color}/></mesh>;
}

function AnimatedExterior() {
  const clouds = useRef<THREE.Group>(null);
  const pines = useRef<THREE.Group>(null);
  const water = useRef<THREE.ShaderMaterial>(null);
  useFrame(({clock}) => {
    const time = clock.elapsedTime;
    if (clouds.current) clouds.current.position.x = Math.sin(time * .055) * .42;
    if (pines.current) pines.current.rotation.z = Math.sin(time * .38) * .006;
    if (water.current) water.current.uniforms.time.value = time;
  });
  const distantHills: Array<[number,number,number,number,string]> = [[-5.2,2.48,1.7,.72,"#a7857b"],[-3.75,2.62,1.62,.8,"#9a817d"],[-2.4,2.58,1.55,.72,"#a7857b"],[-1.12,2.72,1.48,.82,"#9a817d"],[.12,2.66,1.38,.68,"#b08b7c"],[1.32,2.72,1.55,.84,"#907b78"],[2.55,2.58,1.42,.7,"#a47f71"],[3.85,2.62,1.65,.8,"#917a77"],[5.25,2.5,1.72,.74,"#aa8272"]];
  const nearHills: Array<[number,number,number,number,string]> = [[-5.2,2.0,1.55,.66,"#526c58"],[-3.85,2.08,1.5,.7,"#627962"],[-2.55,2.12,1.35,.64,"#5c735d"],[-1.55,2.05,1.28,.56,"#6e8165"],[1.45,2.08,1.3,.58,"#667a61"],[2.5,2.12,1.38,.66,"#536d57"],[3.82,2.04,1.45,.66,"#60775e"],[5.15,2.0,1.55,.7,"#4f6955"]];
  const ridgePeaks: Array<[number,number,number,number,string]> = [[-5.05,2.72,1.0,.95,"#89736f"],[-3.92,2.84,1.08,1.08,"#7f7272"],[-2.18,2.78,.9,.92,"#8d7772"],[-1.2,2.88,1.05,1.06,"#7e7474"],[-.12,2.72,.82,.78,"#a17f76"],[1.02,2.9,1.08,1.08,"#817272"],[2.05,2.76,.92,.88,"#92766d"],[3.75,2.84,1.08,1.02,"#81716e"],[5.0,2.72,1.02,.94,"#94746c"]];
  return <group position={[0,0,-4.52]}>
    <mesh position={[0,2.55,-.72]}><planeGeometry args={[100,20]}/><shaderMaterial uniforms={{topColor:{value:new THREE.Color("#d87869")},horizonColor:{value:new THREE.Color("#ffd28b")},lowerColor:{value:new THREE.Color("#ef9c70")}}} vertexShader={`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`} fragmentShader={`uniform vec3 topColor;uniform vec3 horizonColor;uniform vec3 lowerColor;varying vec2 vUv;void main(){float glow=exp(-pow((vUv.y-.42)*4.6,2.0));vec3 color=mix(lowerColor,topColor,smoothstep(.08,1.0,vUv.y));color=mix(color,horizonColor,glow*.56);gl_FragColor=vec4(color,1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`}/></mesh>
    <group ref={clouds} position={[0,0,-.6]}>{[[-1.55,4.05,.42],[1.45,3.72,.5],[2.25,4.2,.34]].map(([x,y,s],i)=><group key={i} position={[x,y,0]} scale={s}>{[-.42,-.1,.22,.5].map((offset,j)=><mesh key={offset} position={[offset,(j%2)*.13,0]} scale={[1.25,.62,1]}><sphereGeometry args={[.42,14,9]}/><meshBasicMaterial color={i===1?"#f4b38c":"#f8c9a0"} transparent opacity={.7}/></mesh>)}</group>)}</group>
    <mesh position={[.45,3.63,-.5]}><circleGeometry args={[.43,36]}/><meshBasicMaterial color="#ffe7a0" toneMapped={false}/></mesh>
    <group position={[0,0,-.42]}>{distantHills.map(([x,y,sx,sy,color],i)=><mesh key={`far-${i}`} position={[x,y,0]} scale={[sx,sy,.7]}><sphereGeometry args={[1,20,12]}/><meshBasicMaterial color={color}/></mesh>)}</group>
    <group position={[0,0,-.38]}>{ridgePeaks.map(([x,y,sx,sy,color],i)=><mesh key={`ridge-${i}`} position={[x,y,0]} scale={[sx,sy,.65]}><coneGeometry args={[.72,1.5,5]}/><meshBasicMaterial color={color}/></mesh>)}</group>
    <group position={[0,0,-.34]}>{nearHills.map(([x,y,sx,sy,color],i)=><mesh key={`near-${i}`} position={[x,y,0]} scale={[sx,sy,.68]}><sphereGeometry args={[1,18,10]}/><meshBasicMaterial color={color}/></mesh>)}</group>
    <mesh position={[0,1.56,-.25]}><planeGeometry args={[10.8,1.5]}/><shaderMaterial ref={water} uniforms={{time:{value:0},deep:{value:new THREE.Color("#668b8f")},light:{value:new THREE.Color("#f2bd83")}}} vertexShader={`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`} fragmentShader={`uniform float time;uniform vec3 deep;uniform vec3 light;varying vec2 vUv;void main(){float w=sin(vUv.y*48.0+time*.7)*.5+.5;float w2=sin(vUv.x*31.0-time*.42)*.5+.5;float line=smoothstep(.76,.98,w*w2);vec3 c=mix(deep,light,.32+vUv.y*.32);c+=line*.14;gl_FragColor=vec4(c,1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`}/></mesh>
    {[1.28,1.46,1.64,1.82].map((y,i)=><mesh key={`reflection-${y}`} position={[.18,y,-.18]}><planeGeometry args={[.62-i*.1,.035]}/><meshBasicMaterial color="#ffe3aa" transparent opacity={.72-i*.12}/></mesh>)}
    <group position={[-1.95,1.35,-.02]}><ExteriorRock position={[-.42,.02,0]} scale={1.28}/><ExteriorRock position={[-.05,.1,.02]} scale={1.05} color="#a47352"/><ExteriorRock position={[.34,.03,.04]} scale={.92} color="#7f6853"/><ExteriorPine position={[-.28,.42,.04]} scale={.46} color="#587552"/><ExteriorPine position={[.22,.35,.06]} scale={.34} color="#6b825e"/></group>
    <group position={[1.98,1.34,-.02]}><ExteriorRock position={[-.34,.03,.04]} scale={.94} color="#856650"/><ExteriorRock position={[.08,.11,.02]} scale={1.12} color="#9d704f"/><ExteriorRock position={[.46,.01,0]} scale={1.24}/><ExteriorPine position={[-.18,.38,.05]} scale={.36} color="#627c58"/><ExteriorPine position={[.32,.44,.04]} scale={.48} color="#4e704d"/></group>
    <group position={[0,0,.02]}><ExteriorPine position={[-.68,1.82,0]} scale={.25} color="#718967"/><ExteriorPine position={[-.38,1.88,0]} scale={.18} color="#78906d"/><ExteriorPine position={[.42,1.9,0]} scale={.19} color="#708966"/><ExteriorPine position={[.72,1.82,0]} scale={.25} color="#65805f"/></group>
    <group ref={pines} position={[0,0,.12]}><ExteriorPine position={[-2.68,2.02,0]} scale={1.15}/><ExteriorPine position={[-2.12,1.76,.04]} scale={.82} color="#4c714c"/><ExteriorPine position={[-1.58,1.58,.08]} scale={.58} color="#5a7a55"/><ExteriorPine position={[-.98,1.72,.04]} scale={.46} color="#617e5b"/><ExteriorPine position={[1.02,1.72,.04]} scale={.48} color="#5d7d59"/><ExteriorPine position={[1.62,1.62,.08]} scale={.62} color="#557750"/><ExteriorPine position={[2.15,1.82,.04]} scale={.86} color="#426849"/><ExteriorPine position={[2.7,2.08,0]} scale={1.18}/></group>
    <group position={[-2.1,1.18,.2]}>{[-.38,-.1,.18,.46].map((x,i)=><mesh key={x} position={[x,(i%2)*.08,0]} scale={[1.2,.68,.9]}><sphereGeometry args={[.31,20,14]}/><meshStandardMaterial color={i%2?"#708052":"#61714b"} roughness={1}/></mesh>)}</group>
    <group position={[2.15,1.2,.2]}>{[-.38,-.1,.18,.46].map((x,i)=><mesh key={x} position={[x,(i%2)*.08,0]} scale={[1.2,.68,.9]}><sphereGeometry args={[.31,20,14]}/><meshStandardMaterial color={i%2?"#6c7c50":"#5d714c"} roughness={1}/></mesh>)}</group>
    <Box position={[0,1.05,.9]} scale={[11.25,.16,.18]} color={P.dark}/>{[-5,-3.35,-1.68,0,1.68,3.35,5].map(x=><Box key={x} position={[x,.65,.9]} scale={[.14,.95,.14]} color={P.dark}/>) }
  </group>;
}

function CinematicExteriorBackdrop() {
  const panoramaSource = useTexture(asset("/textures/exterior-sunrise-v2.png"));
  const panorama = useMemo(() => {
    const texture = panoramaSource.clone();
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 16;
    texture.needsUpdate = true;
    return texture;
  }, [panoramaSource]);
  const panoramaTexel = useMemo(() => new THREE.Vector2(1 / 2560, 1 / 1440), []);
  const panoramaGeometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(25.5,14.34,72,28);
    const positions = geometry.attributes.position;
    for (let index=0; index<positions.count; index++) {
      const x = positions.getX(index);
      const normalized = Math.abs(x) / 12.75;
      positions.setZ(index, Math.pow(normalized,1.8) * 1.7);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }, []);
  const backdrop = useRef<THREE.Group>(null);
  const panoramaLayer = useRef<THREE.Group>(null);
  const panoramaMaterial = useRef<THREE.ShaderMaterial>(null);
  const waterLight = useRef<THREE.ShaderMaterial>(null);
  const reducedMotion = useRef(false);

  useEffect(() => () => { panorama.dispose(); panoramaGeometry.dispose(); }, [panorama, panoramaGeometry]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      reducedMotion.current = media.matches;
      if (panoramaMaterial.current) panoramaMaterial.current.uniforms.motionStrength.value = media.matches ? 0 : 1;
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useFrame(({ clock, camera }) => {
    const time = clock.elapsedTime;
    if (backdrop.current) {
      const breathing = reducedMotion.current ? 0 : Math.sin(time * .045) * .012;
      backdrop.current.position.x = breathing + THREE.MathUtils.clamp(camera.position.x * .006,-.045,.045);
      backdrop.current.rotation.y = THREE.MathUtils.clamp(camera.position.x * -.0012,-.007,.007);
    }
    if (panoramaLayer.current) {
      panoramaLayer.current.position.x = (camera.position.x + .5) * .48;
      panoramaLayer.current.position.y = (camera.position.y - 5.3) * .42;
      panoramaLayer.current.position.z = (camera.position.z - 10.0) * .86;
    }
    if (panoramaMaterial.current) panoramaMaterial.current.uniforms.time.value = time;
    if (waterLight.current) waterLight.current.uniforms.time.value = reducedMotion.current ? 0 : time;
  });

  return <group ref={backdrop} position={[0,0,-5.6]}>
    <group ref={panoramaLayer}>
      <mesh position={[0,2.6,-.76]}>
        <primitive object={panoramaGeometry} attach="geometry"/>
        <shaderMaterial
          ref={panoramaMaterial}
          toneMapped={false}
          uniforms={{ map: { value: panorama }, texelSize: { value: panoramaTexel }, time: { value: 0 }, motionStrength: { value: 1 } }}
          vertexShader={`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`}
          fragmentShader={`uniform sampler2D map;uniform vec2 texelSize;uniform float time;uniform float motionStrength;varying vec2 vUv;void main(){vec2 sampleUv=vUv;float edge=smoothstep(.2,.44,abs(vUv.x-.5));float canopy=edge*smoothstep(.18,.9,vUv.y);float wind=(sin(time*.72+vUv.y*10.5+vUv.x*6.0)+sin(time*.41+vUv.y*18.0)*.38)*.0022;sampleUv.x+=wind*canopy*motionStrength;float outerSky=smoothstep(.13,.38,abs(vUv.x-.5))*smoothstep(.68,.9,vUv.y);sampleUv.x+=sin(time*.075+vUv.y*3.0)*.0012*outerSky*motionStrength;float waterCenter=(1.0-smoothstep(.12,.42,abs(vUv.x-.5)))*(1.0-smoothstep(.5,.68,vUv.y))*smoothstep(.03,.28,vUv.y);sampleUv.y+=sin(vUv.x*62.0+time*.55)*.00125*waterCenter*motionStrength;sampleUv.x+=sin(vUv.y*76.0-time*.32)*.0008*waterCenter*motionStrength;sampleUv=clamp(sampleUv,vec2(.002),vec2(.998));vec3 center=texture2D(map,sampleUv).rgb;vec3 neighborhood=(texture2D(map,sampleUv+vec2(texelSize.x,0.0)).rgb+texture2D(map,sampleUv-vec2(texelSize.x,0.0)).rgb+texture2D(map,sampleUv+vec2(0.0,texelSize.y)).rgb+texture2D(map,sampleUv-vec2(0.0,texelSize.y)).rgb)*.25;float detailMask=1.0-smoothstep(.76,.98,vUv.y);vec3 sharpened=clamp(center+(center-neighborhood)*.24*detailMask,0.0,1.0);gl_FragColor=vec4(sharpened*.9,1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`}
        />
      </mesh>
      <mesh position={[.15,1.55,-.68]}>
        <planeGeometry args={[5.2,2.25]}/>
        <shaderMaterial
          ref={waterLight}
          transparent
          depthWrite={false}
          toneMapped={false}
          uniforms={{ time: { value: 0 }, glow: { value: new THREE.Color("#ffe5a7") } }}
          vertexShader={`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`}
          fragmentShader={`uniform float time;uniform vec3 glow;varying vec2 vUv;void main(){float taper=1.0-smoothstep(.15,.5,abs(vUv.x-.5));float ripple=sin(vUv.y*74.0+sin(vUv.x*19.0-time*.18)*2.0-time*.72)*.5+.5;float broken=sin(vUv.x*53.0+time*.31)*.5+.5;float line=smoothstep(.86,.99,ripple)*smoothstep(.35,.8,broken);float fade=smoothstep(.02,.3,vUv.y)*(1.0-smoothstep(.72,1.0,vUv.y));gl_FragColor=vec4(glow,line*taper*fade*.22);}`}
        />
      </mesh>
    </group>
    <group position={[0,0,.25]}>
      <ExteriorRock position={[-5.6,.7,.1]} scale={1.8} color="#78624d"/>
      <ExteriorPine position={[-5.45,1.48,.12]} scale={1.7} color="#355b40"/>
      <ExteriorPine position={[-4.72,1.45,.02]} scale={1.08} color="#4b714d"/>
      <ExteriorRock position={[5.62,.72,.1]} scale={1.85} color="#84624c"/>
      <ExteriorPine position={[5.48,1.52,.12]} scale={1.74} color="#345a40"/>
      <ExteriorPine position={[4.7,1.42,.02]} scale={1.02} color="#527351"/>
    </group>
    <Box position={[0,1.05,.9]} scale={[11.25,.16,.18]} color={P.dark}/>
    {[-5,-3.35,-1.68,0,1.68,3.35,5].map(x=><Box key={x} position={[x,.65,.9]} scale={[.14,.95,.14]} color={P.dark}/>) }
  </group>;
}

function LandscapeFoliage() {
  const trees: Array<[number,number,number,number,string]> = [[-2.72,2.05,-4.22,1.05,"#365d42"],[-2.18,1.72,-4.18,.78,"#4b714d"],[-1.72,1.55,-4.2,.58,"#587955"],[1.72,1.58,-4.2,.62,"#547851"],[2.18,1.78,-4.18,.82,"#3f6747"],[2.72,2.08,-4.2,1.08,"#355b40"]];
  return <group>
    {trees.map(([x,y,z,s,color])=><group key={`${x}-${y}`} position={[x,y,z]} scale={s}><Box position={[0,-.5,0]} scale={[.11,1.05,.11]} color="#67452f"/>{[0,.38,.72].map((v,j)=><mesh key={v} castShadow position={[0,v,0]}><coneGeometry args={[.58-j*.07,.9,14]}/><meshStandardMaterial color={j===1?P.green:color} roughness={1}/></mesh>)}</group>)}
    <group position={[-2.2,.95,-4.08]}>{[-.42,-.12,.18,.48].map((x,i)=><mesh key={x} position={[x,(i%2)*.08,0]} scale={[1.15,.72,.9]}><sphereGeometry args={[.34,20,14]}/><meshStandardMaterial color={i%2?"#6d7651":"#7e6b48"} roughness={1}/></mesh>)}</group>
    <group position={[2.25,.98,-4.08]}>{[-.4,-.1,.2,.5].map((x,i)=><mesh key={x} position={[x,(i%2)*.07,0]} scale={[1.1,.7,.9]}><sphereGeometry args={[.33,20,14]}/><meshStandardMaterial color={i%2?"#68754e":"#796a48"} roughness={1}/></mesh>)}</group>
    {[1.25,1.5,1.72,1.92].map((y,i)=><mesh key={y} position={[0,y,-4.36]}><planeGeometry args={[.62-i*.1,.045]}/><meshBasicMaterial color="#ffe1a1" transparent opacity={.65-i*.1}/></mesh>)}
  </group>;
}

function BalconyDetails() {
  const leaves: Array<[number,number,number]> = [[-.28,.72,-.08],[-.12,.9,.02],[.08,.82,.06],[.27,.68,-.03],[0,1.05,0]];
  return <group>
    <Plant position={[-1.0,.1,-5.05]} scale={1.35}/>
    {/* Watering can on the balcony boards */}
    <group position={[1.05,.1,-5.0]} rotation={[0,-.5,0]}>
      <mesh castShadow position={[0,.22,0]}><cylinderGeometry args={[.2,.23,.44,32]}/><meshPhysicalMaterial color="#5f8a7a" roughness={.45} clearcoat={.5}/></mesh>
      <mesh castShadow position={[.3,.3,0]} rotation={[0,0,-.9]}><cylinderGeometry args={[.025,.04,.5,14]}/><meshPhysicalMaterial color="#5f8a7a" roughness={.45} clearcoat={.5}/></mesh>
      <mesh castShadow position={[.5,.47,0]} rotation={[0,0,-.9]}><cylinderGeometry args={[.06,.03,.08,16]}/><meshPhysicalMaterial color="#4f7566" roughness={.45}/></mesh>
      <mesh castShadow position={[-.05,.5,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.15,.022,10,28,Math.PI]}/><meshPhysicalMaterial color="#4f7566" roughness={.45}/></mesh>
    </group>
  </group>;
}

function CentralTable({ active, onFocus }: { active: FocusName; onFocus: (name: FocusName) => void }) {
  return <group position={[0,0,1.2]}><FurnitureAsset name="table_low" position={[0,.02,0]} scale={[2.23,2.32,1.7]}/>
    <Hotspot name="contact" position={[1.88,1.2,.12]} active={active==="contact"} onFocus={onFocus}><group rotation={[0,-.12,0]} scale={[1.12,1,1.12]}><ContactPhone/></group></Hotspot>
    <Plant position={[.38,1.2,-.48]} scale={.78}/>
  </group>;
}

function TableDressing({ active, onFocus }: { active: FocusName; onFocus: (name: FocusName) => void }) {
  const layers = ["#4f6e75", "#bd6548", "#d59b55", "#738a69", "#b95743", "#d7b578"];
  const projectStack = useRef<THREE.Group>(null);
  const projectLid = useRef<THREE.Group>(null);
  const projectLayers = useRef<Array<THREE.Group | null>>([]);
  const reducedMotion = useReducedMotionRef();
  useFrame(({ clock }, delta) => {
    const projectsActive = active === "projects" && !reducedMotion.current;
    const time = clock.elapsedTime;
    if (projectStack.current) {
      projectStack.current.rotation.y = THREE.MathUtils.damp(projectStack.current.rotation.y, -.08 + (projectsActive ? Math.sin(time * .7) * .035 : 0), 6, delta);
      projectStack.current.rotation.z = THREE.MathUtils.damp(projectStack.current.rotation.z, projectsActive ? -.014 : 0, 6, delta);
    }
    projectLayers.current.forEach((layer, index) => {
      if (!layer) return;
      layer.position.y = THREE.MathUtils.damp(layer.position.y, index * .105 + (projectsActive ? index * .045 : 0), 7, delta);
      layer.rotation.z = THREE.MathUtils.damp(layer.rotation.z, projectsActive ? (index - 2.5) * .012 : 0, 7, delta);
    });
    if (projectLid.current) projectLid.current.position.y = THREE.MathUtils.damp(projectLid.current.position.y, projectsActive ? .255 : 0, 7, delta);
  });
  return <group position={[-.2,0,1.35]}>
    <Hotspot name="projects" position={[-.9,1.22,-.02]} active={active==="projects"} onFocus={onFocus}><group ref={projectStack} rotation={[0,-.08,0]}>{layers.map((color,i)=><group ref={node => { projectLayers.current[i] = node; }} key={color} position={[0,i*.105,0]} rotation={[0,(i%3-1)*.025,0]}><Box position={[0,0,0]} scale={[1.62,.09,1.15]} color={color} radius={.065}/><Box position={[.04,.048,.015]} scale={[1.48,.026,1.03]} color={i%2?"#e8d9b9":"#d8ceb3"} radius={.018}/><Box position={[.78,.018,.04]} scale={[.035,.06,.92]} color="#c5b996" radius={.01}/><Box position={[.72+(i%2)*.13,.055,-.32+i*.11]} scale={[.28,.035,.18]} color={i%2?"#e0b55f":"#d98768"} radius={.025}/></group>) }<group ref={projectLid}><Box position={[0,.67,0]} scale={[1.72,.16,1.18]} color="#c66f4c" radius={.085}/><Box position={[0,.755,0]} scale={[1.5,.025,1.02]} color="#de8e61" radius={.045}/><Box position={[.05,.79,-.05]} scale={[.86,.026,.35]} color="#eadcbf" radius={.025}/><PaperLabel text="Projekte" position={[.05,.808,-.05]} scale={[.72,.24,1]}/>{[[-.65,.44],[-.65,-.42],[.65,.44],[.65,-.42]].map(([x,z],i)=><mesh key={i} position={[x,.785,z]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.035,20]}/><meshStandardMaterial color="#b95f45"/></mesh>)}</group></group></Hotspot>
    <group position={[-2.2,1.52,.88]}><CoffeeMug/></group>
    <Hotspot name="about" position={[1.02,1.46,.4]} active={active==="about"} onFocus={onFocus}><group rotation={[0,.1,0]}><Box position={[0,-.12,0]} scale={[1.02,.07,1.2]} color="#52694f" radius={.07}/><Box position={[.02,-.05,0]} scale={[.92,.11,1.1]} color="#e2d2ae" radius={.035}/><Box position={[0,.04,0]} scale={[1.04,.12,1.22]} color="#75866b" radius={.075}/><Box position={[0,.11,0]} scale={[.88,.026,.28]} color="#e4d5b5" radius={.018}/><PaperLabel text="Journal" position={[0,.13,0]} rotation={[-Math.PI/2,0,0]} scale={[.78,.2,1]}/>{[-.35,0,.35].map(z=><mesh key={z} position={[-.5,.05,z]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.065,.018,10,24]}/><meshStandardMaterial color="#b99461" metalness={.15} roughness={.65}/></mesh>)}<mesh position={[.23,.12,-.22]} rotation={[-Math.PI/2,0,.2]}><circleGeometry args={[.065,20]}/><meshStandardMaterial color="#d08061"/></mesh></group></Hotspot>
    <Box position={[1.56,1.228,.48]} scale={[.055,.055,1.0]} color="#453c32" rotation={[0,.12,0]}/><Box position={[1.72,1.228,.48]} scale={[.05,.05,1.0]} color="#c4884d" rotation={[0,.12,0]}/>
  </group>;
}

function Lounge() {
  return <group position={[-4.32,0,.55]} rotation={[0,.1,0]}>
    <FurnitureAsset name="couch_pillows" position={[0,.08,.2]} rotation={[0,0,0]} scale={[.88,.93,.88]} tint="#4f7446"/>
  </group>;
}

function LoungeDetails() {
  return <group>
    <mesh receiveShadow position={[-3.55,.02,1.05]} rotation={[-Math.PI/2,0,.12]}><circleGeometry args={[2.15,64]}/><meshStandardMaterial color="#d8c39d" roughness={1}/></mesh>
    <group position={[-4.9,.34,2.62]} rotation={[0,.18,-.04]}><Box position={[0,0,0]} scale={[.96,.14,.14]} color="#44433e"/><mesh position={[-.59,0,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.32,.32,.28,32]}/><meshStandardMaterial color="#34322f" roughness={.85}/></mesh><mesh position={[-.78,0,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.25,.25,.18,32]}/><meshStandardMaterial color="#2e2d2a" roughness={.9}/></mesh><mesh position={[.59,0,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.32,.32,.28,32]}/><meshStandardMaterial color="#34322f" roughness={.85}/></mesh><mesh position={[.78,0,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.25,.25,.18,32]}/><meshStandardMaterial color="#2e2d2a" roughness={.9}/></mesh></group>
  </group>;
}

function Workstation({ active, onFocus }: { active: FocusName; onFocus: (name: FocusName) => void }) {
  const monitorScreen = useTexture(asset("/textures/monitor-screen-skills-v1.png"));
  useEffect(() => {
    monitorScreen.colorSpace = THREE.SRGBColorSpace;
    monitorScreen.anisotropy = 8;
    monitorScreen.needsUpdate = true;
  }, [monitorScreen]);
  return <group position={[3.72,0,-2.12]} rotation={[0,-.04,0]}><FurnitureAsset name="table_medium_long" position={[0,.02,0]} scale={[1.24,1.12,.74]}/><Box position={[-.28,1.19,.22]} scale={[1.92,.035,.72]} color="#586351" radius={.04} surface="fabric"/>
    <Hotspot name="skills" position={[-.34,1.18,-.12]} active={active==="skills"} onFocus={onFocus}><Box position={[0,.84,0]} scale={[1.78,1.2,.16]} color="#343532" radius={.09}/><RoundedBox castShadow position={[0,.84,.102]} scale={[1.58,.91,.035]} args={[1,1,1]} radius={.055} smoothness={4}><meshBasicMaterial map={monitorScreen} toneMapped={false} color={active === "skills" ? "#fff4da" : "#d8cdb8"}/></RoundedBox><Box position={[0,.2,0]} scale={[.13,.7,.13]} color="#3c3b37" radius={.04}/><Box position={[0,.01,.1]} scale={[.78,.1,.46]} color="#4c4942" radius={.05}/></Hotspot>
    <group position={[1.05,1.22,-.16]}><Box position={[0,.56,0]} scale={[.8,1.3,.78]} color="#30332f" radius={.09}/><Box position={[0,.56,.405]} scale={[.65,1.1,.025]} color="#31484b" radius={.04}/>{[.32,.8].map((y)=><group key={y} position={[0,y,.43]}><mesh><torusGeometry args={[.15,.028,16,48]}/><meshStandardMaterial color="#9fd8ff" emissive="#3fa4ff" emissiveIntensity={2.4}/></mesh><mesh position={[0,0,-.01]}><circleGeometry args={[.13,32]}/><meshStandardMaterial color="#1c2428" roughness={.6}/></mesh>{[0,1,2,3,4,5,6].map(b=><mesh key={b} position={[0,0,.005]} rotation={[0,0,b*Math.PI*2/7]}><boxGeometry args={[.11,.03,.008]}/><meshStandardMaterial color="#2e3a40" roughness={.5}/></mesh>)}</group>)}<mesh position={[0,1.05,.44]}><circleGeometry args={[.035,20]}/><meshStandardMaterial color="#e5c374" emissive="#dca84d" emissiveIntensity={.8}/></mesh></group>
    {[-1.3,.56].map((x)=><group key={x} position={[x,1.27,.08]}><Box position={[0,.31,0]} scale={[.34,.66,.32]} color="#3c4039" radius={.05}/><mesh position={[0,.34,.17]}><circleGeometry args={[.095,28]}/><meshStandardMaterial color="#bd9860"/></mesh><mesh position={[0,.1,.17]}><circleGeometry args={[.055,24]}/><meshStandardMaterial color="#2d302c"/></mesh></group>)}
    <FurnitureAsset name="cabinet_medium" position={[1.46,.03,-.18]} rotation={[0,0,0]} scale={[.45,.9,.72]}/>
    <group position={[-.18,1.175,.42]}><DesktopKeyboard/></group>
    <FurnitureAsset name="chair_C" position={[-.72,.04,1.28]} rotation={[0,Math.PI,0]} scale={[1.55,1.35,1.55]} tint="#7a9440"/><Plant position={[1.48,1.2,.22]} scale={.52}/>
  </group>;
}

function WallDetails() {
  return <group>
    <group position={[-5.05,4.0,-4.05]}><FurnitureAsset name="shelf_A_big" position={[0,0,0]} rotation={[0,0,0]} scale={[.72,.68,.78]}/><Plant position={[-.18,.08,.12]} scale={.88}/></group>
    <FurnitureAsset name="shelf_B_large_decorated" position={[3.9,4.0,-4.02]} rotation={[0,0,0]} scale={[1.72,1.18,1.12]}/>
    <group position={[3.25,3.12,-4.03]}><Box position={[0,0,0]} scale={[2.35,1.25,.15]} color={P.dark}/><Box position={[0,0,.1]} scale={[2.08,1,.04]} color="#a9764d"/>{[[-.72,.13],[-.3,-.17],[.16,.18],[.62,-.1],[.82,.28]].map(([x,y],i)=><group key={`${x}-${y}`} position={[x,y,.16]} rotation={[0,0,(i-2)*.055]}><Box position={[0,0,0]} scale={[.34,.46,.025]} color="#e4d6b8" radius={.015}/><Box position={[0,.045,.018]} scale={[.27,.27,.012]} color={i%2?"#739080":"#b66d50"} radius={.008}/><mesh position={[0,.24,.03]}><sphereGeometry args={[.035,14,10]}/><meshStandardMaterial color={i%2?"#d6b259":"#758560"}/></mesh></group>)}</group>
  </group>;
}

function ShelfAccents() {
  return <group>
    <group position={[4.3,4.92,-3.78]}>{Array.from({length:5}).map((_,i)=>{const angle=i*Math.PI*2/5;return <mesh key={i} position={[Math.sin(angle)*.22,Math.cos(angle)*.22,0]} rotation={[0,0,-angle]}><coneGeometry args={[.13,.42,16]}/><meshStandardMaterial color="#ffd986" emissive="#ffb64f" emissiveIntensity={1.8}/></mesh>})}<mesh><sphereGeometry args={[.2,24,16]}/><meshStandardMaterial color="#ffe09a" emissive="#ffb64f" emissiveIntensity={1.8}/></mesh><pointLight color="#ffc46e" intensity={3.2} distance={4}/></group>
    <TrailingVine anchor={[5.15,4.05,-3.82]} length={2.1} seed={1}/>
    <TrailingVine anchor={[4.75,4.05,-3.86]} length={1.35} seed={2}/>
    <TrailingVine anchor={[-4.7,4.08,-3.86]} length={1.6} seed={3}/>
    <Plant position={[3.0,4.18,-3.95]} scale={.62}/>
  </group>;
}

function DeskDetails() {
  return <group>
    <group position={[4.2,1.24,-1.25]}>
      <Box position={[.12,.05,.72]} scale={[1.2,.07,.4]} color="#e5d8be"/>{Array.from({length:9}).map((_,i)=><Box key={i} position={[-.47+i*.12,.1,.72]} scale={[.07,.025,.18]} color="#b7aa91" radius={.01}/>)}</group>
    <group position={[-1.95,1.52,1.22]}><mesh castShadow><cylinderGeometry args={[.34,.3,.52,36]}/><meshStandardMaterial color="#6f896d"/></mesh><mesh position={[.37,.02,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.2,.055,14,32]}/><meshStandardMaterial color="#6f896d"/></mesh></group>
  </group>;
}

function StudioDetails() {
  return <group>
    <group position={[3.44,2.02,-1.35]}><mesh position={[0,0,.01]}><planeGeometry args={[1.35,.82]}/><meshBasicMaterial color="#d8b278"/></mesh><mesh position={[.35,.2,.025]}><circleGeometry args={[.12,28]}/><meshBasicMaterial color="#ffe0a0"/></mesh>{[-.38,0,.38].map((x,i)=><mesh key={x} position={[x,-.12,.03]} scale={[1,.72,1]}><coneGeometry args={[.3,.55,3]}/><meshBasicMaterial color={i%2?"#6d8c75":"#5f7d68"}/></mesh>)}<Box position={[0,-.34,.04]} scale={[1.15,.08,.02]} color="#6f9aa0" radius={.005}/></group>
    <group position={[5.05,.05,-.65]}><Box position={[0,.52,0]} scale={[1.65,.18,.82]} color={P.wood}/><Box position={[-.65,.22,0]} scale={[.18,.62,.18]} color={P.dark}/><Box position={[.65,.22,0]} scale={[.18,.62,.18]} color={P.dark}/><Box position={[0,.85,0]} scale={[1.35,.24,.72]} color="#393832"/>{Array.from({length:12}).map((_,i)=><Box key={i} position={[-.55+i*.1,1.02,.1]} scale={[.065,.05,.38]} color={i%3?"#e7dfcf":"#bdb6aa"} radius={.01}/>)}</group>
    <group position={[4.75,.05,-2.55]}><Box position={[0,.5,0]} scale={[1.25,1,.82]} color="#6d6d63"/>{[-.34,0,.34].map(y=><Box key={y} position={[0,.5+y,.43]} scale={[.92,.24,.04]} color="#55564f" radius={.02}/>)}</group>
    <group position={[5.15,1.2,-3.72]}><Box position={[0,0,0]} scale={[1.65,.18,.48]} color={P.wood}/>{[-.55,0,.55].map((x,i)=><Box key={x} position={[x,.35,0]} scale={[.24,.62,.3]} color={["#506c63","#a86444","#405a6b"][i]}/>)}</group>
  </group>;
}

function FloorDetails() {
  return <group>
    <Ottoman position={[-.15,.05,3.45]}/>
  </group>;
}

function MusicStation() {
  const blackKeys = [-.76,-.52,-.12,.12,.36,.76];
  return <group position={[5.16,.02,.12]} rotation={[0,-.1,0]}>
    <FurnitureAsset name="table_medium_long" position={[0,0,0]} scale={[.7,.8,.48]}/>
    <Box position={[0,.9,.04]} scale={[2.15,.2,.74]} color="#373834" radius={.065}/>
    <Box position={[0,1.02,-.18]} scale={[1.92,.12,.22]} color="#4b4b45" radius={.035}/>
    {Array.from({length:14}).map((_,i)=><Box key={i} position={[-.83+i*.128,1.035,.16]} scale={[.105,.055,.43]} color="#eee6d5" radius={.014}/>) }
    {blackKeys.map((x)=><Box key={x} position={[x,1.09,.05]} scale={[.072,.07,.27]} color="#282a28" radius={.014}/>) }
    <Box position={[-.62,1.1,-.2]} scale={[.32,.035,.11]} color="#7f946c" radius={.025}/>
    <Box position={[-.2,1.1,-.2]} scale={[.22,.035,.11]} color="#c47a54" radius={.025}/>
    <group position={[0,.02,.1]}>
      <FurnitureAsset name="cabinet_small" position={[0,0,0]} rotation={[0,0,0]} scale={[.72,.58,.5]}/>
      {[-.58,-.34,-.1,.14,.38,.62].map((x,i)=><Box key={x} position={[x,.39,.31]} scale={[.12,.43,.035]} color={["#4f6570","#a9664a","#6e7f5f"][i%3]} radius={.012}/>) }
    </group>
  </group>;
}

function ArchitectLamp({ position, rotation = [0,0,0] }: { position: V3; rotation?: V3 }) {
  const green = <meshPhysicalMaterial color="#3f5f3c" roughness={.38} clearcoat={.7} clearcoatRoughness={.2}/>;
  const joint = <meshStandardMaterial color="#2c3a2b" roughness={.4} metalness={.4}/>;
  return <group position={position} rotation={rotation}>
    <mesh castShadow receiveShadow position={[0,.03,0]}><cylinderGeometry args={[.2,.23,.06,40]}/>{green}</mesh>
    <mesh position={[0,.09,0]}><sphereGeometry args={[.045,16,12]}/>{joint}</mesh>
    <mesh castShadow position={[.0,.44,-.08]} rotation={[-.22,0,0]}><cylinderGeometry args={[.022,.022,.72,16]}/>{green}</mesh>
    <mesh position={[0,.79,-.16]}><sphereGeometry args={[.04,16,12]}/>{joint}</mesh>
    <mesh castShadow position={[0,.86,.12]} rotation={[1.3,0,0]}><cylinderGeometry args={[.02,.02,.6,16]}/>{green}</mesh>
    <group position={[0,.86,.42]} rotation={[.9,0,0]}>
      <mesh castShadow><cylinderGeometry args={[.07,.2,.26,40,1,true]}/><meshPhysicalMaterial color="#3f5f3c" roughness={.38} clearcoat={.7} side={THREE.DoubleSide}/></mesh>
      <mesh position={[0,.15,0]}><sphereGeometry args={[.075,20,14,0,Math.PI * 2,0,Math.PI / 2]}/>{green}</mesh>
      <mesh position={[0,-.06,0]}><sphereGeometry args={[.06,16,12]}/><meshStandardMaterial color="#fff2cf" emissive="#ffc46a" emissiveIntensity={3}/></mesh>
    </group>
    <pointLight position={[0,.6,.6]} color="#ffc878" intensity={2.2} distance={3.2} decay={2}/>
  </group>;
}

function Ottoman({ position }: { position: V3 }) {
  const geometry = useMemo(() => {
    const points: THREE.Vector2[] = [];
    // Puffy pouf profile: soft rolled edge at the top seam and a slight belly.
    for (let i = 0; i <= 24; i++) { const t = i / 24; points.push(new THREE.Vector2(.5 + Math.sin(t * Math.PI) * .05 - Math.pow(t, 8) * .08, t * .5)); }
    for (let i = 1; i <= 10; i++) { const a = i / 10 * Math.PI / 2; points.push(new THREE.Vector2(.42 * Math.cos(a), .5 + Math.sin(a) * .06)); }
    return new THREE.LatheGeometry(points, 64);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group position={position}>
    <mesh geometry={geometry} castShadow receiveShadow position={[0,.1,0]}><meshPhysicalMaterial color="#6f8752" roughness={.9} sheen={1} sheenRoughness={.55} sheenColor="#d9e6b8"/></mesh>
    <mesh position={[0,.665,0]}><sphereGeometry args={[.035,16,10]}/><meshPhysicalMaterial color="#5a7044" roughness={.8} sheen={1}/></mesh>
    {[0,1,2,3].map(i=><mesh key={i} castShadow position={[Math.cos(i*Math.PI/2+.78)*.36,.05,Math.sin(i*Math.PI/2+.78)*.36]}><cylinderGeometry args={[.035,.03,.1,16]}/><meshStandardMaterial color="#6b4529" roughness={.6}/></mesh>)}
  </group>;
}

function RoundRug({ position, radius }: { position: V3; radius: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#e8dcc4";
    context.fillRect(0, 0, 512, 512);
    // Braided rings plus fiber speckle read as a woven wool rug.
    for (let r = 250; r > 10; r -= 9) {
      context.strokeStyle = `rgba(${150 + (r % 27)},${130 + (r % 19)},${100 + (r % 13)},.22)`;
      context.lineWidth = 3;
      context.beginPath(); context.arc(256, 256, r, 0, Math.PI * 2); context.stroke();
    }
    for (let i = 0; i < 9000; i++) {
      const shade = Math.random() > .5 ? 255 : 110;
      context.fillStyle = `rgba(${shade},${shade - 20},${shade - 50},${Math.random() * .12})`;
      context.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5);
    }
    const next = new THREE.CanvasTexture(canvas);
    next.colorSpace = THREE.SRGBColorSpace;
    next.anisotropy = 8;
    return next;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return <group position={position} scale={[1.22,1,1]}>
    <mesh rotation={[-Math.PI / 2,0,0]} receiveShadow><circleGeometry args={[radius,96]}/><meshPhysicalMaterial map={texture} roughness={1} sheen={1} sheenRoughness={.8} sheenColor="#fff4e0"/></mesh>
    <mesh rotation={[-Math.PI / 2,0,0]} receiveShadow castShadow><torusGeometry args={[radius,.045,10,128]}/><meshPhysicalMaterial color="#d9c9aa" roughness={1} sheen={1} sheenRoughness={.7} sheenColor="#fff4e0"/></mesh>
  </group>;
}

/** Pothos strand hanging from a shelf: a soft stem with heart-shaped leaves that sway a little. */
function TrailingVine({ anchor, length, seed }: { anchor: V3; length: number; seed: number }) {
  const group = useRef<THREE.Group>(null);
  const leaves = useRef<THREE.InstancedMesh>(null);
  const reducedMotion = useReducedMotionRef();
  const { stem, placements, leafGeometry } = useMemo(() => {
    const rand = (n: number) => { const v = Math.sin(n * 91.7 + seed * 13.1) * 43758.5453; return v - Math.floor(v); };
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; points.push(new THREE.Vector3(Math.sin(t * 5 + seed) * .07 + t * .12 * (seed % 2 ? 1 : -1), -t * length, .05 + Math.sin(t * 3.3 + seed) * .05 + t * .08)); }
    const curve = new THREE.CatmullRomCurve3(points);
    const heart = new THREE.Shape();
    heart.moveTo(0, 0); heart.bezierCurveTo(.07, .03, .09, .1, .05, .14); heart.bezierCurveTo(.03, .16, 0, .15, 0, .12);
    heart.bezierCurveTo(0, .15, -.03, .16, -.05, .14); heart.bezierCurveTo(-.09, .1, -.07, .03, 0, 0);
    const leafGeometry = new THREE.ShapeGeometry(heart, 10);
    leafGeometry.rotateZ(Math.PI);
    const placements: THREE.Matrix4[] = [];
    const count = Math.round(length * 11);
    for (let i = 0; i < count; i++) {
      const t = (i + .5) / count;
      const p = curve.getPointAt(t);
      const side = i % 2 ? 1 : -1;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-.5 + rand(i) * .4, side * (.6 + rand(i + 3) * .5), side * (.5 + rand(i + 7) * .6)));
      const k = .8 + rand(i + 11) * .5;
      placements.push(new THREE.Matrix4().compose(p.add(new THREE.Vector3(side * .03, 0, .02)), q, new THREE.Vector3(k, k, k)));
    }
    return { stem: new THREE.TubeGeometry(curve, 48, .008, 5), placements, leafGeometry };
  }, [length, seed]);
  useEffect(() => () => { stem.dispose(); leafGeometry.dispose(); }, [leafGeometry, stem]);
  useLayoutEffect(() => {
    const mesh = leaves.current;
    if (!mesh) return;
    const color = new THREE.Color();
    placements.forEach((matrix, index) => { mesh.setMatrixAt(index, matrix); mesh.setColorAt(index, color.set(index % 3 ? "#5f8a48" : "#7da35a")); });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [placements]);
  useFrame(({ clock }) => {
    if (!group.current || reducedMotion.current) return;
    group.current.rotation.z = Math.sin(clock.elapsedTime * .6 + seed) * .025;
    group.current.rotation.x = Math.sin(clock.elapsedTime * .45 + seed * 2) * .02;
  });
  return <group ref={group} position={anchor}>
    <mesh geometry={stem} castShadow><meshStandardMaterial color="#4c6b38" roughness={.8}/></mesh>
    <instancedMesh ref={leaves} args={[leafGeometry, undefined, placements.length]} castShadow>
      <meshPhysicalMaterial side={THREE.DoubleSide} roughness={.55} sheen={.4} sheenColor="#e2f0c0" clearcoat={.25}/>
    </instancedMesh>
  </group>;
}

function Lantern({ position }: { position: V3 }) {
  const metal = <meshPhysicalMaterial color="#4f5f47" roughness={.45} metalness={.35} clearcoat={.4}/>;
  return <group position={position}>
    <mesh castShadow position={[0,.05,0]}><cylinderGeometry args={[.17,.19,.1,32]}/>{metal}</mesh>
    <mesh position={[0,.3,0]}><cylinderGeometry args={[.13,.13,.4,32]}/><meshPhysicalMaterial color="#fff1c9" emissive="#ffb24f" emissiveIntensity={2.2} roughness={.2} transmission={0} transparent opacity={.92}/></mesh>
    {[0,1,2,3].map(i=><mesh key={i} castShadow position={[Math.cos(i*Math.PI/2)*.14,.3,Math.sin(i*Math.PI/2)*.14]}><cylinderGeometry args={[.014,.014,.42,8]}/>{metal}</mesh>)}
    <mesh castShadow position={[0,.56,0]}><coneGeometry args={[.19,.16,32]}/>{metal}</mesh>
    <mesh position={[0,.7,0]}><torusGeometry args={[.08,.012,8,24]}/>{metal}</mesh>
    <pointLight position={[0,.32,.05]} color="#ffb766" intensity={2.6} distance={3.6} decay={2}/>
  </group>;
}

function Kettlebell({ position }: { position: V3 }) {
  return <group position={position}>
    <mesh castShadow receiveShadow position={[0,.25,0]} scale={[1,.92,1]}><sphereGeometry args={[.27,36,24]}/><meshPhysicalMaterial color="#4f6e45" roughness={.55} clearcoat={.3}/></mesh>
    <mesh castShadow position={[0,.5,0]}><torusGeometry args={[.15,.04,14,36,Math.PI]}/><meshPhysicalMaterial color="#4f6e45" roughness={.55} clearcoat={.3}/></mesh>
  </group>;
}

function YogaMat({ position, rotation = [0,0,0] }: { position: V3; rotation?: V3 }) {
  return <group position={position} rotation={rotation}>
    <mesh castShadow receiveShadow rotation={[0,0,Math.PI / 2]}><cylinderGeometry args={[.21,.21,.95,40]}/><meshPhysicalMaterial color="#2f4d84" roughness={.8} sheen={.4} sheenColor="#9fb6e8"/></mesh>
    {[-1,1].map(side=><mesh key={side} position={[side * .476,0,0]} rotation={[0,0,Math.PI / 2]}><cylinderGeometry args={[.205,.205,.004,40]}/><meshStandardMaterial color="#223a66" roughness={.9}/></mesh>)}
    {[-.3,.3].map(x=><mesh key={x} position={[x,0,0]} rotation={[0,Math.PI / 2,0]}><torusGeometry args={[.215,.012,8,40]}/><meshStandardMaterial color="#1c2b45" roughness={.8}/></mesh>)}
  </group>;
}

function RoomAccents() {
  return <group>
    <FurnitureAsset name="book_set" position={[4.18,1.13,-2.02]} rotation={[0,.18,0]} scale={[.42,.42,.42]}/>
    <group position={[-5.72,.03,-1.05]} rotation={[0,Math.PI / 2,0]}>
      <FurnitureAsset name="cabinet_small" position={[0,0,0]} scale={[.6,.62,.6]}/>
      <Lantern position={[-.18,.66,.02]}/>
      <Plant position={[.28,.66,.04]} scale={.42}/>
    </group>
    <Kettlebell position={[4.15,.05,2.35]}/>
    <YogaMat position={[5.25,.26,2.75]} rotation={[0,-.35,0]}/>
  </group>;
}

/** Builds a closed board outline from a half-width profile sampled from tail (t=0) to nose (t=1). */
function profileShape(length: number, halfWidth: (t: number) => number, samples = 48) {
  const shape = new THREE.Shape();
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= samples; i++) { const t = i / samples; points.push(new THREE.Vector2(halfWidth(t), (t - .5) * length)); }
  for (let i = samples; i >= 0; i--) { const t = i / samples; points.push(new THREE.Vector2(-halfWidth(t), (t - .5) * length)); }
  shape.setFromPoints(points);
  return shape;
}

/** Extruded board with rounded rails; the deck print sits as an inset layer, and tips can rise like ski shovels. */
function ShapedBoard({ shape, thickness, rail, deck, deckInset = .9, tipRise = 0, length, gloss = .6, children }: { shape: THREE.Shape; thickness: number; rail: string; deck: string; deckInset?: number; tipRise?: number; length: number; gloss?: number; children?: ReactNode }) {
  const { body, top } = useMemo(() => {
    const bevel = Math.min(thickness * .48, .03);
    const body = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelSegments: 5, steps: 1, bevelSize: bevel, bevelThickness: bevel, curveSegments: 32 });
    body.translate(0, 0, -thickness / 2);
    const top = new THREE.ShapeGeometry(shape, 32);
    top.scale(deckInset, deckInset + (1 - deckInset) * .6, 1);
    top.translate(0, 0, thickness / 2 + bevel + .002);
    if (tipRise) {
      // Bend the last stretch toward the wall side so ski and board tips curl up.
      [body, top].forEach(geometry => {
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          const y = positions.getY(i), start = length / 2 - .32;
          if (y > start) { const k = (y - start) / .32; positions.setZ(i, positions.getZ(i) - k * k * tipRise); }
        }
        geometry.computeVertexNormals();
      });
    }
    return { body, top };
  }, [deckInset, length, shape, thickness, tipRise]);
  useEffect(() => () => { body.dispose(); top.dispose(); }, [body, top]);
  return <group>
    <mesh geometry={body} castShadow receiveShadow><meshPhysicalMaterial color={rail} roughness={.45} clearcoat={gloss} clearcoatRoughness={.18}/></mesh>
    <mesh geometry={top} receiveShadow><meshPhysicalMaterial color={deck} roughness={.42} clearcoat={gloss} clearcoatRoughness={.15} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2}/></mesh>
    {children}
  </group>;
}

function LeafMark({ position, scale = 1, color = "#6f8f55", rotation = 0 }: { position: V3; scale?: number; color?: string; rotation?: number }) {
  return <group position={position} rotation={[0,0,rotation]} scale={scale}>
    <mesh scale={[1,.62,1]}><circleGeometry args={[.09,24]}/><meshStandardMaterial color={color} roughness={.5} polygonOffset polygonOffsetFactor={-4}/></mesh>
    <mesh position={[0,0,.001]}><planeGeometry args={[.15,.012]}/><meshStandardMaterial color="#e9dfc2" polygonOffset polygonOffsetFactor={-5}/></mesh>
  </group>;
}

function SnowBinding({ y }: { y: number }) {
  const plastic = <meshPhysicalMaterial color="#1d2024" roughness={.4} clearcoat={.5}/>;
  return <group position={[0,y,.07]}>
    <RoundedBox args={[.36,.2,.05]} radius={.02} smoothness={4} castShadow>{plastic}</RoundedBox>
    {/* Highback: a curved shell rising off the heel edge */}
    <mesh castShadow position={[0,-.02,.12]} rotation={[Math.PI / 2,0,0]}><cylinderGeometry args={[.17,.17,.2,24,1,true,-Math.PI * .5,Math.PI]}/><meshPhysicalMaterial color="#2a2e33" roughness={.45} side={THREE.DoubleSide}/></mesh>
    {[-.05,.06].map(dy=><mesh key={dy} castShadow position={[0,dy,.13]} scale={[1,.45,1]}><torusGeometry args={[.15,.03,10,28,Math.PI]}/><meshPhysicalMaterial color="#3c4248" roughness={.5}/></mesh>)}
  </group>;
}

function SkiBinding({ y }: { y: number }) {
  return <group position={[0,y,.05]}>
    <RoundedBox args={[.11,.16,.07]} radius={.02} smoothness={3} position={[0,.2,0]} castShadow><meshPhysicalMaterial color="#2a2c2e" roughness={.35} clearcoat={.6}/></RoundedBox>
    <RoundedBox args={[.11,.22,.1]} radius={.025} smoothness={3} position={[0,-.2,.01]} castShadow><meshPhysicalMaterial color="#303336" roughness={.35} clearcoat={.6}/></RoundedBox>
    <RoundedBox args={[.07,.24,.02]} radius={.008} smoothness={2} position={[0,0,-.015]}><meshStandardMaterial color="#8d9297" roughness={.3} metalness={.6}/></RoundedBox>
  </group>;
}

function Hobbies() {
  const surf = useMemo(() => profileShape(3.1, t => .41 * Math.pow(Math.sin(Math.PI * (.08 + t * .92)), .62) * (t < .12 ? .82 + t * 1.5 : 1)), []);
  const snow = useMemo(() => profileShape(2.95, t => { const tip = Math.min(t, 1 - t); return .31 * (tip < .08 ? Math.sqrt(1 - Math.pow(1 - tip / .08, 2)) * .92 + .02 : 1 - .09 * Math.sin(Math.PI * (t - .08) / .84)); }), []);
  const ski = useMemo(() => profileShape(2.9, t => { const nose = t > .9 ? Math.sqrt(Math.max(0, 1 - Math.pow((t - .9) / .1, 2))) : 1; const tail = t < .03 ? .7 + t * 10 : 1; return .055 * nose * tail * (1 - .12 * Math.sin(Math.PI * t)) + .004; }), []);
  return <group position={[-4.78,.06,-2.43]}>
    {/* Surfboard: cream deck, sage rail, stringer and fin, leaning on the wall */}
    <group position={[-.8,1.62,-.05]} rotation={[-.07,0,.035]}>
      <ShapedBoard shape={surf} thickness={.07} rail="#6f8f55" deck="#efe3c6" deckInset={.88} length={3.1} gloss={.85}>
        <mesh position={[0,0,.072]}><planeGeometry args={[.012,2.7]}/><meshStandardMaterial color="#b7a27c" polygonOffset polygonOffsetFactor={-4}/></mesh>
        <LeafMark position={[.1,.55,.075]} scale={1.5} rotation={.4}/>
        <mesh castShadow position={[0,-1.25,-.1]} rotation={[0,Math.PI / 2,0]}><extrudeGeometry args={[(() => { const fin = new THREE.Shape(); fin.moveTo(0,0); fin.quadraticCurveTo(.05,.02,.2,-.03); fin.quadraticCurveTo(.08,.1,.0,.2); fin.lineTo(0,0); return fin; })(), { depth: .012, bevelEnabled: false }]}/><meshPhysicalMaterial color="#6f8f55" roughness={.4} clearcoat={.8}/></mesh>
      </ShapedBoard>
    </group>
    {/* Snowboard: navy twin-tip with leaf prints and two real bindings */}
    <group position={[.1,1.52,.18]} rotation={[-.06,0,-.03]}>
      <ShapedBoard shape={snow} thickness={.05} rail="#151a20" deck="#26334a" deckInset={.94} length={2.95} gloss={.7}>
        <LeafMark position={[-.08,1.0,.06]} scale={1.3} rotation={-.3}/>
        <LeafMark position={[.1,-.05,.06]} scale={1.1} rotation={.5} color="#7fa060"/>
        <LeafMark position={[-.06,-1.05,.06]} scale={1.3} rotation={.2}/>
        <SnowBinding y={.48}/>
        <SnowBinding y={-.48}/>
      </ShapedBoard>
    </group>
    {/* Skis: red and blue pair with tip rise and bindings */}
    {[{ x: .78, color: "#c4462f", deck: "#d9583c", rot: .03 }, { x: 1.05, color: "#2f4d84", deck: "#c4462f", rot: -.02 }].map(({ x, color, deck, rot }) =>
      <group key={x} position={[x,1.48,-.04]} rotation={[-.1,0,rot]}>
        <ShapedBoard shape={ski} thickness={.03} rail={color} deck={deck} deckInset={.82} tipRise={.11} length={2.9} gloss={.8}>
          <SkiBinding y={-.15}/>
        </ShapedBoard>
      </group>)}
    {[1.4,1.6].map((x,i)=><group key={x} position={[x,1.42,-.12]} rotation={[0,0,i?.07:-.04]}><mesh castShadow><cylinderGeometry args={[.016,.012,2.65,16]}/><meshPhysicalMaterial color="#2c3036" roughness={.35} metalness={.5}/></mesh><mesh castShadow position={[0,1.25,0]}><cylinderGeometry args={[.042,.036,.26,16]}/><meshPhysicalMaterial color="#1f2226" roughness={.6}/></mesh><mesh position={[0,1.4,0]} rotation={[0,0,Math.PI/2]}><torusGeometry args={[.05,.008,6,16]}/><meshStandardMaterial color="#2a2d31"/></mesh><mesh position={[0,-1.15,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.09,.012,10,30]}/><meshStandardMaterial color="#2c3036"/></mesh><mesh position={[0,-1.15,0]} rotation={[Math.PI/2,0,0]}>{[0,1,2,3].map(k=><mesh key={k} rotation={[0,0,k*Math.PI/4]}><boxGeometry args={[.18,.006,.006]}/><meshStandardMaterial color="#2c3036"/></mesh>)}</mesh></group>)}
  </group>;
}

function useReducedMotionRef() {
  const reducedMotion = useRef(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reducedMotion.current = media.matches; };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reducedMotion;
}

const WISPS = 5;

function CoffeeSteam() {
  const wisps = useRef<Array<THREE.Sprite | null>>([]);
  const reducedMotion = useReducedMotionRef();
  const windGust = useContext(WindGustContext);
  const gustStartedAt = useRef(-100);
  const steamTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 96;
    const context = canvas.getContext("2d")!;
    const gradient = context.createRadialGradient(48,48,5,48,48,46);
    gradient.addColorStop(0,"rgba(255,246,228,.75)");
    gradient.addColorStop(.38,"rgba(255,239,218,.34)");
    gradient.addColorStop(1,"rgba(255,230,205,0)");
    context.fillStyle = gradient;
    context.fillRect(0,0,96,96);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
  useEffect(() => () => steamTexture.dispose(), [steamTexture]);
  useEffect(() => {
    if (windGust > 0) gustStartedAt.current = performance.now() / 1000;
  }, [windGust]);
  useFrame(({clock}) => {
    if (reducedMotion.current) return;
    const gust = windEnvelope(performance.now() / 1000 - gustStartedAt.current);
    const t = clock.elapsedTime;
    wisps.current.forEach((sprite,index) => {
      if (!sprite) return;
      const phase = (t * .19 + index / WISPS) % 1;
      // Wisps rise, widen and curl on two interfering sways, then dissolve; a gust bends the plume sideways.
      const curl = Math.sin(t * .85 + index * 2.1 + phase * 4) * (.03 + phase * .09) + Math.sin(t * 1.7 + index) * .015 * phase;
      sprite.position.set(-2.43 + curl + gust * (.34 + index * .04) * phase * 1.6, 1.94 + Math.pow(phase, .85) * .86 - gust * phase * .12, 2.68 + Math.cos(t * .42 + index + phase * 3) * .03 + gust * .48 * phase * 1.6);
      const size = .18 + phase * .42;
      sprite.scale.set(size * (.75 + gust * 1.05),size * (1.05 - gust * .24),1);
      const material = sprite.material as THREE.SpriteMaterial;
      material.rotation = index * 1.3 + t * (.12 + index * .03) * (index % 2 ? 1 : -1);
      material.opacity = Math.pow(Math.sin(phase * Math.PI), 1.6) * Math.min(1, phase * 6) * .19;
    });
  });
  return <group>{Array.from({length: WISPS}, (_, index)=><sprite key={index} ref={node => { wisps.current[index] = node; }} position={[-2.43,1.84 + index*.12,2.68]} scale={[.16,.22,1]}><spriteMaterial map={steamTexture} color="#fff0dc" transparent opacity={0} depthWrite={false}/></sprite>)}</group>;
}

function DriftingLeaves() {
  const leafRefs = useRef<Array<THREE.Group | null>>([]);
  const reducedMotion = useReducedMotionRef();
  const windGust = useContext(WindGustContext);
  const gustStartedAt = useRef(-100);
  const progress = useRef<number[]>([]);
  const leafTexture = useTexture(asset("/textures/stylized-drifting-leaf-v1.png"));
  useEffect(() => {
    leafTexture.colorSpace = THREE.SRGBColorSpace;
    leafTexture.anisotropy = 8;
    leafTexture.needsUpdate = true;
  }, [leafTexture]);
  const leaves = useMemo(() => Array.from({length:7},(_,index) => ({
    phase: (index * .137 + .08) % 1,
    speed: .034 + (index % 4) * .006,
    x: -1.9 + (index * 1.37) % 3.8,
    drift: (index % 2 ? 1 : -1) * (.6 + (index % 3) * .5),
    height: 3.4 + (index % 3) * .45,
    swing: 1.25 + (index % 4) * .22,
    scale: .5 + (index % 3) * .13,
    color: ["#ffffff","#f0cea0","#d8e2bf","#ffc59d"][index % 4],
  })), []);
  const materials = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  useEffect(() => {
    progress.current = leaves.map((leaf) => leaf.phase);
  }, [leaves]);
  useEffect(() => {
    if (windGust > 0) gustStartedAt.current = performance.now() / 1000;
  }, [windGust]);
  useFrame(({clock}, delta) => {
    if (reducedMotion.current) return;
    const gust = windEnvelope(performance.now() / 1000 - gustStartedAt.current);
    const t = clock.elapsedTime;
    leaves.forEach((leaf,index) => {
      const group = leafRefs.current[index];
      if (!group) return;
      progress.current[index] = ((progress.current[index] ?? leaf.phase) + leaf.speed * Math.min(delta, .05) * (1 + gust * 6)) % 1;
      const travel = progress.current[index];
      // Leaves blow in through the balcony door and settle toward the floor with a falling-leaf
      // pendulum: they swing side to side, lift a little at each end of the swing, and tilt with it.
      const swing = Math.sin(t * leaf.swing + index * 1.9);
      const lift = Math.abs(Math.cos(t * leaf.swing + index * 1.9));
      const z = -5.6 + travel * 9.2 + gust * travel * 1.2;
      const y = leaf.height - travel * (leaf.height - .55) + lift * .12 + Math.sin(travel * Math.PI) * gust * .6;
      group.position.set(leaf.x + leaf.drift * travel + swing * (.32 + gust * .2), y, z);
      group.rotation.set(-1.1 + swing * .55 + gust * Math.sin(t * 6 + index) * .6, t * (.25 + index * .03) + gust * t * .8, swing * .7);
      const material = materials.current[index];
      if (material) material.opacity = Math.min(1, travel * 12) * Math.min(1, (1 - travel) * 6);
    });
  });
  return <group>{leaves.map((leaf,index)=><group key={index} ref={node => { leafRefs.current[index] = node; }} position={[leaf.x,leaf.height,-5.6]} scale={leaf.scale}>
    <mesh rotation={[0,0,.55]} scale={[.78,1,1]}><planeGeometry args={[.48,.54]}/><meshStandardMaterial ref={node => { materials.current[index] = node; }} map={leafTexture} color={leaf.color} transparent alphaTest={.08} depthWrite={false} roughness={.6} side={THREE.DoubleSide}/></mesh>
  </group>)}</group>;
}

function WindResponsiveProps() {
  const windGust = useContext(WindGustContext);
  const reducedMotion = useReducedMotionRef();
  const gustStartedAt = useRef(-100);
  const paperRefs = useRef<Array<THREE.Group | null>>([]);
  const papers = useMemo(() => [
    { position: [-.08,1.19,2.18] as V3, rotation: -.1, travel: [.42,.82] as [number,number], color: "#ead9b8" },
    { position: [2.72,1.22,-1.28] as V3, rotation: .14, travel: [.58,1.05] as [number,number], color: "#f0dfbd" },
    { position: [-1.9,1.16,1.72] as V3, rotation: -.22, travel: [.34,.72] as [number,number], color: "#d8c898" },
  ], []);
  useEffect(() => {
    if (windGust > 0) gustStartedAt.current = performance.now() / 1000;
  }, [windGust]);
  const geometry = useMemo(() => new THREE.PlaneGeometry(.52, .34, 16, 8), []);
  const bendUniforms = useMemo(() => papers.map(() => ({ curl: { value: 0 }, ripple: { value: 0 }, time: { value: 0 } })), [papers]);
  const bendShader = useMemo(() => bendUniforms.map(uniforms => (shader: THREE.WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `uniform float curl; uniform float ripple; uniform float time;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      // The sheet curls along its length and a travelling ripple runs across it while airborne.
      `#include <begin_vertex>\n      transformed.z += curl * (position.x * position.x) * 3.2 + ripple * sin(position.x * 14.0 - time * 11.0) * .012 * (position.x + .26);`,
    );
  }), [bendUniforms]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => {
    const gustAge = performance.now() / 1000 - gustStartedAt.current;
    const gust = reducedMotion.current ? 0 : windEnvelope(gustAge);
    const normalized = THREE.MathUtils.clamp(gustAge / 3.4, 0, 1);
    const t = clock.elapsedTime;
    papers.forEach((paper,index) => {
      const group = paperRefs.current[index];
      if (!group) return;
      // Layered sines read as turbulent air rather than one metronomic wobble.
      const flutter = (Math.sin(t * (9 + index * 1.7) + index) * .55 + Math.sin(t * (5.3 + index) + index * 2.3) * .3 + Math.sin(t * 13.7 + index * 4.1) * .15) * gust;
      const arc = Math.sin(normalized * Math.PI);
      group.position.set(paper.position[0] + gust * paper.travel[0], paper.position[1] + arc * gust * (.3 + index * .07), paper.position[2] + gust * paper.travel[1]);
      group.rotation.set(-Math.PI / 2 + flutter * .42, paper.rotation + gust * (.35 + index * .14), flutter * .32);
      const uniforms = bendUniforms[index];
      uniforms.curl.value = gust * (.35 + flutter * .25);
      uniforms.ripple.value = gust;
      uniforms.time.value = t;
    });
  });
  return <group>{papers.map((paper,index)=><group key={index} ref={node => { paperRefs.current[index] = node; }} position={paper.position} rotation={[-Math.PI/2,paper.rotation,0]}>
    <mesh castShadow geometry={geometry}><meshStandardMaterial color={paper.color} roughness={.92} side={THREE.DoubleSide} onBeforeCompile={bendShader[index]} customProgramCacheKey={() => "paper-bend-v1"}/></mesh>
    <mesh position={[.02,.03,.004]}><planeGeometry args={[.28,.025]}/><meshBasicMaterial color="#a98561" transparent opacity={.38}/></mesh>
    <mesh position={[-.04,-.04,.004]}><planeGeometry args={[.34,.018]}/><meshBasicMaterial color="#8f775e" transparent opacity={.26}/></mesh>
  </group>)}</group>;
}

function DistantBirds() {
  const birdRefs = useRef<Array<THREE.Group | null>>([]);
  const reducedMotion = useReducedMotionRef();
  const birds = useMemo(() => [
    {phase:.02,y:3.95,speed:.018,scale:.72},
    {phase:.16,y:4.18,speed:.015,scale:.55},
    {phase:.34,y:3.72,speed:.021,scale:.64},
    {phase:.55,y:4.35,speed:.014,scale:.46},
    {phase:.76,y:3.9,speed:.017,scale:.52},
  ],[]);
  const wing = useMemo(() => {
    // Tapered, slightly swept wing with the pivot at the shoulder.
    const shape = new THREE.Shape();
    shape.moveTo(0, .012); shape.quadraticCurveTo(.09, .03, .2, -.01); shape.quadraticCurveTo(.1, -.008, 0, -.018); shape.lineTo(0, .012);
    return new THREE.ShapeGeometry(shape, 8);
  }, []);
  useEffect(() => () => wing.dispose(), [wing]);
  useFrame(({clock}) => {
    if (reducedMotion.current) return;
    const t = clock.elapsedTime;
    birds.forEach((bird,index) => {
      const group = birdRefs.current[index];
      if (!group) return;
      const progress = (bird.phase + t * bird.speed) % 1;
      group.position.x = -4.65 + progress * 9.3;
      // Birds alternate a burst of flaps with a glide, rising while they flap and sinking gently in the glide.
      const cycle = (t * .32 + index * .37) % 1;
      const flapping = THREE.MathUtils.smoothstep(cycle, 0, .08) * (1 - THREE.MathUtils.smoothstep(cycle, .45, .55));
      group.position.y = bird.y + Math.sin(t * .34 + index) * .06 + Math.sin(cycle * Math.PI * 2) * .05;
      group.rotation.z = Math.sin(t * .5 + index * 2) * .12;
      const flap = Math.sin(t * (7.5 + index * .4) + index) * .55 * flapping + (1 - flapping) * .12;
      group.children[0].rotation.z = .1 + flap;
      group.children[1].rotation.z = -.1 - flap;
    });
  });
  return <group>{birds.map((bird,index)=><group key={index} ref={node => { birdRefs.current[index] = node; }} position={[-4.65+bird.phase*9.3,bird.y,-6.05]} scale={bird.scale * 1.15}>
    <mesh geometry={wing} scale={[-1,1,1]}><meshBasicMaterial color="#4b443b" transparent opacity={.72} side={THREE.DoubleSide}/></mesh>
    <mesh geometry={wing}><meshBasicMaterial color="#4b443b" transparent opacity={.72} side={THREE.DoubleSide}/></mesh>
    <mesh scale={[.045,.016,.016]}><sphereGeometry args={[1,10,6]}/><meshBasicMaterial color="#4b443b" transparent opacity={.72}/></mesh>
  </group>)}</group>;
}

function AtmosphericStoryMotion() {
  return <group><CoffeeSteam/><DriftingLeaves/><WindResponsiveProps/><DistantBirds/></group>;
}

function HobbyDetails() {
  return null;
}

export default function Room({ activeFocus, onFocus, windGust = 0, projectTheatre = false }: { activeFocus: FocusName; onFocus: (name: FocusName) => void; windGust?: number; projectTheatre?: boolean }) {
  return <SurfaceTextureProvider><WindGustContext.Provider value={windGust}><ProjectTheatreContext.Provider value={projectTheatre}><group position={[0,-1.2,0]}>
    <Architecture/>
    <LandscapeDepth/>
    <CinematicExteriorBackdrop/>
    <DrapedCurtain position={[WINDOW.left + .42,.12,WINDOW.wall + .3]} width={.95} height={5.0} side={-1}/>
    <BalconyDetails/>
    <WallDetails/>
    <ShelfAccents/>
    <RoundRug position={[-.15,.1,1.45]} radius={2.75}/>
    <group position={[.15,0,.45]} scale={[1.08,1,1]}>
      <group position={[-.15,0,.15]} scale={[1.15,1,1.15]}>
        <CentralTable active={activeFocus} onFocus={onFocus}/>
      </group>
      <TableDressing active={activeFocus} onFocus={onFocus}/>
    </group>
    <group position={[-.12,0,.15]} scale={1.08}><Lounge/></group>
    <CozyCat position={[-4.42,.72,.94]} rotation={[0,.08,0]} scale={.6}/>
    <LoungeDetails/>
    <Workstation active={activeFocus} onFocus={onFocus}/>
    <ArchitectLamp position={[2.5,1.13,-2.35]} rotation={[0,.5,0]}/>
    <FloorDetails/>
    <MusicStation/>
    <RoomAccents/>
    <Hobbies/>
    <HobbyDetails/>
    <Plant position={[4.95,.05,-3.5]} scale={1.1}/>
    <AtmosphericStoryMotion/>
    <WarmDust/>
  </group></ProjectTheatreContext.Provider></WindGustContext.Provider></SurfaceTextureProvider>;
}
