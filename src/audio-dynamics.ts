export type ContactKind = "settling" | "body" | "ground";

const gainRange: Record<ContactKind, { minimum: number; maximum: number }> = {
  settling: { minimum: 0.018, maximum: 0.16 },
  body: { minimum: 0.035, maximum: 0.34 },
  ground: { minimum: 0.08, maximum: 0.46 },
};

export function contactStrengthFromWeightRatio(weightRatio: number) {
  return Math.min(1, Math.max(0, (weightRatio - 0.12) / 2.4));
}

export function contactGain(kind: ContactKind, strength: number) {
  const clampedStrength = Math.min(1, Math.max(0, strength));
  const shapedStrength = Math.pow(clampedStrength, 1.5);
  const range = gainRange[kind];
  return range.minimum + shapedStrength * (range.maximum - range.minimum);
}
