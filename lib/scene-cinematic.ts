/** Shared beats in seconds: motion, light and audio land together. */
export const CINEMATIC = {
  charge: .55,
  liftEnd: 1.95,
  reveal: 2.65,
  objectPanel: 3.15,
  monitorAlign: 1.35,
  monitorTravel: 1.8,
  monitorPanel: 3.12,
  tail: 3.7,
} as const;

export type CinematicDestination = "projects" | "about" | "contact" | "skills";

export const CINEMATIC_COLORS: Record<CinematicDestination, { core: string; accent: string }> = {
  projects: { core: "#ffdd91", accent: "#ff9567" },
  about: { core: "#e8f3b4", accent: "#98d4b1" },
  contact: { core: "#c9eeec", accent: "#8fcac5" },
  skills: { core: "#d3eeff", accent: "#9fcbc9" },
};
