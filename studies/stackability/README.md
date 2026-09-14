# Candidate stackability study — 2026-09-13

Run `node studies/stackability/sweep.mjs` from the repository root. Raw results and all provisional collider dimensions/densities are in `results.json`.

## Scope and method

The approved four animals are concept illustrations, NOT existing 3D assets. New compound colliders were manually estimated from their silhouettes. This is a design screening experiment, not validation of final meshes. In particular horn segments, dragonfly wings and zebra head proportions are approximations; final models need collider overlays and another sweep.

Rapier 0.20.0, gravity -9.81 Z, 60 Hz, production damping (0.42 linear/1.45 angular), CCD, zero restitution, minimum friction combine, 0.25 landing/1.08 naturally sleeping grip, production first-support velocity attenuation. Existing tortoise/capybara/toucan colliders are extracted directly from main.ts. No forced sleep. Gentle placement scans downward in 0.035-unit increments to the last non-overlapping pose; this approximates rather than exactly replays production sensor lowering. Platform is a large flat box (not the live circular platform); floor contact or falling below it is failure.

Supports: fixed starting tortoise plus seven species first placed upright dynamically on that fixed tortoise. Existing stack animals remain dynamic for the incoming placement. Preparation is six seconds. The incoming piece is centered at x=0,y=-0.25, not laterally searched for an optimal contact. Eight orientations (upright, +15/+30 pitch, +15/+30 roll, side, nose, upside-down) at four yaw headings. This is a structured grid, NOT a uniform random SO(3) sample, and tests only positive small tilts. Each final stack gets ten seconds of simulation even if it becomes calm early. Stable means every dynamic body remains supported and below 0.10 linear/0.15 angular speed for at least the last second. Otherwise classify fall or still moving. The production scoring/watchdog state machine is not used.

Two sets of 1,024 cases = 2,048 total. Baseline proxies and a modified set: armadillo crown wider; dragonfly wings raised 0.22 units; ram and zebra feet spaced 30% wider and foot width 20% larger. All tweaks are applied together in the second set, so interactions confound causal attribution. These results do not prove any individual tweak improves a finished model. Density and mass distribution are design assumptions, not measured physical ceramic properties.

## Baseline results

| Incoming | Stable / 256 | Near-upright stable / 160 | Upright stable / 32 |
|---|---:|---:|---:|
| Armadillo | 206 | 134 | 28 |
| Dragonfly | 180 | 130 | 27 |
| Ram | 131 | 72 | 20 |
| Zebra | 117 | 56 | 19 |

Near-upright includes upright and 15/30-degree pitch/roll at four headings and eight supports. These percentages are not player success probabilities.

As dynamic upright supports, successful incoming placements out of 128: armadillo 101, dragonfly 102, ram 32, zebra 25. Existing reference supports: tortoise 103, capybara 87, toucan 81. All support preparations succeeded. Raised heads and horns intersect the fixed centered placement path; the low success on ram/zebra is not simply a measurement of back flatness.

Modified set incoming stable counts /256: armadillo 205, dragonfly 181, ram 124, zebra 123. Near-upright counts /160: 135,133,68,66 respectively. No case remained moving at the deadline in either set. Upward velocities were not zero: baseline maxima (all dynamic bodies) 0.90,1.36,0.89,0.81 units/s by incoming species; modified maxima 0.78,0.97,1.61,1.57. Do not interpret resolution as an absence of rebounds or as proof of no production explosions.

## Design advice

- Armadillo: retain red flattened armor design; a wider crown is not justified by this comparison. Strong easy candidate.
- Dragonfly: promising easy-to-medium bridge/support. It rewards upright placement, but side/nose placements are harder. Keep substantial wings. Raised-wing variation has little aggregate improvement, so retain current concept until exact wing geometry is modeled.
- Ram: useful hard piece. Do not widen feet automatically: the modified set did worse. Preserve plain fleece and distinctive horns; treat upright ram as a challenging support, not a foundation.
- Zebra: currently another hard piece, not medium. Positive 30-degree roll failed all 32 baseline cases. For a future medium variant, test a shorter/lower head and neck, shorter legs, or rearward body placement independently; wider feet alone produced only a modest change in the mixed comparison.

No live-game code/assets were changed. These are hypotheses to guide final modeling, not proposed changes already applied to the approved illustrations.
