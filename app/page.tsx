"use client";
import dynamic from "next/dynamic";
const PortfolioScene = dynamic(() => import("@/components/scene/PortfolioScene"), { ssr: false });
export default function Home() { return <main className="site-shell"><a className="skip-link" href="#room-navigation">Skip to room navigation</a><header className="hud" aria-label="Portfolio identity"><div className="wordmark">MANUEL STRUNZ</div><div className="scene-status"><span /> ROOM STUDY · 03</div></header><div id="room-navigation" tabIndex={-1}><PortfolioScene/></div><p className="hint">Drag gently · Select an object</p></main>; }
