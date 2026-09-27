"use client";

import { Line, RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { breakEvenMonths, PROJECTS, PROJECT_REVEAL, ROI_DEMO, type ProjectId } from "@/lib/project-theatre";
import SelectionVFX from "./SelectionVFX";

export type TheatreProps = {
  selected: ProjectId | null;
  sequence: number;
  startedAt: number;
  investment: number;
  reading: boolean;
  compact: boolean;
  onSelect: (id: ProjectId) => void;
  onAccent: () => void;
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => { const media = matchMedia("(prefers-reduced-motion: reduce)"); const update = () => setReduced(media.matches); update(); media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, []);
  return reduced;
}

function Label({ text, position, width = 1.7, height = .22, color = "#fff0d1", paper = false }: { text: string; position: [number, number, number]; width?: number; height?: number; color?: string; paper?: boolean }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = Math.min(2048, Math.ceil(128 * width / height)); canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    if (paper) { ctx.fillStyle = "#eedfc1"; ctx.beginPath(); ctx.roundRect(0, 0, canvas.width, 128, 18); ctx.fill(); }
    ctx.fillStyle = color; ctx.font = "500 96px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, 65, canvas.width - 26);
    const result = new THREE.CanvasTexture(canvas); result.colorSpace = THREE.SRGBColorSpace; result.anisotropy = 4; return result;
  }, [text, color, paper, width, height]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={position} renderOrder={6} raycast={() => {}}><planeGeometry args={[width, height]}/><meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false}/></mesh>;
}

function ProjectBook({ id, selected, onSelect, reduced, reading, startedAt }: { id: ProjectId; selected: ProjectId | null; onSelect: TheatreProps["onSelect"]; reduced: boolean; reading: boolean; startedAt: number }) {
  const group = useRef<THREE.Group>(null), cover = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const data = PROJECTS[id], active = id === selected;
  useFrame(({ clock }, dt) => {
    if (!group.current || !cover.current || reading) return;
    const age = (performance.now() - startedAt) / 1000;
    const choice = selected === null;
    const x = choice ? (id === "roi" ? -1.25 : 1.25) : active ? .35 : (id === "roi" ? -2.8 : 2.8);
    const y = choice ? -.06 : -.73;
    const bob = reduced ? 0 : Math.sin(clock.elapsedTime * 1.2 + (id === "roi" ? 0 : 2)) * .045;
    const damp = (a: number, b: number) => reduced ? b : THREE.MathUtils.damp(a, b, 6, dt);
    group.current.position.x = damp(group.current.position.x, x);
    group.current.position.y = damp(group.current.position.y, y + bob + (hovered ? .08 : 0));
    group.current.scale.setScalar(damp(group.current.scale.x, choice ? 1 : active ? .35 : .23));
    group.current.rotation.x = damp(group.current.rotation.x, active ? -.68 : -.12);
    group.current.rotation.z = damp(group.current.rotation.z, choice ? (id === "roi" ? -.07 : .07) : 0);
    cover.current.rotation.y = damp(cover.current.rotation.y, active && (reduced || age > .4) ? -2.65 : hovered ? -.14 : 0);
  });
  return <group ref={group} position={[id === "roi" ? -1.25 : 1.25, -.1, 0]} onClick={e => { e.stopPropagation(); onSelect(id); }} onPointerOver={e => {e.stopPropagation(); setHovered(true); document.body.style.cursor="pointer";}} onPointerOut={() => {setHovered(false); document.body.style.cursor="default";}}>
    <RoundedBox args={[1.72, 1.98, .11]} radius={.06} position={[0,0,-.09]}><meshStandardMaterial color={data.cover} roughness={.65}/></RoundedBox>
    <RoundedBox args={[1.57, 1.83, .16]} radius={.025} position={[.02,0,.045]}><meshStandardMaterial color="#eddfbf" roughness={.92}/></RoundedBox>
    {[0,1,2,3].map(i => <mesh key={i} position={[.025,-.906,.008+i*.035]}><boxGeometry args={[1.49,.009,.009]}/><meshStandardMaterial color="#c5b28c"/></mesh>)}
    <group ref={cover} position={[-.86,0,.15]}>
      <RoundedBox args={[1.72,1.98,.08]} radius={.065} position={[.86,0,0]}><meshStandardMaterial color={data.cover} roughness={.56} metalness={.035}/></RoundedBox>
      <Label text={id === "roi" ? "ROI & VALUE" : "COMMUNITY"} position={[.86,.18,.055]} width={1.4} height={.21} color="#413d2d" paper/>
      <Label text={id === "roi" ? "CALCULATOR" : "ANALYZER"} position={[.86,-.08,.055]} width={1.15} height={.17}/>
      <Label text={`MANUEL STRUNZ / ${data.index}`} position={[.86,-.72,.055]} width={1.22} height={.12}/>
      <mesh position={[.86,.63,.06]}><torusGeometry args={[.12,.01,6,32]}/><meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={hovered ? .8 : .1}/></mesh>
    </group>
    <Label text={id === "roi" ? "IDEAS INTO VALUE" : "DATA INTO KNOWLEDGE"} position={[.04,.15,.137]} width={1.38} height={.18} color="#66533b"/>
    <mesh position={[-.835,0,.02]}><boxGeometry args={[.085,1.93,.22]}/><meshStandardMaterial color={data.cover} roughness={.85}/></mesh>
  </group>;
}

