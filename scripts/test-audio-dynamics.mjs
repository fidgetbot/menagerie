import assert from "node:assert/strict";
import { contactGain, contactStrengthFromWeightRatio } from "../src/audio-dynamics.ts";

const dbDifference = (higher, lower) => 20 * Math.log10(higher / lower);
const gainAtRatio = (kind, ratio) => contactGain(kind, contactStrengthFromWeightRatio(ratio));

const ratios = [0.12, 0.2, 0.4, 0.8, 1.2, 1.8, 2.52];
const bodyGains = ratios.map((ratio) => gainAtRatio("body", ratio));
for (let index = 1; index < bodyGains.length; index += 1) {
  assert(bodyGains[index] > bodyGains[index - 1], "Contact gain must rise monotonically with force");
}

const smallContact = gainAtRatio("settling", 0.22);
const mediumContact = gainAtRatio("body", 0.9);
const hardContact = gainAtRatio("body", 2.2);
assert(dbDifference(mediumContact, smallContact) >= 12, "Small contacts are not sufficiently quieter than medium contacts");
assert(dbDifference(hardContact, mediumContact) >= 8, "Hard contacts are not sufficiently louder than medium contacts");
assert(contactGain("ground", 1) > contactGain("body", 1), "A hard ground loss should retain the heaviest treatment");

console.log("Audio dynamics: monotonic force response with >12 dB small-to-medium and >8 dB medium-to-hard separation");
