"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

function roundedRectangle(width: number, height: number, radius: number) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

/** Rounded in plan as well as in section, with its underside exactly at y=0. */
function roundedSlab(width: number, length: number, height: number, radius: number, bevel: number) {
  const geometry = new THREE.ExtrudeGeometry(
    roundedRectangle(width - bevel * 2, length - bevel * 2, radius - bevel),
    { depth: height - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 12, steps: 1 },
  );
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bevel, 0);
  geometry.computeVertexNormals();
  return geometry;
}

function canvasTexture(width: number, height: number, paint: (context: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext("2d")!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function paintBear(context: CanvasRenderingContext2D) {
  context.fillStyle = "#b58144";
  for (const x of [74, 182]) {
    context.beginPath();
    context.ellipse(x, 74, 31, 34, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.fillStyle = "#d8a45f";
  context.beginPath();
  context.ellipse(128, 139, 82, 78, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#f3d7a5";
  context.beginPath();
  context.ellipse(128, 170, 38, 28, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#47372b";
  for (const x of [96, 160]) {
    context.beginPath();
    context.ellipse(x, 130, 7, 9, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.beginPath();
  context.ellipse(128, 157, 10, 7, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#60442e";
  context.lineWidth = 4;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(128, 160);
  context.lineTo(128, 174);
  context.quadraticCurveTo(119, 181, 113, 175);
  context.moveTo(128, 174);
  context.quadraticCurveTo(136, 181, 143, 175);
  context.stroke();
}

/** One continuous ceramic shell: the rim, inner wall and interior floor are real geometry. */
export function CoffeeMug() {
  const assets = useMemo(() => {
    const profile = [
      [0, -.29], [.22, -.29], [.255, -.287], [.277, -.267], [.291, -.235],
      [.329, .22], [.337, .249], [.338, .265], [.331, .282], [.319, .289],
      [.307, .286], [.299, .278], [.298, .26], [.286, -.19], [.277, -.211], [.255, -.219], [0, -.219],
    ].map(([radius, height]) => new THREE.Vector2(radius, height));
    const body = new THREE.LatheGeometry(profile, 64);
    const handlePath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(.303, .17, 0), new THREE.Vector3(.427, .184, 0),
      new THREE.Vector3(.527, .131, 0), new THREE.Vector3(.557, .028, 0),
      new THREE.Vector3(.524, -.092, 0), new THREE.Vector3(.437, -.163, 0),
      new THREE.Vector3(.298, -.157, 0),
    ]);
    const handle = new THREE.TubeGeometry(handlePath, 36, .043, 10, false);
    const rim = new THREE.TorusGeometry(.318, .009, 8, 64);
    rim.rotateX(Math.PI / 2);
    const coffee = new THREE.CircleGeometry(.294, 64);
    coffee.rotateX(-Math.PI / 2);
    const meniscus = new THREE.TorusGeometry(.286, .006, 6, 64);
    meniscus.rotateX(Math.PI / 2);
    const coaster = roundedSlab(.81, .76, .03, .065, .006);

    const ceramicMap = canvasTexture(512, 256, context => {
      context.fillStyle = "#8c9b77";
      context.fillRect(0, 0, 512, 256);
      for (let i = 0; i < 750; i++) {
        const seed = Math.sin(i * 12.9898 + 77) * 43758.5453;
        const seed2 = Math.sin(i * 78.233 + 17) * 43758.5453;
        const x = (seed - Math.floor(seed)) * 512;
        const y = (seed2 - Math.floor(seed2)) * 256;
        context.fillStyle = i % 2 ? "rgba(248,235,198,.12)" : "rgba(44,64,36,.07)";
        context.beginPath();
        context.arc(x, y, i % 4 === 0 ? .8 : .45, 0, Math.PI * 2);
        context.fill();
      }
    });
    const bearMap = canvasTexture(256, 256, paintBear);
    // A curved decal follows the tapered wall, so the illustration never floats off the cup.
    const decal = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const columns = 24;
    for (let row = 0; row <= 1; row++) {
      const y = -.165 + row * .275;
      const radius = .291 + (y + .235) / .455 * .038 + .0012;
      for (let column = 0; column <= columns; column++) {
        const u = column / columns;
        const angle = (u - .5) * 1.03;
        vertices.push(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
        uvs.push(u, row);
        if (!row && column < columns) {
          const a = column;
          const b = column + 1;
          const c = columns + 1 + column;
          const d = c + 1;
          indices.push(a, b, d, a, d, c);
        }
      }
    }
    decal.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    decal.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    decal.setIndex(indices);
    decal.computeVertexNormals();

    const ceramicMaterial = new THREE.MeshPhysicalMaterial({ map: ceramicMap, roughness: .42, metalness: 0, clearcoat: .9, clearcoatRoughness: .12 });
    const handleMaterial = new THREE.MeshPhysicalMaterial({ color: "#87966e", roughness: .42, clearcoat: .9, clearcoatRoughness: .12 });
    const rimMaterial = new THREE.MeshPhysicalMaterial({ color: "#e8d8ad", roughness: .3, clearcoat: .9, clearcoatRoughness: .1 });
    const coffeeMaterial = new THREE.MeshPhysicalMaterial({ color: "#2d190e", roughness: .16, specularIntensity: .45, envMapIntensity: .35 });
    const meniscusMaterial = new THREE.MeshStandardMaterial({ color: "#8f653a", roughness: .32, envMapIntensity: .2 });
    const coasterMaterial = new THREE.MeshStandardMaterial({ color: "#b98353", roughness: .81 });
    const decalMaterial = new THREE.MeshStandardMaterial({ map: bearMap, transparent: true, alphaTest: .1, roughness: .4, depthWrite: false });
    return { body, handle, rim, coffee, meniscus, coaster, decal, ceramicMap, bearMap, ceramicMaterial, handleMaterial, rimMaterial, coffeeMaterial, meniscusMaterial, coasterMaterial, decalMaterial };
  }, []);
  useEffect(() => () => Object.values(assets).forEach(asset => asset.dispose()), [assets]);
  return <group dispose={null}>
    <mesh geometry={assets.coaster} material={assets.coasterMaterial} position={[0, -.32, 0]} castShadow receiveShadow />
    <mesh geometry={assets.body} material={assets.ceramicMaterial} castShadow receiveShadow />
    <mesh geometry={assets.handle} material={assets.handleMaterial} castShadow receiveShadow />
    <mesh geometry={assets.rim} material={assets.rimMaterial} position={[0, .28, 0]} receiveShadow />
    <mesh geometry={assets.coffee} material={assets.coffeeMaterial} position={[0, .239, 0]} receiveShadow />
    <mesh geometry={assets.meniscus} material={assets.meniscusMaterial} position={[0, .24, 0]} />
    <mesh geometry={assets.decal} material={assets.decalMaterial} />
  </group>;
}

function paintContactScreen(context: CanvasRenderingContext2D) {
  context.fillStyle = "#263c43";
  context.fillRect(0, 0, 400, 700);
  const wash = context.createLinearGradient(0, 0, 400, 700);
  wash.addColorStop(0, "rgba(142,171,147,.18)");
  wash.addColorStop(1, "rgba(12,30,40,0)");
  context.fillStyle = wash;
  context.fillRect(0, 0, 400, 700);
  context.fillStyle = "#e5e9db";
  context.font = "500 19px system-ui, sans-serif";
  context.fillText("9:41", 26, 40);
  context.fillRect(332, 24, 31, 13);
  context.fillRect(364, 28, 3, 5);
  context.fillStyle = "#12252b";
  context.beginPath();
  context.roundRect(150, 10, 100, 20, 10);
  context.fill();
  context.fillStyle = "#75968c";
  context.beginPath();
  context.arc(200, 239, 100, 0, Math.PI * 2);
  context.fill();
  context.save();
  context.beginPath();
  context.arc(200, 239, 96, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = "#e1cbad";
  context.fillRect(96, 135, 208, 208);
  context.fillStyle = "#8ba1a0";
  context.beginPath();
  context.ellipse(200, 340, 78, 69, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#c89570";
  context.fillRect(184, 264, 32, 33);
  context.fillStyle = "#dfb58b";
  context.beginPath();
  context.ellipse(200, 231, 48, 57, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#654737";
  context.beginPath();
  context.moveTo(149, 233);
  context.bezierCurveTo(131, 162, 205, 145, 241, 174);
  context.bezierCurveTo(260, 185, 259, 218, 246, 234);
  context.lineTo(235, 201);
  context.quadraticCurveTo(206, 216, 176, 198);
  context.lineTo(159, 231);
  context.closePath();
  context.fill();
  context.fillStyle = "#493c35";
  for (const x of [183, 218]) {
    context.beginPath();
    context.ellipse(x, 233, 3.5, 5, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.strokeStyle = "#a77258";
  context.lineWidth = 3;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(188, 258);
  context.quadraticCurveTo(200, 267, 213, 258);
  context.stroke();
  context.restore();
  context.textAlign = "center";
  context.fillStyle = "#f0e5ca";
  context.font = "600 35px system-ui, sans-serif";
  context.fillText("Manuel", 200, 406);
  context.fillStyle = "#a7beb0";
  context.font = "500 20px system-ui, sans-serif";
  context.fillText("LET’S TALK", 200, 446);
  for (const x of [132, 267]) {
    context.fillStyle = "#8ba88b";
    context.beginPath();
    context.arc(x, 538, 42, 0, Math.PI * 2);
    context.fill();
  }
  context.strokeStyle = "#f6edda";
  context.lineWidth = 7;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(117, 520);
  context.bezierCurveTo(111, 536, 125, 556, 145, 554);
  context.lineTo(150, 545);
  context.lineTo(141, 540);
  context.lineTo(136, 545);
  context.quadraticCurveTo(126, 541, 125, 531);
  context.lineTo(130, 527);
  context.lineTo(124, 516);
  context.closePath();
  context.stroke();
  context.lineWidth = 4;
  context.beginPath();
  context.roundRect(245, 523, 43, 31, 4);
  context.moveTo(247, 525);
  context.lineTo(267, 540);
  context.lineTo(286, 525);
  context.stroke();
  context.fillStyle = "rgba(224,235,216,.64)";
  context.beginPath();
  context.roundRect(142, 665, 116, 6, 3);
  context.fill();
}

/** A slim case, inset glass and one legible screen replace stacked face primitives. */
export function ContactPhone() {
  const assets = useMemo(() => {
    const body = roundedSlab(.56, .92, .077, .074, .012);
    const bezel = roundedSlab(.507, .864, .011, .06, .003);
    const screen = new THREE.ShapeGeometry(roundedRectangle(.467, .799, .048), 16);
    // ShapeGeometry uses world-coordinate UVs; normalize them for the portrait artwork.
    const positions = screen.getAttribute("position");
    const uv = screen.getAttribute("uv");
    for (let index = 0; index < positions.count; index++) {
      uv.setXY(index, positions.getX(index) / .467 + .5, positions.getY(index) / .799 + .5);
    }
    uv.needsUpdate = true;
    screen.rotateX(-Math.PI / 2);
    const button = new THREE.BoxGeometry(.011, .027, .102);
    const port = new THREE.BoxGeometry(.057, .011, .004);
    const speaker = new THREE.SphereGeometry(.007, 8, 6);
    const screenTexture = canvasTexture(400, 700, paintContactScreen);
    const bodyMaterial = new THREE.MeshPhysicalMaterial({ color: "#91a56c", roughness: .5, sheen: .4, sheenRoughness: .6, sheenColor: new THREE.Color("#e8f0d0") });
    const bezelMaterial = new THREE.MeshPhysicalMaterial({ color: "#182125", roughness: .2, clearcoat: 1, clearcoatRoughness: .05 });
    const buttonMaterial = new THREE.MeshStandardMaterial({ color: "#627d4d", roughness: .54 });
    const portMaterial = new THREE.MeshStandardMaterial({ color: "#283827", roughness: .8 });
    const screenMaterial = new THREE.MeshBasicMaterial({ map: screenTexture, color: "#e4e9dc", toneMapped: false });
    return { body, bezel, screen, button, port, speaker, screenTexture, bodyMaterial, bezelMaterial, buttonMaterial, portMaterial, screenMaterial };
  }, []);
  useEffect(() => () => Object.values(assets).forEach(asset => asset.dispose()), [assets]);
  return <group rotation={[0, -.12, 0]} dispose={null}>
    <mesh geometry={assets.body} material={assets.bodyMaterial} castShadow receiveShadow />
    <mesh geometry={assets.bezel} material={assets.bezelMaterial} position={[0, .073, 0]} castShadow />
    <mesh geometry={assets.screen} material={assets.screenMaterial} position={[0, .085, 0]} />
    <mesh geometry={assets.button} material={assets.buttonMaterial} position={[.28, .039, -.13]} />
    <mesh geometry={assets.button} material={assets.buttonMaterial} position={[-.28, .039, -.16]} scale={[1, 1, 1.35]} />
    <mesh geometry={assets.port} material={assets.portMaterial} position={[0, .035, .459]} />
    {[-.158, -.127, -.096, .096, .127, .158].map(x => <mesh key={x} geometry={assets.speaker} material={assets.portMaterial} position={[x, .037, .458]} scale={[1, 1, .32]} />)}
  </group>;
}

/** Four physical key rows share one draw call, including the space bar and accent key. */
export function DesktopKeyboard() {
  const assets = useMemo(() => {
    const frame = roundedSlab(1.28, .42, .045, .051, .008);
    const recess = roundedSlab(1.207, .354, .006, .025, .002);
    const keycap = roundedSlab(.07, .062, .022, .011, .0035);
    const frameMaterial = new THREE.MeshStandardMaterial({ color: "#899479", roughness: .6 });
    const recessMaterial = new THREE.MeshStandardMaterial({ color: "#59654f", roughness: .86 });
    const keyMaterial = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: .64 });
    const layout: Array<{ x: number; z: number; width: number; accent?: boolean }> = [];
    for (let column = 0; column < 14; column++) {
      layout.push({ x: -.546 + column * .084, z: -.126, width: .07, accent: column === 0 });
    }
    for (let column = 0; column < 13; column++) {
      layout.push({ x: -.52 + column * .084, z: -.042, width: column === 12 ? .1 : .07 });
    }
    for (let column = 0; column < 12; column++) {
      layout.push({ x: -.5 + column * .089, z: .042, width: column === 0 || column === 11 ? .096 : .072 });
    }
    [-.546, -.455, -.364].forEach(x => layout.push({ x, z: .126, width: .075 }));
    layout.push({ x: -.059, z: .126, width: .446 });
    [.258, .35, .442, .534].forEach(x => layout.push({ x, z: .126, width: .074 }));
    const keys = new THREE.InstancedMesh(keycap, keyMaterial, layout.length);
    const transform = new THREE.Object3D();
    const ivory = new THREE.Color("#e9dfc4");
    const coral = new THREE.Color("#ca8065");
    layout.forEach((key, index) => {
      transform.position.set(key.x, .048, key.z);
      transform.scale.set(key.width / .07, 1, 1);
      transform.updateMatrix();
      keys.setMatrixAt(index, transform.matrix);
      keys.setColorAt(index, key.accent ? coral : ivory);
    });
    keys.instanceMatrix.needsUpdate = true;
    if (keys.instanceColor) keys.instanceColor.needsUpdate = true;
    keys.castShadow = true;
    keys.receiveShadow = true;
    keys.computeBoundingSphere();
    return { frame, recess, keycap, frameMaterial, recessMaterial, keyMaterial, keys };
  }, []);
  useEffect(() => () => Object.values(assets).forEach(asset => asset.dispose()), [assets]);
  return <group dispose={null}>
    <mesh geometry={assets.frame} material={assets.frameMaterial} castShadow receiveShadow />
    <mesh geometry={assets.recess} material={assets.recessMaterial} position={[0, .039, 0]} receiveShadow />
    <primitive object={assets.keys} />
  </group>;
}
