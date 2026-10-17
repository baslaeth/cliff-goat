// Receives an already-resolved outcome; cannot access or change game state.
export function cosmeticBit() {
  const word = new Uint8Array(1);
  crypto.getRandomValues(word);
  return word[0] & 1; // 128 possible bytes per branch: exactly 50/50.
}

export function failureVariant(success, nextBit = cosmeticBit) {
  if (success) return null; // No cosmetic draw before a failure is known.
  const bit = nextBit();
  if (bit !== 0 && bit !== 1) throw new RangeError('Cosmetic source must return one bit');
  return bit === 0 ? 'crumble' : 'shear';
}