function ROIProjection({ investment, time, compact, reduced, reading, onAccent }: { investment: number; time: React.RefObject<number>; compact: boolean; reduced: boolean; reading: boolean; onAccent: () => void }) {
  const root = useRef<THREE.Group>(null), marker = useRef<THREE.Group>(null), line = useRef<THREE.Mesh>(null), investmentLine = useRef<THREE.Group>(null);
  const month = breakEvenMonths(investment)!;
  const pointX = -2.05 + month / 24 * 4.1, pointY = .03 + investment / ROI_DEMO.ceiling * 1.63;
  const geometry = useMemo(() => new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(-2.05,.03,.05), new THREE.Vector3(2.05,.03+ROI_DEMO.annualBenefit*2/ROI_DEMO.ceiling*1.63,.05)), 96, .018, 6, false), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const fs = compact ? .25 : .18;
  useFrame(({ clock }, dt) => {
    if (reading) return;
    const t = time.current;
    const progress = reduced ? 1 : THREE.MathUtils.smoothstep(t, .6, 1.2);
    if (root.current) { root.current.scale.setScalar(Math.max(.001,progress)); root.current.position.y = reduced ? 0 : Math.sin(clock.elapsedTime*.8)*.035; }
    // Reach this demo's actual intersection on the sound/light impact beat, then continue.
    const crossing = month / ROI_DEMO.months;
    const growth = reduced ? 1 : t < PROJECT_REVEAL.impact ? crossing * THREE.MathUtils.clamp((t-.85)/(PROJECT_REVEAL.impact-.85),0,1) : THREE.MathUtils.lerp(crossing,1,THREE.MathUtils.smoothstep(t,PROJECT_REVEAL.impact,4.1));
    geometry.setDrawRange(0, Math.floor((geometry.index!.count * growth)/36)*36);
    if (marker.current) { marker.current.position.x = reduced ? pointX : THREE.MathUtils.damp(marker.current.position.x,pointX,9,dt); marker.current.position.y = reduced ? pointY : THREE.MathUtils.damp(marker.current.position.y,pointY,9,dt); marker.current.scale.setScalar(reduced ? 1 : .7 + THREE.MathUtils.smoothstep(t,2.55,2.8)*.3); }
    if (investmentLine.current) investmentLine.current.position.y = reduced ? pointY : THREE.MathUtils.damp(investmentLine.current.position.y,pointY,9,dt);
  });
  return <group ref={root}>
    <Line points={[[-2.05,1.72,0],[-2.05,.03,0],[2.05,.03,0]]} color="#c9b997" transparent opacity={.55} lineWidth={1}/>
    {[0,12,24].map(m=><group key={m} position={[-2.05+m/24*4.1,0,0]}><Line points={[[0,.03,0],[0,1.68,0]]} color="#c7b58d" transparent opacity={.12} lineWidth={1}/><Label text={`${m} M`} position={[0,-.14,.04]} width={.5} height={fs}/></group>)}
    <Label text="€" position={[-2.28,1.76,.04]} width={.25} height={fs}/>
    <Label text="0" position={[-2.27,.03,.04]} width={.25} height={fs}/>
    <group ref={investmentLine} position={[0,pointY,0]}><Line points={[[-2.05,0,.035],[2.05,0,.035]]} color="#e6a27e" lineWidth={2}/><Label text="Investition" position={[1.55,-.16,.06]} width={1} height={fs}/></group>
    <mesh ref={line} geometry={geometry}><meshBasicMaterial color={[2.1,1.32,.55]} toneMapped={false}/></mesh>
    <Label text="Kumulierter Mehrwert" position={[1.12,1.87,.05]} width={2} height={fs} color="#ffdc98"/>
    <group ref={marker} position={[pointX,pointY,.07]} onClick={e=>{e.stopPropagation();onAccent();}}>
      <mesh><sphereGeometry args={[.065,20,12]}/><meshBasicMaterial color={[3,2.1,1]} toneMapped={false}/></mesh>
      <mesh><sphereGeometry args={[.23,16,10]}/><meshBasicMaterial color="#ffcf7e" transparent opacity={.1} depthWrite={false}/></mesh>
      <Label text="BREAK EVEN" position={[0,.43,.07]} width={1.6} height={fs*1.15}/>
      <Label text={`${month.toLocaleString("de-AT",{maximumFractionDigits:1})} Monate`} position={[0,.22,.07]} width={1.25} height={fs} color="#ffcf7e"/>
    </group>
  </group>;
}

