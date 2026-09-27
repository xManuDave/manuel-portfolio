"use client";
import { asset } from "@/lib/asset";
import {useRef,useState} from "react";
import {analyzeAudio,createZip,parseName,safeFilename,tagAudio,type Analysis} from "./audio-engine";

type Track={id:string;file:File;title:string;artist:string;status:"ready"|"analyzing"|"done"|"error";analysis?:Analysis;error?:string};
type FileEntry=FileSystemEntry&{file:(cb:(file:File)=>void,error?:(reason:DOMException)=>void)=>void};
type DirectoryEntry=FileSystemEntry&{createReader:()=>{readEntries:(cb:(entries:FileSystemEntry[])=>void)=>void}};

async function entryFiles(entry:FileSystemEntry):Promise<File[]>{
  if(entry.isFile)return [await new Promise<File>((resolve,reject)=>(entry as FileEntry).file(resolve,reject))];
  const reader=(entry as DirectoryEntry).createReader(),all:FileSystemEntry[]=[];while(true){const batch=await new Promise<FileSystemEntry[]>(r=>reader.readEntries(r));if(!batch.length)break;all.push(...batch);}
  return (await Promise.all(all.map(entryFiles))).flat();
}

export default function AudioPrep(){
  const [tracks,setTracks]=useState<Track[]>([]),[drag,setDrag]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");const input=useRef<HTMLInputElement>(null);
  const add=(files:File[])=>{const audio=files.filter(f=>/\.(mp3|wav)$/i.test(f.name));setTracks(old=>[...old,...audio.map(file=>{const parsed=parseName(file.name);return{id:`${file.name}-${file.size}-${crypto.randomUUID()}`,file,...parsed,status:"ready" as const};})]);setMessage(audio.length?`${audio.length} Datei${audio.length===1?"":"en"} bereit.`:"Keine MP3- oder WAV-Dateien gefunden.");};
  const drop=async(e:React.DragEvent)=>{e.preventDefault();setDrag(false);const entries=[...e.dataTransfer.items].map(i=>i.webkitGetAsEntry?.()).filter(Boolean) as FileSystemEntry[];add(entries.length?(await Promise.all(entries.map(entryFiles))).flat():[...e.dataTransfer.files]);};
  const analyze=async()=>{setBusy(true);setMessage("Analyse läuft lokal …");for(const track of tracks.filter(t=>t.status!=="done")){setTracks(v=>v.map(t=>t.id===track.id?{...t,status:"analyzing"}:t));try{const analysis=await analyzeAudio(track.file);setTracks(v=>v.map(t=>t.id===track.id?{...t,status:"done",analysis}:t));}catch(error){setTracks(v=>v.map(t=>t.id===track.id?{...t,status:"error",error:error instanceof Error?error.message:"Analyse fehlgeschlagen"}:t));}}setBusy(false);setMessage("Analyse fertig. Werte prüfen und exportieren.");};
  const update=(id:string,patch:Partial<Track>)=>setTracks(v=>v.map(t=>t.id===id?{...t,...patch}:t));
  const prepared=async(track:Track)=>{const a=track.analysis!,ext=track.file.name.toLowerCase().endsWith(".wav")?"wav":"mp3";return{name:safeFilename(`${track.artist} - ${track.title} [${a.camelot}] [${a.bpm} BPM].${ext}`),blob:await tagAudio(track.file,{title:track.title,artist:track.artist,bpm:a.bpm,key:a.key,camelot:a.camelot})};};
  const exportAll=async()=>{const complete=tracks.filter(t=>t.analysis);if(!complete.length)return;setBusy(true);let directory:FileSystemDirectoryHandle|undefined;try{directory=await window.showDirectoryPicker?.({mode:"readwrite"});}catch{setMessage("Kein Zielordner gewählt – Dateien werden einzeln heruntergeladen.");}
    for(const track of complete){const{name,blob}=await prepared(track);if(directory){const handle=await directory.getFileHandle(name,{create:true}),writer=await handle.createWritable();await writer.write(blob);await writer.close();}else{const url=URL.createObjectURL(blob),anchor=document.createElement("a");anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}
    setBusy(false);setMessage(`${complete.length} Track${complete.length===1?"":"s"} fertig exportiert.`);};
  const exportZip=async()=>{const complete=tracks.filter(t=>t.analysis);if(complete.length<4)return;setBusy(true);setMessage("ZIP-Paket wird erstellt …");const files=[];for(const track of complete)files.push(await prepared(track));const zip=await createZip(files),url=URL.createObjectURL(zip),anchor=document.createElement("a");anchor.href=url;anchor.download=`rekordbox-tracks-${new Date().toISOString().slice(0,10)}.zip`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1500);setBusy(false);setMessage(`${complete.length} Tracks als ZIP heruntergeladen.`);};
  return <main className="prep-shell">
    <header className="prep-top"><a href={asset("/")}>← Portfolio</a><div className="prep-brand"><span>MS</span><div><strong>TRACK PREP</strong><small>REKORDBOX EDITION</small></div></div><div className="local-pill"><i/> 100% lokal</div></header>
    <section className="prep-hero"><p className="eyebrow">DJ LIBRARY WORKSHOP · 01</p><h1>Roh rein.<br/><em>Ready raus.</em></h1><p>BPM und Tonart analysieren, sauber benennen und mit Rekordbox-kompatiblen Metadaten versehen.</p></section>
    <section className={`drop-zone ${drag?"is-dragging":""}`} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={drop} onClick={()=>input.current?.click()}>
      <input ref={input} hidden type="file" accept=".mp3,.wav,audio/mpeg,audio/wav" multiple onChange={e=>add([...e.target.files??[]])}/><div className="vinyl"><div/><span>＋</span></div><div><strong>Tracks oder Ordner hier ablegen</strong><p>MP3 & WAV · Mehrfachauswahl möglich</p></div><button type="button">Dateien wählen</button>
    </section>
    {tracks.length>0&&<section className="workbench"><div className="bench-head"><div><p className="eyebrow">WARTESCHLANGE</p><h2>{tracks.length} Track{tracks.length===1?"":"s"}</h2></div><div className="bench-actions"><button className="quiet" onClick={()=>setTracks([])} disabled={busy}>Leeren</button>{tracks.length>3&&tracks.every(t=>t.status==="done")&&<button className="zip-button" onClick={exportZip} disabled={busy}><span>ZIP</span> Alle herunterladen</button>}<button className="primary" onClick={tracks.some(t=>t.status!=="done")?analyze:exportAll} disabled={busy}>{busy?"Bitte warten …":tracks.some(t=>t.status!=="done")?"Alle analysieren":"In Ordner exportieren →"}</button></div></div>
      <div className="track-list">{tracks.map((track,index)=><article className="track-row" key={track.id}><span className="track-no">{String(index+1).padStart(2,"0")}</span><div className="track-main"><input value={track.title} aria-label="Titel" onChange={e=>update(track.id,{title:e.target.value})}/><input value={track.artist} aria-label="Interpret" onChange={e=>update(track.id,{artist:e.target.value})}/><small>{(track.file.size/1024/1024).toFixed(1)} MB · {track.file.name.split(".").pop()?.toUpperCase()}</small></div>{track.analysis?<><label className="metric"><span>BPM</span><input type="number" step="0.1" value={track.analysis.bpm} onChange={e=>update(track.id,{analysis:{...track.analysis!,bpm:Number(e.target.value)}})}/></label><label className="metric"><span>KEY</span><input value={track.analysis.key} onChange={e=>update(track.id,{analysis:{...track.analysis!,key:e.target.value}})}/><small>{track.analysis.camelot} · {Math.round(track.analysis.confidence*100)}%</small></label></>:<div className={`track-status ${track.status}`}>{track.status==="analyzing"?"Analysiere …":track.status==="error"?"Fehler":"Bereit"}</div>}<button className="remove" aria-label="Entfernen" onClick={()=>setTracks(v=>v.filter(t=>t.id!==track.id))}>×</button></article>)}</div>
    </section>}
    <footer><p>{message||"Audio bleibt auf diesem Gerät."}</p><div><span>ID3v2.4</span><span>TBPM</span><span>TKEY</span><span>CAMELOT</span></div></footer>
  </main>;
}

declare global{interface Window{showDirectoryPicker?:(options?:{mode?:"read"|"readwrite"})=>Promise<FileSystemDirectoryHandle>}}
