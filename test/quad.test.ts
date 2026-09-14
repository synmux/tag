import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BYTES_PER_QUAD,
  QUAD_ENTROPY_BITS,
  WORDS_PER_QUAD,
  generateQuad,
  quadForFile,
  quadFromBytes,
  quadFromUint16s,
  quadWordlist,
} from "../src/quad.ts";

const QUAD_PATTERN = /^[a-z]+(?:-[a-z]+){3}$/;
const ENTRYPOINT = join(import.meta.dir, "..", "src", "index.ts");

let scratchDirectory: string;
let helloFilePath: string;
let worldFilePath: string;

beforeAll(async () => {
  scratchDirectory = await mkdtemp(join(tmpdir(), "tag-test-"));
  helloFilePath = join(scratchDirectory, "hello.txt");
  worldFilePath = join(scratchDirectory, "world.txt");
  await Bun.write(helloFilePath, "hello\n");
  await Bun.write(worldFilePath, "world\n");
});

afterAll(async () => {
  await rm(scratchDirectory, { recursive: true, force: true });
});

async function runCli(
  ...cliArguments: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const process = Bun.spawn(["bun", ENTRYPOINT, ...cliArguments], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  return { stdout, stderr, exitCode };
}

describe("generateQuad", () => {
  test("produces four lowercase words joined by hyphens", () => {
    const quad = generateQuad();
    expect(quad).toMatch(QUAD_PATTERN);
    expect(quad.split("-")).toHaveLength(WORDS_PER_QUAD);
  });

  test("only uses words from the BIP-39 wordlist", () => {
    const wordSet = new Set(quadWordlist);
    for (let iteration = 0; iteration < 200; iteration += 1) {
      for (const word of generateQuad().split("-")) {
        expect(wordSet.has(word)).toBe(true);
      }
    }
  });

  test("does not repeat itself across calls", () => {
    const quads = new Set(Array.from({ length: 50 }, () => generateQuad()));
    expect(quads.size).toBe(50);
  });

  test("covers the whole wordlist, not just the low half", () => {
    // Guards against a mask or byte-order bug that would silently cap indices.
    const upperHalfStart = quadWordlist.length / 2;
    const upperHalf = new Set(quadWordlist.slice(upperHalfStart));
    let sawUpperHalfWord = false;
    for (
      let iteration = 0;
      iteration < 100 && !sawUpperHalfWord;
      iteration += 1
    ) {
      sawUpperHalfWord = generateQuad()
        .split("-")
        .some((word) => upperHalf.has(word));
    }
    expect(sawUpperHalfWord).toBe(true);
  });

  test("reports 44 bits of entropy", () => {
    expect(QUAD_ENTROPY_BITS).toBe(44);
  });
});

describe("quadFromUint16s", () => {
  test("uses only the low 11 bits of each value", () => {
    expect(quadFromUint16s(new Uint16Array([0, 1, 2047, 0xffff]))).toBe(
      "abandon-ability-zoo-zoo",
    );
  });

  test("rejects the wrong number of values", () => {
    expect(() => quadFromUint16s(new Uint16Array(3))).toThrow(
      "Expected 4 values",
    );
  });
});

describe("quadFromBytes", () => {
  test("reads big-endian 16-bit pairs from the first eight bytes", () => {
    const bytes = new Uint8Array([
      0x00, 0x00, 0x00, 0x01, 0x07, 0xff, 0xff, 0xff, 0xaa, 0xbb,
    ]);
    expect(quadFromBytes(bytes)).toBe("abandon-ability-zoo-zoo");
  });

  test("is deterministic", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    expect(quadFromBytes(bytes)).toBe(quadFromBytes(bytes));
  });

  test("rejects inputs shorter than eight bytes", () => {
    expect(() => quadFromBytes(new Uint8Array(BYTES_PER_QUAD - 1))).toThrow(
      "Need at least 8 bytes",
    );
  });
});

describe("quadForFile", () => {
  test("matches the SHA-256 of the file contents", async () => {
    const digest = new Bun.CryptoHasher("sha256").update("hello\n").digest();
    expect(await quadForFile(helloFilePath)).toBe(quadFromBytes(digest));
  });

  test("returns the same quad for the same file and a different one for different content", async () => {
    const helloQuad = await quadForFile(helloFilePath);
    expect(await quadForFile(helloFilePath)).toBe(helloQuad);
    expect(await quadForFile(worldFilePath)).not.toBe(helloQuad);
  });

  test("rejects a missing file", async () => {
    await expect(
      quadForFile(join(scratchDirectory, "missing.txt")),
    ).rejects.toThrow("File not found");
  });
});

describe("cli", () => {
  test("prints a random quad with no arguments", async () => {
    const { stdout, exitCode } = await runCli();
    expect(exitCode).toBe(0);
    expect(stdout.trimEnd()).toMatch(QUAD_PATTERN);
  });

  test("prints the file-derived quad when given a filename", async () => {
    const { stdout, exitCode } = await runCli(helloFilePath);
    expect(exitCode).toBe(0);
    expect(stdout.trimEnd()).toBe(await quadForFile(helloFilePath));
  });

  test("exits 1 with a message for a missing file", async () => {
    const { stdout, stderr, exitCode } = await runCli(
      join(scratchDirectory, "missing.txt"),
    );
    expect(exitCode).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toContain("File not found");
  });

  test("exits 2 with usage for extra arguments", async () => {
    const { stderr, exitCode } = await runCli(helloFilePath, worldFilePath);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("Usage: tag [filename]");
  });
});