const NETWORK = Array.from({length:30},(_,i)=>{const cluster=i%3, angle=i*2.399;const centers=[[-1.22,.96],[1.22,.96],[0,-.02]];return new THREE.Vector3(centers[cluster][0]+Math.cos(angle)*(.17+(i%5)*.085),centers[cluster][1]+Math.sin(angle)*(.15+(i%4)*.09),Math.sin(i*1.7)*.22);});
const EDGES = NETWORK.flatMap((_,i)=>i<12?[[i,(i+3)%30],[i,(i+1)%30]]:[[i,(i+3)%30]]);

function CommunityProjection({ time, reduced, reading, compact, onAccent }: { time: React.RefObject<number>; reduced: boolean; reading: boolean; compact: boolean; onAccent: () => void }) {
  const nodes = useRef<THREE.InstancedMesh>(null), packets = useRef<THREE.InstancedMesh>(null);
  const [hovered,setHovered] = useState<number|null>(null);
  const dummy=useMemo(()=>new THREE.Object3D(),[]);
  const geometry=useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.BufferAttribute(new Float32Array(EDGES.length*6),3));g.setAttribute("color",new THREE.BufferAttribute(new Float32Array(EDGES.length*6),3));return g;},[]);
  const colors=useMemo(()=>[new THREE.Color("#f4c98a"),new THREE.Color("#b9dcc4"),new THREE.Color("#a9cbd0")],[]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  useFrame(({clock})=>{
    if(reading || !nodes.current || !packets.current)return;
    const t=time.current, spread=reduced?1:THREE.MathUtils.smoothstep(t,.5,2.65);
    const pos=geometry.attributes.position as THREE.BufferAttribute,col=geometry.attributes.color as THREE.BufferAttribute;
    NETWORK.forEach((p,i)=>{dummy.position.copy(p).multiplyScalar(spread);dummy.position.y+=reduced?0:Math.sin(clock.elapsedTime*.7+i)*.018;dummy.scale.setScalar(hovered===i?.11:i%7===0?.065:.041);dummy.updateMatrix();nodes.current!.setMatrixAt(i,dummy.matrix);nodes.current!.setColorAt(i,colors[i%3]);});
    EDGES.forEach(([a,b],i)=>{pos.setXYZ(i*2,NETWORK[a].x*spread,NETWORK[a].y*spread,NETWORK[a].z*spread);pos.setXYZ(i*2+1,NETWORK[b].x*spread,NETWORK[b].y*spread,NETWORK[b].z*spread);const c=colors[a%3],level=hovered===null?.48:hovered===a||hovered===b?1.5:.1;col.setXYZ(i*2,c.r*level,c.g*level,c.b*level);col.setXYZ(i*2+1,c.r*level,c.g*level,c.b*level);});
    for(let i=0;i<12;i++){const [a,b]=EDGES[i*3],travel=reduced?.5:(clock.elapsedTime*(t<3?.7:.17)+i*.083)%1;dummy.position.lerpVectors(NETWORK[a],NETWORK[b],travel).multiplyScalar(spread);dummy.scale.setScalar(reduced?0:.023);dummy.updateMatrix();packets.current.setMatrixAt(i,dummy.matrix);}
    pos.needsUpdate=true;col.needsUpdate=true;nodes.current.instanceMatrix.needsUpdate=true;if(nodes.current.instanceColor)nodes.current.instanceColor.needsUpdate=true;packets.current.instanceMatrix.needsUpdate=true;
  });
  return <group position={[0,.42,0]}>
    <lineSegments geometry={geometry}><lineBasicMaterial vertexColors transparent opacity={.85} toneMapped={false}/></lineSegments>
    <instancedMesh ref={nodes} args={[undefined,undefined,30]} frustumCulled={false} onPointerMove={e=>{e.stopPropagation();if(reading)return;if(e.instanceId!==undefined&&e.instanceId!==hovered){setHovered(e.instanceId);onAccent();}document.body.style.cursor="pointer";}} onPointerOut={()=>{setHovered(null);document.body.style.cursor="default";}} onClick={e=>{e.stopPropagation();if(!reading)onAccent();}}><sphereGeometry args={[1,12,8]}/><meshStandardMaterial roughness={.32} metalness={.15} emissive="#c1ddad" emissiveIntensity={.5}/></instancedMesh>
    <instancedMesh ref={packets} args={[undefined,undefined,12]} frustumCulled={false}><sphereGeometry args={[1,8,6]}/><meshBasicMaterial color={[2.1,2.4,1.6]} toneMapped={false}/></instancedMesh>
    <Label text="FORSCHER:INNEN" position={[-1.3,1.76,.2]} width={1.85} height={compact?.24:.19}/>
    <Label text="PUBLIKATIONEN" position={[1.3,1.76,.2]} width={1.85} height={compact?.24:.19}/>
    <Label text={hovered===null?"COMMUNITIES":`VERBINDUNGEN / ${String(hovered+1).padStart(2,"0")}`} position={[0,-.57,.15]} width={2.5} height={compact?.24:.19}/>
  </group>;
}

