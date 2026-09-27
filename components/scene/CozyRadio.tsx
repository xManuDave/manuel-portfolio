"use client";

import { asset } from "@/lib/asset";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type CozyRadioHandle = { start: () => void };

function formatTime(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

const CozyRadio = forwardRef<CozyRadioHandle>(function CozyRadio(_, ref) {
  const audio = useRef<HTMLAudioElement>(null);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(.46);

  const play = () => {
    const element = audio.current;
    if (!element) return;
    void element.play().catch(() => setOpen(true));
  };

  useImperativeHandle(ref, () => ({ start: play }), []);

  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
  }, [volume]);

  const togglePlayback = () => {
    const element = audio.current;
    if (!element) return;
    if (element.paused) play(); else element.pause();
  };

  const seek = (value: number) => {
    if (!audio.current || !duration) return;
    audio.current.currentTime = value * duration;
    setCurrentTime(audio.current.currentTime);
  };

  return <aside className={`lofi-radio${open ? " is-open" : ""}`} aria-label="Lofi room radio">
    <audio
      ref={audio}
      src={asset("/audio/why-the-rush-cat-jazz.mp3")}
      preload="metadata"
      loop
      onCanPlay={() => setReady(true)}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
      onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
    />
    <button className="lofi-radio-toggle" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}>
      <span className={`lofi-radio-pulse${playing ? " is-playing" : ""}`} aria-hidden="true"><i/><i/><i/></span>
      <span><strong>Room radio</strong><small>{playing ? "Cat jazz · on air" : "Cat jazz · paused"}</small></span>
    </button>
    <div className={`lofi-radio-panel${open ? "" : " is-collapsed"}`} aria-hidden={!open}>
      <div className="lofi-radio-head">
        <span className={`lofi-live-dot${playing ? " is-live" : ""}`} aria-hidden="true"/>
        <div><strong>Why the rush?</strong><small>{ready ? playing ? "playing locally" : "ready when you are" : "warming up…"}</small></div>
        <button type="button" className="lofi-play" tabIndex={open ? 0 : -1} onClick={togglePlayback} disabled={!ready} aria-label={playing ? "Pause room radio" : "Play room radio"}>{playing ? "Ⅱ" : "▶"}</button>
      </div>
      <label className="radio-scrubber">
        <span>{formatTime(currentTime)}</span>
        <input type="range" min="0" max="1" step="0.001" value={duration ? currentTime / duration : 0} onChange={(event) => seek(Number(event.target.value))} tabIndex={open ? 0 : -1} aria-label="Track position"/>
        <span>{formatTime(duration)}</span>
      </label>
      <label className="radio-volume"><span>Volume</span><input type="range" min="0" max="1" step="0.02" value={volume} onChange={(event) => setVolume(Number(event.target.value))} tabIndex={open ? 0 : -1}/></label>
      <p className="lofi-note">One local recording. No account, no tracking, no station switching.</p>
    </div>
  </aside>;
});

export default CozyRadio;
