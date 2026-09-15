#!/usr/bin/env bun
import { Command, CommanderError } from "commander";

import { generateQuad, quadForFile } from "./lib/quad.ts";

/** Exit code when a file cannot be read or hashed. */
const EXIT_FILE_ERROR = 1;

/** Exit code for bad usage: extra arguments, unknown options, and so on. */
const EXIT_USAGE_ERROR = 2;

/**
 * Commander's own exit codes are 0 for help/version and 1 for every usage
 * error. We keep 0 as-is and remap usage errors to 2 so callers can tell a
 * bad invocation apart from a file that could not be read.
 */
function exitFromCommanderError(error: CommanderError): never {
  process.exit(error.exitCode === 0 ? 0 : EXIT_USAGE_ERROR);
}

export function buildProgram(): Command {
  return new Command()
    .name("tag")
    .usage("[filename]")
    .description(
      "Print a word-word-word-word slug drawn from the BIP-39 English wordlist.\n" +
        "With no argument the quad is random. With a filename it is derived from the file's SHA-256.",
    )
    .argument("[filename]", "file whose SHA-256 seeds the quad")
    .showHelpAfterError()
    .exitOverride(exitFromCommanderError)
    .action(async (filename: string | undefined) => {
      const quad =
        filename === undefined ? generateQuad() : await quadForFile(filename);
      console.log(quad);
    });
}

async function main(argv: readonly string[]): Promise<number> {
  try {
    await buildProgram().parseAsync(argv);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return EXIT_FILE_ERROR;
  }
}

process.exitCode = await main(process.argv);
