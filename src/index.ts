import { program } from "commander";

program.option("--first").option("-s, --separator <char>").argument("<string>");

program.parse();

const options = program.opts();
const limit = options.first ? 1 : undefined;

if (program.args && program.args[0]) {
  console.log(program.args[0].split(options.separator, limit));
}
