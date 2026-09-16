export type ContactAudioState = {
  lastSeenStep: number;
  baselineRatio: number;
  previousRatio: number;
  quietSteps: number;
  armed: boolean;
  triggerSteps: number[];
};

export type ContactAudioObservation = {
  state: ContactAudioState;
  trigger: "initial" | "renewed-impact" | null;
  rearmed: boolean;
  spikeRatio: number;
};

const separationSteps = 2;
const quietStepsToRearm = 6;
const minimumInitialRatio = 0.12;
const minimumRenewedRatio = 0.20;
const minimumRetriggerGapSteps = 9;
const triggerBudgetWindowSteps = 60;
const maximumTriggersPerWindow = 3;

export function observeContactAudio(
  previous: ContactAudioState | undefined,
  step: number,
  ratio: number,
): ContactAudioObservation {
  const isNewContact = !previous || previous.lastSeenStep < step - separationSteps;
  const recentTriggers = (previous?.triggerSteps ?? []).filter((triggerStep) => triggerStep > step - triggerBudgetWindowSteps);

  if (isNewContact) {
    const trigger = ratio >= minimumInitialRatio && recentTriggers.length < maximumTriggersPerWindow ? "initial" : null;
    if (trigger) recentTriggers.push(step);
    return {
      state: {
        lastSeenStep: step,
        baselineRatio: ratio,
        previousRatio: ratio,
        quietSteps: 0,
        armed: false,
        triggerSteps: recentTriggers,
      },
      trigger,
      rearmed: false,
      spikeRatio: 0,
    };
  }

  const baselineBefore = previous.baselineRatio;
  const spikeRatio = ratio - baselineBefore;
  const quietThreshold = Math.max(0.06, baselineBefore * 0.12);
  // Quiet means that the force is no longer changing materially. It does not
  // need to equal the older baseline: the initial impact is expected to decay
  // toward a lower, steady load before the pair can rearm.
  const stable = Math.abs(ratio - previous.previousRatio) <= quietThreshold;
  let quietSteps = previous.armed ? previous.quietSteps : stable ? previous.quietSteps + 1 : 0;
  let armed = previous.armed;
  let rearmed = false;

  if (!armed && quietSteps >= quietStepsToRearm) {
    armed = true;
    rearmed = true;
  }

  const lastTriggerStep = recentTriggers.at(-1) ?? -Infinity;
  const spikeThreshold = Math.max(0.16, baselineBefore * 0.50);
  const canTrigger = armed
    && ratio >= minimumRenewedRatio
    && spikeRatio >= spikeThreshold
    && step - lastTriggerStep >= minimumRetriggerGapSteps
    && recentTriggers.length < maximumTriggersPerWindow;
  const trigger = canTrigger ? "renewed-impact" : null;
  if (trigger) {
    recentTriggers.push(step);
    armed = false;
    quietSteps = 0;
  }

  // Follow sustained load quickly while disarmed, but only drift slowly while
  // armed so a sudden second impact remains visible above the recent baseline.
  const baselineBlend = armed ? 0.04 : 0.18;
  const baselineRatio = baselineBefore + (ratio - baselineBefore) * baselineBlend;

  return {
    state: {
      lastSeenStep: step,
      baselineRatio,
      previousRatio: ratio,
      quietSteps,
      armed,
      triggerSteps: recentTriggers,
    },
    trigger,
    rearmed,
    spikeRatio,
  };
}
