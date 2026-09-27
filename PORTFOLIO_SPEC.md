# Portfolio Scene Specification v1

## Core concept
A warm, artsy, game-like lofi workroom at sunrise. Visitors discover Manuel's work by interacting with objects placed naturally in the space rather than browsing a conventional portfolio grid.

## Camera
- Hero camera: elevated three-quarter view facing the central table and large nature opening.
- Constrained orbit only.
- Target approximately the center of the main table.
- Future: GSAP focus shots for each interactive object and a home/reset camera state.

## Primary interaction map
| Object | Destination | Interaction concept |
| --- | --- | --- |
| Project folders | Projects | Files lift slightly; click -> camera pushes toward the folder, case-study UI opens |
| Journal / portrait | About Me | Journal opens / portrait comes alive subtly; click -> About panel |
| Phone | Contact | Screen wakes on hover; click -> contact UI |
| Main computer | Experience | Screen glows; click -> camera to workstation, experience timeline appears |
| Surfboard / snowboard / skis | Hobbies | Optional tooltips/details; avoid overloading the first release |
| Dumbbell | Hobbies | Optional micro-interaction |
| Music keyboard | Music | Optional micro-interaction / audio-related detail later |

## Environmental storytelling
The room should communicate personality before any text is read:
- sport / outdoors: surfboard, snowboard, skis
- training: dumbbell
- music: keyboard and speakers
- technology: workstation / computer
- calm work style: plants, journals, warm lighting
- nature/outdoors: mountain + lake/valley view

## Art direction
Use chunky, rounded forms and simplified materials. It should look like a professionally art-directed stylized 3D game environment, not a collection of random low-poly assets.

## Lighting
- sunrise direction from the large opening/window
- warm key light
- soft ambient/fill
- visible but subtle contact shadows
- slightly hazy exterior for depth
- no harsh photorealistic HDR look

## Content integration
Detailed project content may become DOM overlays for readability while camera remains anchored on the associated 3D object. This hybrid approach is preferred over rendering long text directly in WebGL.

## First real case study
### Modular ROI Calculator
- 11 calculation modules
- requirements coordinated with 4 specialist departments
- centralized previously isolated Excel calculations
- vanilla JavaScript
- modular / maintainable software architecture
- optimized build pipeline for SharePoint deployment

## Version milestones
### v0.1 — Blockout
Procedural geometry, orbit camera, click hotspots, basic content overlays.

### v0.2 — Cinematic navigation
GSAP camera focus states, hover animation polish, reset/home behavior.

### v0.3 — Art pass
Replace blockout objects with coherent custom GLB assets and improve exterior scene.

### v0.4 — Content
Projects case studies, About, Experience, Contact.

### v0.5 — Production polish
Mobile fallback, loading sequence, audio option, reduced-motion support, optimization.
