"use client";

import { asset } from "@/lib/asset";
import { useEffect, useRef, useState } from "react";
import { PROJECTS, type ProjectId } from "@/lib/project-theatre";

const projects = [
  {
    id: "roi-calculator",
    index: "01",
    title: "ROI & Value Calculator",
    detail: "Vanilla JS · 11 modules · Product value",
    src: asset("/projects/roi-value-calculator.html"),
  },
  {
    id: "community-analyzer",
    index: "02",
    title: "Community Analyzer",
    detail: "Java 21 · JavaFX · Research tooling",
    src: asset("/projects/community-analyzer.html"),
  },
];

export default function ProjectViewer({ onClose, projectId, onSelect }: { onClose: () => void; projectId: ProjectId; onSelect: (id:ProjectId)=>void }) {
  const selected = projectId === "roi" ? 0 : 1;
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;closeButton.current?.focus();return()=>{if(previous?.isConnected)previous.focus();};},[]);
  const [expanded, setExpanded] = useState(false);
  const project = projects[selected];

  return <aside className={`project-viewer${expanded ? " is-expanded" : ""}`} aria-label="Project portfolio viewer">
    <header className="project-viewer-bar">
      <div className="project-viewer-title"><span>Project archive</span><strong>2 selected works</strong></div>
      <nav aria-label="Choose a project">
        {projects.map((item, index) => <button key={item.id} type="button" className={index === selected ? "is-active" : ""} onClick={() => onSelect(index===0?"roi":"community")} aria-pressed={index === selected}>
          <small>{item.index}</small><span><strong>{item.title}</strong><em>{item.detail}</em></span>
        </button>)}
      </nav>
      <div className="project-viewer-actions">
        <button type="button" onClick={() => setExpanded(value => !value)} aria-label={expanded ? "Restore project viewer size" : "Expand project viewer"}>{expanded ? "↙" : "↗"}<span>{expanded ? "Restore" : "Expand"}</span></button>
        <button ref={closeButton} type="button" onClick={onClose} aria-label="Return to Project Theatre">×</button>
      </div>
    </header>
    <div className="project-frame-shell">
      <div className="project-frame-status"><span/><strong>{project.title}</strong><small>Scroll to explore the complete case study</small></div>
      <iframe key={PROJECTS[projectId].src} src={PROJECTS[projectId].src} title={`${project.title} case study`} sandbox="allow-scripts" loading="lazy"/>
    </div>
  </aside>;
}
