# Menagerie sound-bank development

This directory defines the reproducible source prompts for Menagerie's physics-driven ceramic contact bank. The approved runtime set is the muted-stoneware family selected from the second browser audition: seeds `216001`, `216002`, `216003`, and `216004`. Their processed WAVs ship from `public/audio/ceramic/`; untouched stereo generations and the complete run manifest remain in the playground. The browser reuses this one coherent family with separate settling, body-contact, and ground-contact gain and pitch treatments.

The approved runtime copies are the exact normalized mono 44.1 kHz PCM16 previews Nicolas reviewed; they are not offline pitch-shifted. Runtime playback gives quiet settling a slightly brighter voice, ordinary animal contact a natural voice, and ground contact a lower, stronger voice without changing source provenance.

## Generate the candidate bank

```sh
npm run audio:generate
```

By default, raw and processed candidates are written outside the repository to:

```text
/Users/fidget/.openclaw/playground/audio-generation/menagerie/stoneware-contacts-v2/
```

Use `npm run audio:plan` to inspect the commands without generating. The generator accepts `--manifest PATH`, `--event EVENT_ID`, `--limit COUNT`, `--force`, and `--output ABSOLUTE_DIRECTORY` after `--`. `audio/sfx-bank.json` remains the approved runtime source definition; separate audition manifests such as `audio/sfx-audition-v2.json` can explore new directions without changing that bank.

Each run preserves:

- untouched stereo Stable Audio output in `raw/`;
- mono, silence-trimmed, peak-normalized candidates in `processed/`;
- model, prompt, seed, processing, probe, sample-level clipping checks, and licensing provenance in `run-manifest.json`;
- an `audition.html` page with players grouped by event family.

To replace the public audition-only bundle with a validated run, publish its
processed previews from the external archive:

```sh
npm run audio:publish-audition -- --source /absolute/path/to/the/run
```

The publisher deliberately excludes untouched raw masters and removes local
filesystem paths from the public manifest. It does not modify the runtime bank.

Each candidate must contain one isolated contact. The validator rejects a processed
preview when energy resumes after at least 15 ms below -30 dBFS, while retaining
zero-crossing rate only as a diagnostic for tonal rings.

Do not copy future candidates into the runtime bank merely because they pass technical validation. First audition repeated clicks and impacts against gameplay, select the pleasing variants, and record that human selection. The browser uses measured Rapier contact strength to choose and modulate the approved samples rather than playing a canned settling sequence.

## Shipping and licensing

Only selected generated WAV outputs will be distributed. Stable Audio model weights and runtime remain local. Menagerie's original code and project-owned audio assets are MIT-licensed; third-party models and tools retain their own terms. See `licensing` in `sfx-bank.json` for the terms reviewed for this generation.
