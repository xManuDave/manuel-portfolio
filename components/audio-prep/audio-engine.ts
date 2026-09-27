export type Analysis = { bpm: number; key: string; camelot: string; confidence: number };

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const CAMELOT_MAJOR = ["8B", "3B", "10B", "5B", "12B", "7B", "2B", "9B", "4B", "11B", "6B", "1B"];
const CAMELOT_MINOR = ["5A", "12A", "7A", "2A", "9A", "4A", "11A", "6A", "1A", "8A", "3A", "10A"];
const MAJOR = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const MINOR = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];

function correlation(a: number[], b: number[]) {
  const am = a.reduce((x,y)=>x+y,0)/a.length, bm = b.reduce((x,y)=>x+y,0)/b.length;
  let n=0, da=0, db=0;
  for(let i=0;i<a.length;i++){ const x=a[i]-am,y=b[i]-bm;n+=x*y;da+=x*x;db+=y*y; }
  return n/Math.sqrt(da*db || 1);
}

function detectKey(samples: Float32Array, sampleRate: number) {
  const chroma = Array(12).fill(0) as number[];
  const start = Math.min(samples.length*.12, sampleRate*25);
  const length = Math.min(samples.length-start, sampleRate*150);
  const step = Math.max(1, Math.floor(length/52));
  const windowSize = 4096;
  for(let offset=Math.floor(start); offset+windowSize<start+length; offset+=step){
    for(let midi=36;midi<=95;midi++){
      const freq=440*Math.pow(2,(midi-69)/12), w=2*Math.PI*freq/sampleRate, coeff=2*Math.cos(w);
      let s0=0,s1=0,s2=0;
      for(let i=0;i<windowSize;i+=2){ s0=samples[offset+i]+coeff*s1-s2;s2=s1;s1=s0; }
      chroma[midi%12]+=Math.max(0,s1*s1+s2*s2-coeff*s1*s2)/(midi<48?2:1);
    }
  }
  let best={score:-2,root:0,minor:false}, second=-2;
  for(let root=0;root<12;root++) for(const minor of [false,true]){
    const profile=(minor?MINOR:MAJOR).map((_,i)=>(minor?MINOR:MAJOR)[(i-root+12)%12]);
    const score=correlation(chroma,profile);
    if(score>best.score){second=best.score;best={score,root,minor};} else if(score>second) second=score;
  }
  return { key:`${NOTES[best.root]}${best.minor?"m":""}`, camelot:(best.minor?CAMELOT_MINOR:CAMELOT_MAJOR)[best.root], confidence:Math.max(0,Math.min(1,(best.score-second)*3+.42)) };
}

function detectBpm(samples: Float32Array, sampleRate: number) {
  const hop=Math.max(128,Math.round(sampleRate*.02)), start=Math.min(samples.length*.08,sampleRate*20), end=Math.min(samples.length,start+sampleRate*180);
  const env:number[]=[]; let previous=0;
  for(let p=Math.floor(start);p<end-hop;p+=hop){ let energy=0;
    for(let i=1;i<hop;i+=2){ const high=samples[p+i]-samples[p+i-1];energy+=high*high; }
    const value=Math.sqrt(energy/(hop/2));env.push(Math.max(0,value-previous*.92));previous=value;
  }
  const mean=env.reduce((a,b)=>a+b,0)/(env.length||1); for(let i=0;i<env.length;i++) env[i]=Math.max(0,env[i]-mean*.65);
  const rate=sampleRate/hop; let best={bpm:120,score:-1};
  for(let bpm=70;bpm<=180;bpm+=.25){ const lag=rate*60/bpm, whole=Math.floor(lag), frac=lag-whole; let score=0,norm=0;
    for(let i=whole+1;i<env.length;i++){ const delayed=env[i-whole]*(1-frac)+env[i-whole-1]*frac;score+=env[i]*delayed;norm+=env[i]*env[i]; }
    const normalized=score/(norm||1); if(normalized>best.score) best={bpm,score:normalized};
  }
  return Math.round(best.bpm*10)/10;
}

export async function analyzeAudio(file: File): Promise<Analysis> {
  const context=new AudioContext({sampleRate:22050});
  try { const buffer=await context.decodeAudioData(await file.arrayBuffer()); const mono=new Float32Array(buffer.length);
    for(let c=0;c<buffer.numberOfChannels;c++){const channel=buffer.getChannelData(c);for(let i=0;i<mono.length;i++) mono[i]+=channel[i]/buffer.numberOfChannels;}
    const key=detectKey(mono,buffer.sampleRate); return {bpm:detectBpm(mono,buffer.sampleRate),...key};
  } finally { await context.close(); }
}

