import type { Metadata } from "next";
import AudioPrep from "@/components/audio-prep/AudioPrep";
import "./audio-prep.css";
import "./zip-export.css";

export const metadata: Metadata = {
  title: "Track Prep — Rekordbox Audio Tool",
  description: "Local BPM and key analysis with Rekordbox-compatible metadata.",
};

export default function AudioPrepPage() {
  return <AudioPrep />;
}
