import { asset } from "@/lib/asset";
export const portfolioContent = {
  owner: "Manuel Strunz",
  positioning: "Business Informatics · Software Development · Digital Products",
  about: {
    title: "Curious, structured, hands-on.",
    body: "I study Business Informatics at JKU Linz and enjoy turning unclear requirements into useful, maintainable software. I learn new tools quickly, keep work structured and stay dependable when timelines get tight.",
    traits: ["Solution-oriented", "Fast learner", "Reliable under pressure", "Cross-functional"],
    interests: ["Training", "Cultural travel", "Music & acting"],
  },
  skills: {
    title: "Skills grounded in practice.",
    body: "A Business Informatics foundation spanning software engineering, data, project work and business - strengthened through real delivery and customer-facing responsibility.",
    competencies: [
      "Software Development & Engineering",
      "Data & Knowledge Engineering",
      "Requirements Engineering",
      "IT Project Management",
      "Business Administration",
      "Analytics & Formal Methods",
    ],
    experience: [
      {
        period: "Jun - Jul 2026",
        company: "ENGEL Austria",
        role: "Software Development Intern",
        detail: "Designed and built a modular ROI calculator with 11 calculation modules, aligned requirements across four specialist departments and prepared a maintainable SharePoint deployment build.",
      },
      {
        period: "Sep 2025 - present",
        company: "Gasthof Hummer",
        role: "Service & Hospitality",
        detail: "Clear guest communication, accurate checkout and practical problem-solving in a fast-paced team environment.",
      },
      {
        period: "Jun - Sep 2025",
        company: "Ruff Golf",
        role: "Hospitality & Bar",
        detail: "Handled booking and checkout systems, worked accurately under time pressure and coordinated tasks across the team.",
      },
    ],
    education: "BSc Business Informatics · JKU Linz · 2024 - present",
    languages: ["German · native", "English · C1", "Spanish · B1"],
  },
  contact: {
    title: "Let’s build something useful.",
    body: "For software projects, internships or a thoughtful exchange around digital products - reach me directly.",
    status: "Based in Linz, Austria",
    email: "manueldavide@hotmail.com",
    phoneLabel: "+43 650 3806488",
    phoneHref: "+436503806488",
  },
  projects: [
    {
      id: "roi-calculator",
      title: "ROI & Value Calculator",
      highlights: [
        "11 calculation modules",
        "Requirements aligned across 4 specialist departments",
        "Replaced isolated Excel calculations with one interactive tool",
        "Vanilla JavaScript",
        "Modular architecture",
        "SharePoint deployment pipeline"
      ],
      href: asset("/projects/roi-value-calculator.html"),
    },
    {
      id: "community-analyzer",
      title: "Community Analyzer",
      highlights: [
        "Java 21 and JavaFX desktop application",
        "SQLite persistence and DBLP XML import",
        "302 tests across 27 test classes",
        "87% branch coverage",
        "GitHub Actions and SonarCloud quality gates",
      ],
      href: asset("/projects/community-analyzer.html"),
    }
  ]
};
