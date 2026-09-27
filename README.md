# Manuel Portfolio — Interactive 3D Workroom

Version 0.5 is a responsive, stylized React Three Fiber portfolio room. The room itself is the navigation surface: folders open Projects, the journal opens About, the monitor opens Experience and the phone opens Contact.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For a production verification build:

```bash
npm run build
npm start
```

## Current implementation

- modular procedural room architecture and coherent placeholder asset batches
- constrained cinematic camera with GSAP focus shots and subtle pointer parallax
- integrated Projects, About, Experience and Contact surfaces
- restrained hover motion, plant sway, monitor emission and lightweight dust
- reduced-motion support
- persistent keyboard- and touch-accessible room navigation
- responsive mobile camera, panels, DPR and shadow settings

## Content

Portfolio copy is centralized in `lib/portfolio-content.ts`. Real contact URLs were intentionally not invented; connect Manuel's preferred email and profile links there when they are available.

## Art direction

Read `AGENTS.md`, `PORTFOLIO_SPEC.md` and `.codex/skills/portfolio-art-direction/SKILL.md` before visual or interaction changes. `public/reference/target-homepage.png` remains the visual north star.

The current scene uses procedural geometry so each coherent batch can later be replaced by optimized GLB assets without changing the camera or information architecture.
