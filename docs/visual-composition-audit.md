# Homepage composition audit

Reference: `public/reference/target-homepage.png` (1537 × 1023, 3:2)

Comparison renders must use a 3:2 viewport. Coordinates below are normalized to image width/height.

| Anchor | Reference | Current 3:2 render | Required correction |
| --- | --- | --- | --- |
| Window opening center | x ≈ 0.46 | x ≈ 0.54 | Shift the hero view right so the window moves left in frame and the workstation wall gains width. |
| Window opening top | y ≈ 0.06 | y ≈ 0.06 | Preserve. |
| Balcony / lower opening | y ≈ 0.52 | y ≈ 0.49 | Preserve within a small tolerance. |
| Main table rear edge | y ≈ 0.59 | y ≈ 0.60 | Preserve. |
| Main table horizontal span | x ≈ 0.14–0.88 | x ≈ 0.02–0.93 | Narrow slightly after camera correction; do not reduce its role as the foreground hub. |
| Workstation surface | y ≈ 0.40 | y ≈ 0.52 | Raise the workstation mass and improve its visible depth. |
| Lounge mass | x ≈ 0.00–0.20, y ≈ 0.54–0.92 | x ≈ 0.00–0.27, y ≈ 0.62–0.84 | Make the couch taller and more visible behind the foreground table. |
| Project folder center | x ≈ 0.42 | x ≈ 0.44 | Preserve. |
| Journal center | x ≈ 0.59 | x ≈ 0.66 | Shift left. |
| Phone center | x ≈ 0.71 | x ≈ 0.82 | Shift left. |

## Phase-one acceptance criteria

- Window center differs from reference by no more than 0.03 image width.
- Main table rear edge differs by no more than 0.03 image height.
- Workstation, lounge, hobby cluster, and central table are all readable as separate masses without labels.
- No floating, duplicated, or unexplained large prop remains in the hero shot.
- The comparison screenshot is captured at 3:2 before moving into asset replacement.
