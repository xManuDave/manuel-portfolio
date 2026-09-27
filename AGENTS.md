# Codex Project Instructions — Manuel Strunz Interactive 3D Portfolio

## Mission
Build an exceptionally polished interactive portfolio whose primary interface is a cozy, stylized 3D lofi workroom. The room is the navigation system. Do not replace it with a conventional landing page.

## Visual north star
Use `/public/reference/target-homepage.png` as the main visual reference.

The intended art direction:
- warm sunrise / golden-hour light
- cozy low-poly / stylized game-like 3D
- rounded, simplified shapes rather than photorealistic assets
- warm wood, cream, sage, coral and muted blue materials
- large window/opening to nature: mountains, lake/valley, pine trees
- central desk as the main interaction hub
- dense but intentional lived-in detail: plants, shelves, workstation, hobby objects
- premium portfolio composition, not childish UI
- subtle Animal-Crossing-like friendliness without copying Nintendo assets or characters

## Information architecture embedded in the scene
- folders/files on central desk -> Projects
- journal / framed stylized character art -> About Me
- phone -> Contact
- computer/monitor -> Experience / Work history
- surfboard, snowboard, skis, dumbbell, music keyboard -> Hobbies / personality details

## Interaction rules
- Desktop starts on a cinematic fixed composition close to the reference image.
- User may drag/orbit only within a constrained range. Never allow free FPS/WASD movement.
- Pointer movement may add subtle camera parallax.
- Interactive objects must react to hover with restrained lift/tilt/outline/label feedback.
- Clicking an object should eventually trigger a cinematic camera transition toward it before content appears.
- Content panels should feel integrated into the world, using glass/paper/editorial treatments rather than generic SaaS cards.
- Always preserve obvious navigation via a minimal HUD for accessibility.
- Mobile must have a simplified, reliable fallback interaction model.

## Technical stack
- Next.js App Router
- React + TypeScript
- Three.js via `@react-three/fiber`
- `@react-three/drei`
- GSAP for cinematic camera/object transitions
- Prefer GLB/GLTF for custom scene assets once art assets are ready
- Use procedural/simple geometry for prototyping

## Non-negotiable design constraints
- No generic gradient hero.
- No floating developer-skill logo cloud.
- No generic three-column project-card section as the primary experience.
- No neon cyberpunk aesthetic.
- No photorealistic mixed assets inside the stylized room.
- No uncontrolled orbit controls.
- No heavy effect just because it is technically possible.
- Do not sacrifice frame rate for decorative detail.

## Performance targets
- Aim for 60 FPS on a modern desktop.
- Keep draw calls and geometry reasonable.
- Draco/Meshopt compress production GLBs.
- Prefer baked lighting/textures for complex final assets where appropriate.
- Lazy-load secondary content/assets.
- Respect `prefers-reduced-motion`.

## Current implementation status
Version 0.1 is a procedural blockout scene. It intentionally uses simple primitives. Treat proportions, composition and interaction mapping as the important starting point, not the primitive artwork itself.

## Development sequence
1. Preserve current functional blockout.
2. Improve composition until camera resembles the target reference closely.
3. Add proper GSAP camera focus transitions for each hotspot.
4. Replace placeholder meshes in coherent asset batches, maintaining one visual language.
5. Develop Projects content first.
6. Add About / Experience / Contact.
7. Add atmospheric motion: plant sway, monitor glow, dust/light particles only if performant.
8. Add responsive/mobile fallback.
9. Optimize and accessibility-pass.

## Quality bar
Every implementation decision should answer: does this make the room feel more intentional, tactile, cinematic and personal? If not, do not add it.