const encoder=new TextEncoder();
function synchsafe(value:number){return [(value>>21)&127,(value>>14)&127,(value>>7)&127,value&127];}
function frame(id:string,value:string){const data=encoder.encode(value), payload=new Uint8Array(data.length+1);payload[0]=3;payload.set(data,1);const head=encoder.encode(id);return new Uint8Array([...head,...synchsafe(payload.length),0,0,...payload]);}
function comment(value:string){const text=encoder.encode(value),payload=new Uint8Array(5+text.length);payload[0]=3;payload.set(encoder.encode("eng"),1);payload[4]=0;payload.set(text,5);return new Uint8Array([...encoder.encode("COMM"),...synchsafe(payload.length),0,0,...payload]);}
function id3(title:string,artist:string,bpm:number,key:string,camelot:string){const frames=[frame("TIT2",title),frame("TPE1",artist),frame("TBPM",String(bpm)),frame("TKEY",key),comment(`Camelot: ${camelot} | Prepared for rekordbox`)];const size=frames.reduce((n,f)=>n+f.length,0);return new Uint8Array([...encoder.encode("ID3"),4,0,0,...synchsafe(size),...frames.flatMap(f=>Array.from(f))]);}
function stripId3(bytes:Uint8Array){if(String.fromCharCode(...bytes.slice(0,3))!=="ID3")return bytes;const size=((bytes[6]&127)<<21)|((bytes[7]&127)<<14)|((bytes[8]&127)<<7)|(bytes[9]&127);return bytes.slice(10+size);}
function le32(value:number){return [value&255,(value>>8)&255,(value>>16)&255,(value>>24)&255];}
function blobBytes(bytes:Uint8Array){const copy=new Uint8Array(bytes.byteLength);copy.set(bytes);return copy.buffer;}

export async function tagAudio(file:File,meta:{title:string;artist:string;bpm:number;key:string;camelot:string}){
  const bytes=new Uint8Array(await file.arrayBuffer()),tag=id3(meta.title,meta.artist,meta.bpm,meta.key,meta.camelot);
  if(file.name.toLowerCase().endsWith(".mp3")){const audio=stripId3(bytes);return new Blob([blobBytes(tag),blobBytes(audio)],{type:"audio/mpeg"});}
  if(file.name.toLowerCase().endsWith(".wav") && String.fromCharCode(...bytes.slice(0,4))==="RIFF"){
    const chunk=new Uint8Array([...encoder.encode("id3 "),...le32(tag.length),...tag,...(tag.length%2?[0]:[])]);const out=new Uint8Array(bytes.length+chunk.length);out.set(bytes);out.set(chunk,bytes.length);out.set(le32(out.length-8),4);return new Blob([blobBytes(out)],{type:"audio/wav"});
  }
  return new Blob([blobBytes(bytes)],{type:file.type});
}

export function parseName(filename:string){const base=filename.replace(/\.(mp3|wav)$/i,"").replace(/\s*\[(?:\d+(?:\.\d+)?\s*BPM|\d+[AB]|[A-G]#?m?)\]\s*/gi," ").trim();const parts=base.split(/\s+-\s+/);return parts.length>1?{artist:parts.shift()!,title:parts.join(" - ")}:{artist:"Unknown Artist",title:base};}
export function safeFilename(value:string){return value.replace(/[\\/:*?"<>|]/g,"-").replace(/\s+/g," ").trim();}

const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(bytes:Uint8Array){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function zip16(value:number){return [value&255,(value>>>8)&255];}
function zip32(value:number){return [value&255,(value>>>8)&255,(value>>>16)&255,(value>>>24)&255];}
function dosTime(date:Date){return ((date.getHours()&31)<<11)|((date.getMinutes()&63)<<5)|((date.getSeconds()/2)&31);}
function dosDate(date:Date){return (((date.getFullYear()-1980)&127)<<9)|(((date.getMonth()+1)&15)<<5)|(date.getDate()&31);}

export async function createZip(files:Array<{name:string;blob:Blob}>){
  const localParts:ArrayBuffer[]=[],centralParts:ArrayBuffer[]=[];let offset=0;const now=new Date(),time=dosTime(now),date=dosDate(now);
  for(const file of files){const name=encoder.encode(file.name),data=new Uint8Array(await file.blob.arrayBuffer()),crc=crc32(data);
    const local=new Uint8Array([80,75,3,4,...zip16(20),...zip16(0x800),...zip16(0),...zip16(time),...zip16(date),...zip32(crc),...zip32(data.length),...zip32(data.length),...zip16(name.length),0,0,...name]);
    const central=new Uint8Array([80,75,1,2,...zip16(20),...zip16(20),...zip16(0x800),...zip16(0),...zip16(time),...zip16(date),...zip32(crc),...zip32(data.length),...zip32(data.length),...zip16(name.length),0,0,0,0,0,0,0,0,0,0,0,0,...zip32(offset),...name]);
    localParts.push(blobBytes(local),blobBytes(data));centralParts.push(blobBytes(central));offset+=local.length+data.length;
  }
  const centralSize=centralParts.reduce((sum,part)=>sum+part.byteLength,0),end=new Uint8Array([80,75,5,6,0,0,0,0,...zip16(files.length),...zip16(files.length),...zip32(centralSize),...zip32(offset),0,0]);
  return new Blob([...localParts,...centralParts,blobBytes(end)],{type:"application/zip"});
}
