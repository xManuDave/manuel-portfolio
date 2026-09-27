---
name: portfolio-art-direction
description: Preserve the agreed visual language and interaction model while developing Manuel's interactive 3D portfolio.
---

# Portfolio Art Direction Skill

Before making visual, scene, camera, motion, layout or content decisions:
1. Read `/AGENTS.md`.
2. Read `/PORTFOLIO_SPEC.md`.
3. Inspect `/public/reference/target-homepage.png`.

## Decision filter
Prefer changes that increase:
- cozy stylized 3D character
- rounded, simplified game-like shapes
- sunrise warmth and depth
- environmental storytelling
- tactile object interaction
- cinematic but constrained navigation
- clarity and performance

Reject changes that introduce:
- generic developer-portfolio patterns
- cyberpunk/neon visual language
- photorealistic mismatched assets
- gratuitous WebGL effects
- free-roaming FPS controls
- unreadable 3D text for long-form content

## Scene semantics
Treat the room as navigation, not decoration. Interactive objects must map naturally to portfolio content and remain visually recognizable without labels.

## Motion semantics
Motion should communicate affordance and spatial transition. Keep hover effects subtle; reserve larger camera movement for deliberate clicks. Use easing that feels physical and calm, not bouncy or arcade-like.

## Build discipline
Keep the blockout working while replacing assets. Replace objects in coherent batches. Never trade a stable interactive experience for visual complexity.
