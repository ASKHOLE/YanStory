import { Command } from "commander";
import { runRepl } from "./repl.js";

export function createProgram(): Command {
  const program = new Command("yanstory");

  program
    .version("0.1.0")
    .description("YanStory - AI novel writing studio")
    .action(() => {
      console.log("YanStory - AI novel writing studio");
      console.log("Run `yanstory --help` for available commands.");
    });

  program
    .command("repl")
    .description("Start the interactive novel REPL")
    .option("--project <path>", "Project root directory", process.cwd())
    .option("--stub", "Use a stub LLM client instead of calling a real provider", false)
    .action(async (options: { project: string; stub: boolean }) => {
      await runRepl({ projectRoot: options.project, stub: options.stub });
    });

  return program;
}

export async function runProgram(argv?: string[]): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv ?? process.argv);
}
