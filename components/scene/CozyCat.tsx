"use client";

import { asset } from "@/lib/asset";
import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const CAT_MODEL = asset("/models/kenney/cube-pets/animal-cat.glb");

type CatMood = "eat" | "gesture-positive" | "gesture-negative" | "dance";

export default function CozyCat(props: ThreeElements["group"]) {
  const anchor = useRef<THREE.Group>(null);
  const animatedModel = useRef<THREE.Group>(null);
  const reducedMotion = useRef(false);
  const hovered = useRef(false);
  const { scene, animations } = useGLTF(CAT_MODEL);
  const model = useMemo(() => scene.clone(true), [scene]);
  const { actions, mixer } = useAnimations(animations, animatedModel);

  useEffect(() => {
    model.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.color.set("#ffd0b1");
          material.roughness = .76;
          material.metalness = 0;
          material.envMapIntensity = .62;
        }
      });
    });
  }, [model]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reducedMotion.current = media.matches; };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const idle = actions.idle;
    const still = actions.static;
    if (!idle || !still) return;

    const base = reducedMotion.current ? still : idle;
    base.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(.35).play();
    if (reducedMotion.current) return () => base.stop();

    let disposed = false;
    let timer = 0;
    let current = base;
    let moodIndex = 0;
    const moods: CatMood[] = ["eat", "gesture-positive", "eat", "gesture-negative", "dance"];

    const returnToIdle = (from: THREE.AnimationAction) => {
      if (disposed) return;
      idle.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(.32).play();
      from.fadeOut(.32);
      current = idle;
      timer = window.setTimeout(playMood, 6200 + Math.random() * 5200);
    };

    const playMood = () => {
      if (disposed) return;
      const name = moods[moodIndex++ % moods.length];
      const next = actions[name];
      if (!next) {
        timer = window.setTimeout(playMood, 7000);
        return;
      }

      current.fadeOut(.28);
      const repetitions = name === "eat" ? 5 : name === "dance" ? 3 : 2;
      next.reset().setLoop(THREE.LoopRepeat, repetitions).setEffectiveTimeScale(name === "dance" ? .72 : .86);
      next.clampWhenFinished = true;
      next.fadeIn(.28).play();
      current = next;
      const duration = next.getClip().duration * repetitions / next.getEffectiveTimeScale();
      timer = window.setTimeout(() => returnToIdle(next), duration * 1000 + 180);
    };

    timer = window.setTimeout(playMood, 4200);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      mixer.stopAllAction();
    };
  }, [actions, mixer]);

  useFrame(({ clock, pointer }, delta) => {
    if (!anchor.current || reducedMotion.current) return;
    const t = clock.elapsedTime;
    const breath = Math.sin(t * 1.35);
    const curiosityAge = (t + 1.8) % 12.5;
    const curiosity = curiosityAge < 2.4 ? Math.sin(curiosityAge / 2.4 * Math.PI) : 0;
    const attention = hovered.current ? 1 : curiosity;
    const targetScale = 1 + attention * .025;
    anchor.current.position.y = THREE.MathUtils.damp(anchor.current.position.y, breath * .012 + attention * .035, 3.5, delta);
    anchor.current.rotation.x = THREE.MathUtils.damp(anchor.current.rotation.x, -.035 + breath * .008 - attention * .07, 3.8, delta);
    anchor.current.rotation.y = THREE.MathUtils.damp(anchor.current.rotation.y, pointer.x * (.055 + attention * .08) + Math.sin(t * .23) * .035, 2.2, delta);
    anchor.current.rotation.z = THREE.MathUtils.damp(anchor.current.rotation.z, Math.sin(t * .31 + 1.2) * .01, 2.8, delta);
    anchor.current.scale.setScalar(THREE.MathUtils.damp(anchor.current.scale.x, targetScale, 4.5, delta));
  });

  return (
    <group {...props} onPointerEnter={() => { hovered.current = true; }} onPointerLeave={() => { hovered.current = false; }}>
      <mesh position={[0, .018, -.01]} rotation={[-Math.PI / 2, 0, 0]} scale={[.52, .39, 1]} renderOrder={-1}>
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial color="#30251f" transparent opacity={.17} depthWrite={false} />
      </mesh>
      <group ref={anchor}>
        <group ref={animatedModel} scale={[1, .86, 1]}>
          <primitive object={model} />
        </group>
      </group>
    </group>
  );
}

useGLTF.preload(CAT_MODEL);
