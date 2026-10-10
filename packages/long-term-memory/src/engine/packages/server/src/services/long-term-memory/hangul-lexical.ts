// Korean lexical helpers shared by the BM25 and keyword recall lanes.
//
// Issue #1295: Korean writes particles onto the noun (`반지를`, `무진에게`) and
// often drops the space inside a compound (`그림선물`). These helpers derive
// retrieval aliases only; they never change stored text or subject identity.
// The particle set mirrors `subject-identity.ts` (which owns name binding) but
// stays independent so identity behavior is untouched.
//
// ponytail: no real morphological analyzer and no verb conjugation. A trailing
// particle is stripped when the stem keeps two syllables; nouns that merely end
// in a particle-shaped syllable (for example `정치가` -> `정치`) gain a broad
// alias. Replace with a Hangul morphology table if false positives matter.

const HANGUL_TOKEN_PATTERN = /^\p{Script=Hangul}+$/u;
// A particle written directly after a noun. The permitted form depends on the
// preceding syllable's final consonant (batchim), so the match is validated
// against the stem rather than accepted from the particle alone.
const HANGUL_PARTICLE_ANY = /^(?:[의도]|(?:에게|에서|한테)[는도]?)$/u;
const HANGUL_PARTICLE_OPEN = /^(?:[는가를와]|로[는도]?)$/u;
const HANGUL_PARTICLE_CLOSED = /^(?:[은이을과]|으로[는도]?)$/u;

export function isHangulToken(value: string) {
  return HANGUL_TOKEN_PATTERN.test(value);
}

function isHangulParticle(stem: string, particle: string) {
  const syllable = stem.charCodeAt(stem.length - 1) - 0xac00;
  if (syllable < 0 || syllable > 11171) return false;
  if (HANGUL_PARTICLE_ANY.test(particle)) return true;
  const final = syllable % 28;
  if (final === 0) return HANGUL_PARTICLE_OPEN.test(particle);
  if (final === 8 && particle.startsWith("으")) return false;
  return HANGUL_PARTICLE_CLOSED.test(final === 8 ? particle.replace(/^로/u, "으로") : particle);
}

/**
 * Returns the stem of a Hangul token when a trailing particle can be removed
 * without leaving a one-syllable stub, otherwise the token unchanged. The
 * two-syllable floor keeps common short words (`아이`, `새가`) intact.
 */
export function stripHangulParticle(token: string) {
  const value = token.normalize("NFC");
  if (!isHangulToken(value)) return token;
  for (let length = 1; length <= 4 && value.length - length >= 2; length += 1) {
    if (isHangulParticle(value.slice(0, -length), value.slice(-length))) return value.slice(0, -length);
  }
  return value;
}
