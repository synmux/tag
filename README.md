# `@synmux/tg`

Prints one `word-word-word-word` slug drawn from the BIP-39 English wordlist
(2048 words). Intended for human-readable version tags.

```bash
bun install
bun link            # optional: puts `tg` on your PATH

tg                 # random quad from the CSPRNG, e.g. hurdle-glare-nation-wrist
tg dist/app.js     # quad derived from the file's SHA-256; same bytes, same quad
```

Without `bun link`, use `bun src/index.ts [filename]`. Pass `--help` for usage.

Random quads carry 44 bits of entropy (four uniform draws from 2048 words).
File quads take the first 8 bytes of the SHA-256 digest, two bytes per word,
big-endian, and use the low 11 bits of each pair.

Exit codes: 0 success, 1 file could not be read, 2 bad arguments.

Tests and typecheck:

```bash
bun test
bun run lint:types
```