function ModuleLeaves({time,reduced,reading}: {time:React.RefObject<number>;reduced:boolean;reading:boolean}) {
  const mesh=useRef<THREE.InstancedMesh>(null),dummy=useMemo(()=>new THREE.Object3D(),[]);
  useFrame(()=>{
    if(!mesh.current)return;
    const t=time.current;mesh.current.visible=!reduced&&!reading&&t>.6&&t<4.3;
    if(!mesh.current.visible)return;
    for(let i=0;i<11;i++){
      const phase=THREE.MathUtils.smoothstep(t,.6+i*.035,2.3+i*.035),angle=i/11*Math.PI*2;
      dummy.position.set(Math.cos(angle)*2.65*phase,-.72+(Math.sin(angle)*.82+1.15)*phase,.12+Math.sin(t*2+i)*.13);
      dummy.rotation.set(Math.sin(t*2+i)*.3,Math.cos(t+i)*.5,angle*.16);dummy.scale.setScalar(.5+phase*.5);dummy.updateMatrix();mesh.current.setMatrixAt(i,dummy.matrix);
    }
    (mesh.current.material as THREE.MeshStandardMaterial).opacity=1-THREE.MathUtils.smoothstep(t,2.95,4.3);mesh.current.instanceMatrix.needsUpdate=true;
  });
  return <instancedMesh ref={mesh} args={[undefined,undefined,11]} frustumCulled={false} raycast={()=>{}}><boxGeometry args={[.24,.16,.009]}/><meshStandardMaterial color="#e6ce9a" roughness={.86} transparent depthWrite={false}/></instancedMesh>;
}

