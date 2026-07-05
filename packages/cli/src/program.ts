import { Command } from "commander";
import { helloCore } from "@yanstory/core";

export function createProgram(): Command {
  const program = new Command("yanstory");

  program
    .version("0.1.0")
    .description("YanStory - AI novel writing studio")
    .action(() => {
      console.log(helloCore());
      console.log("Run `yanstory --help` for available commands.");
    });

  return program;
}

export async function runProgram(argv?: string[]): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv ?? process.argv);
}
