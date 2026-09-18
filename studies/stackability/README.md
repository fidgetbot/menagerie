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

## Skunk replacement study — 2026-09-13

Run `node studies/stackability/skunk-sweep.mjs`; raw evidence: `skunk-results.json`. The skunk replaces zebra in this study's seven-species cast. This is a manually estimated concept proxy, not a final mesh: low rounded body, small head, four feet, and six overlapping rounded tail segments preserving the broad S silhouette. Tail density is assumed 0.40 versus body 1.0. The variant scales tail vertical positions/extents to 75%, keeping its width and rearward reach; reduced volume also reduces tail mass. Thus this compares a practical lower-tail shape, not height independently of mass. Other species remain unchanged.

896 unique cases: 448 per variant, covering skunk incoming on eight supports and all seven species incoming on upright dynamic skunk (32 poses each; self-pair counted once). Same physics, gentle placement, six-second support preparation and ten-second observation as above.

| Role | Tall concept tail | 25% lower tail |
|---|---:|---:|
| Skunk incoming, stable | 140/256 (54.7%) | 180/256 (70.3%) |
| Upright skunk incoming | 23/32 | 26/32 |
| 30-degree roll incoming | 6/32 | 12/32 |
| Upside-down incoming | 25/32 | 31/32 |
| Upright skunk supporting next piece | 161/224 (71.9%) | 183/224 (81.7%) |

All support preparations succeeded; no cases remained moving at the deadline. Peak upward velocity was 1.31 units/s in the baseline versus 0.95 in the lower-tail set, so these tests do not establish zero rebound. Percentages describe this centered structured grid, not player success rates. Old zebra aggregate uses a different cast and incoming set; comparisons with it are directional, not controlled head-to-head statistics. Skunk self-pairs change both support and incoming tail together.

Recommendation: retain the small head and broad striped S tail, but explore a 25% lower tail for an easy-to-medium candidate. It retains a distinctive rear profile and improves both landing and platform behavior in this proxy study. Large sideways tilts remain challenging. Final visual model/collider matching and phone playtests are still required. No live-game changes.

## Seven-animal runtime integration — 2026-09-14

The approved armadillo, dragonfly, plain ram and lower-tail skunk now have actual Blender GLBs and runtime colliders. `integration-results.json` records 61 mobile WebKit scenarios against the real game state machine: all 49 upright ordered pairings and pitch 30/90/180 degrees for each new species. Each resolved turn was followed for ten seconds. All scenarios resolved with zero page exceptions/upward-anomaly markers and all reset checks returned zero. 41/49 upright pairings remained standing; eight fell naturally, mostly involving the ram as support. This is a focused regression, not a guarantee of balance for every orientation.

Run `npm run dev`, then `npm run test:expansion` (Playwright WebKit required). The earlier proxy studies remain historical and are not a substitute for this runtime test.

## Crown-following and settling-grip tuning — 2026-09-14

The six-species game now lets each new bubble follow the highest scored body's horizontal position, capped to 0.65 world units from the original presentation point. Incoming pieces retain 0.25 friction for their initial impact, advance to 0.58 friction only after 0.22 seconds of sustained support, and still receive full 1.08 stacking friction only after natural sleep. `?forgiving=0` disables both assists in development builds for A/B testing.

The corrected 45-case WebKit regression completed with zero page errors or upward-anomaly markers. Upright two-piece losses fell from 9/36 in the prior six-species result to 6/36; tilted/inverted losses remained 3/9. Every placement emitted the new sustained-support grip event, and the harness verified the clamped crown anchor.

`npm run test:towers` adds twelve deterministic ten-piece, upright, shuffled-bag sequences with a 1.2-second aiming interval. Against the same seeds, the fixed-position/landing-friction baseline averaged 2.25 points (median 1.5, maximum 7); the two assists averaged 3.25 (median 3, maximum 10), with one run reaching ten cleanly. Upward markers occurred only during naturally failing multi-piece collapses in this stress test, including the baseline; none occurred in the successful ten-piece run. These scripted upright results establish direction, not player score probabilities, because a person can choose more stable orientations and normally takes longer to aim.

## Tortoise shell collider fit — 2026-09-17

The original tortoise compound used a broad flat plate at the shell apex. It made a forgiving base, but off-center pieces could be supported above the visibly domed shoulders. The accepted replacement uses a convex hull generated directly from the visible golden shell foundation plus a small rounded crown patch that covers less than one quarter of the old plate area. The belly, foot/base, and head colliders are unchanged.

The exact visible-shell hull without a crown patch was tested and rejected. In the 36 upright ordered-pair cases, losses rose from 6 to 14, five upward-anomaly markers appeared, and four of the six tortoise-first sequences fell. Twelve seeded tower runs fell from median 3 / maximum 10 to median 2.5 / maximum 8. This was materially harder and introduced solver behavior not present in the baseline.

The accepted dome-plus-crown version matched the baseline's 6/36 upright losses and 66 aggregate points, kept all 11 upright tortoise-involved sequences standing, and produced no pair-test anomalies. Tilted/inverted losses improved from 3/9 to 1/9. Across the same twelve tower seeds, median rose from 3 to 3.5, mean from 3.17 to 4.0, maximum remained 10, and ten-piece completions rose from one to two. Collapse-only anomaly markers fell from four to two; browser errors remained zero. Raw summary: `tortoise-shell-ab.json`. These deterministic centered placements establish non-regression, not player success probability; the tighter shoulder fit still requires physical-phone visual judgment.
