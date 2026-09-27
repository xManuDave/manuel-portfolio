"use client";

import { useEffect, useState } from "react";
import { fetchWholesomeQuote, type Quote } from "@/lib/wholesome-quote";

const FALLBACK: Quote = { quote: "There is no rush. Good work can grow at a human pace.", author: "Room note" };

export default function WholesomeQuote({ active }: { active: boolean }) {
  const [note, setNote] = useState<Quote | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setNote(await fetchWholesomeQuote(controller.signal));
      } catch {
        if (!controller.signal.aborted) setNote(FALLBACK);
      }
      if (!controller.signal.aborted) setVisible(true);
    }, 15 * 60 * 1000);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [active]);

  if (!visible || !note) return null;
  return <aside className="wholesome-note" role="dialog" aria-label="A wholesome thought for the day">
    <button type="button" onClick={() => setVisible(false)} aria-label="Close quote">×</button>
    <span className="wholesome-note-kicker">A thought for the day</span>
    <blockquote>“{note.quote}”</blockquote>
    <cite>— {note.author}</cite>
    <i aria-hidden="true">✦</i>
  </aside>;
}
