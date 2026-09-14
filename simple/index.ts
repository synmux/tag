#!/usr/bin/env bun
import { generateQuad, quadForFile } from "./quad.ts";

const USAGE =
  "Usage: tag [filename]\n\nWith no argument, prints a random quad. With a filename, prints the quad derived from the file's SHA-256.";

async function main(argv: readonly string[]): Promise<number> {
  const [filePath, ...extraArguments] = argv;

  if (extraArguments.length > 0) {
    console.error(USAGE);
    return 2;
  }

  if (filePath === undefined) {
    console.log(generateQuad());
    return 0;
  }

  try {
    console.log(await quadForFile(filePath));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

process.exitCode = await main(process.argv.slice(2));
