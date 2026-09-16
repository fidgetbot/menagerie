# Menagerie sound-bank development

Menagerie is currently silent. This directory defines reproducible source prompts for an exploratory physics-driven ceramic contact bank; it does not contain approved or shipped audio. The current pass deliberately tests only the core material: four tiny porcelain ticks and four clear hollow clinks. Stronger impacts will be generated only after this material character is approved.

## Generate the candidate bank

```sh
npm run audio:generate
```

By default, raw and processed candidates are written outside the repository to:

```text
/Users/fidget/.openclaw/playground/audio-generation/menagerie/ceramic-contacts-v1/
```

Use `npm run audio:plan` to inspect the commands without generating. The generator accepts `--event EVENT_ID`, `--limit COUNT`, `--force`, and `--output ABSOLUTE_DIRECTORY` after `--`.

Each run preserves:

- untouched stereo Stable Audio output in `raw/`;
- mono, silence-trimmed, peak-normalized candidates in `processed/`;
- model, prompt, seed, processing, probe, sample-level clipping checks, and licensing provenance in `run-manifest.json`;
- an `audition.html` page with players grouped by event family.

Each candidate must contain one isolated contact. The validator rejects a processed
preview when energy resumes after at least 15 ms below -30 dBFS, while retaining
zero-crossing rate only as a diagnostic for tonal rings.

Do not copy candidates into `public/` merely because they pass technical validation. First audition repeated clicks and impacts against gameplay, select the pleasing variants, and record that human selection. The browser should use measured Rapier contact strength to choose and modulate approved samples rather than playing a canned settling sequence.

## Shipping and licensing

Only selected generated WAV outputs will be distributed. Stable Audio model weights and runtime remain local. Menagerie's original code and project-owned audio assets are MIT-licensed; third-party models and tools retain their own terms. See `licensing` in `sfx-bank.json` for the terms reviewed for this generation.
