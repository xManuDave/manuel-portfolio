"use client";

import { useEffect, useState, type CSSProperties } from "react";

const SESSION_SECONDS = 25 * 60;

function clock(value: number) {
  return `${Math.floor(value / 60).toString().padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
}

export default function FocusTimer() {
  const [remaining, setRemaining] = useState(SESSION_SECONDS);
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      setRemaining((value) => {
        if (value > 1) return value - 1;
        setRunning(false);
        setComplete(true);
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  const reset = () => {
    setRunning(false);
    setRemaining(SESSION_SECONDS);
    setComplete(false);
  };
  const progress = 1 - remaining / SESSION_SECONDS;

  return <div className={`focus-timer${running ? " is-running" : ""}${complete ? " is-complete" : ""}`} style={{ "--timer-progress": `${progress * 360}deg` } as CSSProperties}>
    <button type="button" className="focus-timer-main" onClick={() => { setComplete(false); setRunning(value => !value); }} aria-label={running ? "Pause focus timer" : "Start focus timer"}>
      <span className="focus-timer-ring" aria-hidden="true"><i/></span>
      <span><strong>{clock(remaining)}</strong><small>{complete ? "session complete" : running ? "quiet focus" : "focus timer"}</small></span>
    </button>
    {remaining !== SESSION_SECONDS && <button type="button" className="focus-timer-reset" onClick={reset} aria-label="Reset focus timer">↺</button>}
    {complete && <div className="focus-complete" role="status"><strong>Nicely done.</strong><span>Stretch, breathe, look outside.</span></div>}
  </div>;
}
