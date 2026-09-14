import { wordlist as bip39EnglishWordlist } from "@scure/bip39/wordlists/english.js";

/** Number of words in a generated quad. */
export const WORDS_PER_QUAD = 4;

/** Bytes consumed per quad: one 16-bit value per word. */
export const BYTES_PER_QUAD = WORDS_PER_QUAD * 2;

/**
 * The BIP-39 English wordlist is exactly 2^11 entries, so an 11-bit mask over
 * uniform random bytes selects a word with no modulo bias. Anything else would
 * need rejection sampling, so we refuse to run against a different list size.
 */
const EXPECTED_WORDLIST_SIZE = 2048;
const INDEX_MASK = EXPECTED_WORDLIST_SIZE - 1;

if (bip39EnglishWordlist.length !== EXPECTED_WORDLIST_SIZE) {
  throw new Error(
    `Expected the BIP-39 wordlist to contain ${EXPECTED_WORDLIST_SIZE} words, found ${bip39EnglishWordlist.length}`,
  );
}

/** The wordlist quads are drawn from, exposed for tests and callers that want to validate output. */
export const quadWordlist: readonly string[] = bip39EnglishWordlist;

/** Bits of entropy in one quad: four uniform draws from a 2048-word list. */
export const QUAD_ENTROPY_BITS =
  WORDS_PER_QUAD * Math.log2(EXPECTED_WORDLIST_SIZE);

/**
 * Map four 16-bit values to a `word-word-word-word` slug. Only the low 11 bits
 * of each value are used. Words may repeat; each position is independent.
 */
export function quadFromUint16s(values: Uint16Array): string {
  if (values.length !== WORDS_PER_QUAD) {
    throw new Error(
      `Expected ${WORDS_PER_QUAD} values, received ${values.length}`,
    );
  }
  const words: string[] = [];
  for (const value of values) {
    const wordIndex = value & INDEX_MASK;
    const word = quadWordlist[wordIndex];
    if (word === undefined) {
      throw new Error(
        `Word index ${wordIndex} is out of range for the wordlist`,
      );
    }
    words.push(word);
  }
  return words.join("-");
}

/**
 * Deterministically map the first eight bytes of `bytes` (read big-endian, two
 * bytes per word) to a quad. Intended for hash digests; the same input always
 * yields the same quad.
 */
export function quadFromBytes(bytes: Uint8Array): string {
  if (bytes.length < BYTES_PER_QUAD) {
    throw new Error(
      `Need at least ${BYTES_PER_QUAD} bytes to derive a quad, received ${bytes.length}`,
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const values = new Uint16Array(WORDS_PER_QUAD);
  for (let wordPosition = 0; wordPosition < WORDS_PER_QUAD; wordPosition += 1) {
    values[wordPosition] = view.getUint16(wordPosition * 2, false);
  }
  return quadFromUint16s(values);
}

/** Generate a quad from the platform CSPRNG. */
export function generateQuad(): string {
  return quadFromUint16s(
    crypto.getRandomValues(new Uint16Array(WORDS_PER_QUAD)),
  );
}

/**
 * Derive a quad from the SHA-256 of a file's contents, streamed so large files
 * are not held in memory. Throws if the file cannot be read.
 */
export async function quadForFile(filePath: string): Promise<string> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    throw new Error(`File not found: ${filePath}`);
  }
  const hasher = new Bun.CryptoHasher("sha256");
  for await (const chunk of file.stream()) {
    hasher.update(chunk);
  }
  return quadFromBytes(hasher.digest());
}