export function ProjectTheatreScene(props: TheatreProps) {
  const reduced=useReducedMotion(), root=useRef<THREE.Group>(null), light=useRef<THREE.PointLight>(null), time=useRef(0);
  const {camera,viewport}=useThree();
  const scratch=useMemo(()=>new THREE.Vector3(),[]);
  useFrame(()=>{
    if(!root.current)return;
    root.current.position.copy(camera.position).add(scratch.set(0,0,-4).applyQuaternion(camera.quaternion));root.current.quaternion.copy(camera.quaternion);
    const size=viewport.getCurrentViewport(camera,root.current.position);root.current.scale.setScalar(Math.min(size.width/6.7,size.height/6.2));
    if(!props.reading)time.current=reduced?PROJECT_REVEAL.settle:(performance.now()-props.startedAt)/1000;
    const burst=Math.exp(-Math.pow((time.current-PROJECT_REVEAL.impact)*5,2));
    if(light.current)light.current.intensity=props.reading?0:props.selected?1.7+burst*7:2;
  }, -1);
  return <group ref={root}>
    <mesh position={[0,0,-.85]} raycast={()=>{}}><planeGeometry args={[30,30]}/><meshBasicMaterial color="#18221b" transparent opacity={props.selected ? .94 : .82} depthWrite={false}/></mesh>
    <pointLight ref={light} position={[0,1.3,2]} color={props.selected?PROJECTS[props.selected].color:"#ffdc9d"} intensity={2} distance={7} decay={1}/>
    <ProjectBook id="roi" selected={props.selected} onSelect={props.onSelect} reduced={reduced} reading={props.reading} startedAt={props.startedAt}/>
    <ProjectBook id="community" selected={props.selected} onSelect={props.onSelect} reduced={reduced} reading={props.reading} startedAt={props.startedAt}/>
    {props.selected==="roi"&&<ROIProjection investment={props.investment} time={time} compact={props.compact} reduced={reduced} reading={props.reading} onAccent={props.onAccent}/>}
    {props.selected==="roi"&&<ModuleLeaves time={time} reduced={reduced} reading={props.reading}/>}
    {props.selected==="community"&&<CommunityProjection time={time} compact={props.compact} reduced={reduced} reading={props.reading} onAccent={props.onAccent}/>}
    {props.selected&&<SelectionVFX key={`${props.selected}-${props.sequence}`} time={time} active={!props.reading} destination={props.selected==="roi"?"projects":"about"} reducedMotion={reduced} center={props.selected==="roi"?[-2.05+breakEvenMonths(props.investment)!/24*4.1,.03+props.investment/ROI_DEMO.ceiling*1.63,.05]:[0,.6,.05]} radius={1.5}/>}
  </group>;
}

export function ProjectTheatreHUD({selected,onSelect,onRead,onReplay,investment,onInvestment}: {selected:ProjectId|null;onSelect:TheatreProps["onSelect"];onRead:()=>void;onReplay:()=>void;investment:number;onInvestment:(value:number)=>void}) {
  const project=selected?PROJECTS[selected]:null;
  return <section className="project-theatre-hud" aria-label="Project Theatre">
    <header className="theatre-header"><div><span>MANUEL STRUNZ / SELECTED WORK</span><h1>Project Theatre</h1></div><nav aria-label="Choose a project">{(["roi","community"] as ProjectId[]).map(id=><button key={id} onClick={()=>onSelect(id)} aria-pressed={selected===id}><small>{PROJECTS[id].index}</small>{PROJECTS[id].title}</button>)}</nav></header>
    {!project&&<div className="theatre-invitation"><p>Two projects. Two worlds.</p><span>Wähle ein Projektbuch, um es zum Leben zu erwecken.</span></div>}
    {project&&<footer className="theatre-details" key={selected}>
      <div className="theatre-copy"><div className="theatre-facts">{project.facts.join(" · ")}</div><h2>{project.tagline}</h2><p>{project.summary}</p></div>
      {selected==="roi"&&<label className="theatre-investment">Demo-Investition <strong>{investment.toLocaleString("de-AT")} €</strong><input aria-label="Demo-Investition" type="range" min={150000} max={450000} step={5000} value={investment} onChange={e=>onInvestment(Number(e.target.value))}/><output aria-live="polite">Break-even: {breakEvenMonths(investment)!.toLocaleString("de-AT",{maximumFractionDigits:1})} Monate</output><small>Linearer Mehrwert: 262.027 €/Jahr · unverbindliche Werkzeugwechsler-Demo, keine Kundenergebnisse.</small></label>}
      {selected==="community"&&<p className="theatre-demo">Berühre die Knoten, um Verbindungen aufleuchten zu lassen. Das Netzwerk ist eine visuelle Metapher mit Beispieldaten.</p>}
      <div className="theatre-actions"><button className="theatre-read" onClick={onRead}>Case Study öffnen <span>↗</span></button><button onClick={onReplay} aria-label="Replay project reveal">↻ Reveal erneut abspielen</button></div>
    </footer>}
  </section>;
}
