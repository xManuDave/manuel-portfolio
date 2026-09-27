import { asset } from "@/lib/asset";
export type ProjectId = "roi" | "community";
export const PROJECT_REVEAL = { charge: .55, impact: 2.65, settle: 4.2 };
export const ROI_DEMO = { investment: 302000, annualBenefit: 262027, months: 24, ceiling: 560000 };
export function breakEvenMonths(investment: number, annualBenefit = ROI_DEMO.annualBenefit) {
  return annualBenefit > 0 ? investment / annualBenefit * 12 : null;
}
export const PROJECTS = {
  roi: { title: "ROI & Value Calculator", index: "01", color: "#efbc76", cover: "#b96f4c", tagline: "When the investment becomes the advantage.", summary: "Ein modulares Vertriebswerkzeug, das den wirtschaftlichen Mehrwert von ENGEL-Produkten verständlich macht – von der Berechnung bis zum Gesamtbericht.", facts: ["11 Module", "3 Sprachen", "31 Währungen"], src: asset("/projects/roi-value-calculator.html") },
  community: { title: "Community Analyzer", index: "02", color: "#b5d5ba", cover: "#617d60", tagline: "From scattered data to shared knowledge.", summary: "Ein JavaFX-Desktoptool für akademische Communities, Konferenzen, Journals und Forscher:innen mit DBLP-Import.", facts: ["4 Releases", "302 Tests", "87 % Branch Coverage"], src: asset("/projects/community-analyzer.html") },
} as const;
