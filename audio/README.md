# Menagerie sound-bank development

This directory defines the reproducible source prompts for Menagerie's physics-driven ceramic contact bank. The approved runtime set contains settling seeds `142001`, `142002`, `142004`, and `142005`, plus body-contact seeds `142103`, `142111`, `142114`, and `142116`. Their processed WAVs ship from `public/audio/ceramic/`; untouched raw generations and the complete run manifest remain in the playground and audition bundle. Stronger impacts and platform contacts still need their own approved family.

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

Do not copy future candidates into the runtime bank merely because they pass technical validation. First audition repeated clicks and impacts against gameplay, select the pleasing variants, and record that human selection. The browser uses measured Rapier contact strength to choose and modulate the approved samples rather than playing a canned settling sequence.

## Shipping and licensing

Only selected generated WAV outputs will be distributed. Stable Audio model weights and runtime remain local. Menagerie's original code and project-owned audio assets are MIT-licensed; third-party models and tools retain their own terms. See `licensing` in `sfx-bank.json` for the terms reviewed for this generation.
