import assert from "node:assert/strict";
import { observeContactAudio } from "../src/contact-audio-detector.ts";

function observe(sequence) {
  let state;
  const events = [];
  for (const [step, ratio] of sequence) {
    const observation = observeContactAudio(state, step, ratio);
    state = observation.state;
    if (observation.trigger) events.push({ step, trigger: observation.trigger });
  }
  return { state, events };
}

const twoStageTopple = observe([
  [1, 1.10],
  [2, 0.82], [3, 0.65], [4, 0.55], [5, 0.51],
  [6, 0.50], [7, 0.51], [8, 0.50], [9, 0.51], [10, 0.50], [11, 0.50],
  [12, 1.45],
]);
assert.deepEqual(twoStageTopple.events, [
  { step: 1, trigger: "initial" },
  { step: 12, trigger: "renewed-impact" },
]);

const ordinarySettling = observe([
  [1, 0.72],
  [2, 0.58], [3, 0.51], [4, 0.48],
  ...Array.from({ length: 56 }, (_, index) => [index + 5, 0.49 + (index % 3 - 1) * 0.025]),
]);
assert.deepEqual(ordinarySettling.events, [{ step: 1, trigger: "initial" }]);
assert.equal(ordinarySettling.state.armed, true);

const separatedContact = observe([
  [1, 0.55],
  [5, 0.62],
]);
assert.deepEqual(separatedContact.events, [
  { step: 1, trigger: "initial" },
  { step: 5, trigger: "initial" },
]);

const burstBudget = observe([
  [1, 0.80],
  [5, 0.80],
  [9, 0.80],
  [13, 0.80],
]);
assert.equal(burstBudget.events.length, 3);

console.log("Contact audio detector: two-stage topple retriggers; settling jitter and burst chatter stay silent");
