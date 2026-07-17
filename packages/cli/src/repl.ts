import readline from "node:readline/promises";
import path from "node:path";
import fs from "node:fs/promises";
import { stdin as input, stdout as output } from "node:process";
import vm from "node:vm";
import {
  Book,
  createLLMClient,
  createLLMStub,
  ensureProjectLayout,
  loadSecrets,
  resolveLLMConfig,
  listBooks,
  exportBook,
  importBook,
  getDisplayConfig,
  setConfigValue,
  type PatchProposal,
} from "@yanstory/core";

export interface ReplOptions {
  projectRoot: string;
  stub?: boolean;
}

interface ReplState {
  projectRoot: string;
  book?: Book;
  lastProposal?: PatchProposal;
}

async function detectProjectRoot(given?: string): Promise<string> {
  if (given) return path.resolve(given);
  return process.cwd();
}

async function listSnapshots(book: Book): Promise<string> {
  const snapshots = book.store.listSnapshots(book.id);
  if (snapshots.length === 0) return "No snapshots found.";
  return snapshots.map((s) => `${s.id}  ${s.name}  ${s.createdAt}`).join("\n");
}

async function openBook(state: ReplState, bookId: string, useStub: boolean): Promise<Book> {
  const book = await Book.open(state.projectRoot, bookId);
  book.setLLMClient(await makeClient(state.projectRoot, useStub));
  state.book = book;
  return book;
}

async function makeClient(projectRoot: string, useStub: boolean) {
  if (useStub) {
    console.log("[stub] Using stub LLM client.");
    return createLLMStub();
  }
  const secrets = await loadSecrets(projectRoot);
  const config = resolveLLMConfig(secrets);
  return createLLMClient(config);
}

async function bookInfo(book: Book): Promise<string> {
  const meta = book.getNode("book");
  const chapters = book.findNodes("chapter");
  const scenes = book.findNodes("scene");
  const paragraphs = book.findNodes("paragraph");
  const snapshots = book.store.listSnapshots(book.id);
  const lines = [
    `Book: ${book.id}`,
    `  Title: ${meta?.label ?? "Untitled"}`,
    `  Genre: ${String(meta?.properties.genre ?? "general")}`,
    `  Author: ${String(meta?.properties.author ?? "(not set)")}`,
    `  Chapters: ${chapters.length}`,
    `  Scenes: ${scenes.length}`,
    `  Paragraphs: ${paragraphs.length}`,
    `  Snapshots: ${snapshots.length}`,
  ];
  return lines.join("\n");
}

export async function runRepl(options: ReplOptions): Promise<void> {
  const projectRoot = await detectProjectRoot(options.projectRoot);
  await ensureProjectLayout(projectRoot);

  const state: ReplState = { projectRoot };

  const rl = readline.createInterface({ input, output, prompt: "yanstory> " });

  console.log(`YanStory REPL — project: ${projectRoot}`);
  console.log("Commands: .books, .open <book-id>, .create <title> <genre>, .help, .exit");

  const context = vm.createContext({
    console,
    Book,
    state,
    book: undefined as Book | undefined,
    async openBook(bookId: string) {
      const b = await openBook(state, bookId, options.stub ?? false);
      context.book = b;
      return `Opened book: ${b.id} — ${b.getNode("book")?.label ?? "Untitled"}`;
    },
    async createBook(title: string, genre: string) {
      const b = await Book.create({ projectRoot, title, genre });
      b.setLLMClient(await makeClient(projectRoot, options.stub ?? false));
      state.book = b;
      context.book = b;
      return `Created book: ${b.id} — ${title}`;
    },
  });

  const help = () => {
    console.log("Available REPL commands:");
    console.log("  Book management:");
    console.log("    .books                         list books");
    console.log("    .open <book-id>                open a book");
    console.log("    .create <title> <genre>        create and open a new book");
    console.log("    .info                          show current book summary");
    console.log("    .export <path>                 export current book to a directory");
    console.log("    .import <path>                 import a book directory");
    console.log("  Snapshots & patches:");
    console.log("    .snapshots                     list snapshots of the current book");
    console.log("    .snapshot <name>               create a named snapshot");
    console.log("    .restore <snapshot-id>         restore the current book to a snapshot");
    console.log("    .propose                       generate a patch proposal from Markdown edits");
    console.log("    .apply                         apply the last proposed patch");
    console.log("  Constraints:");
    console.log('    .constraint add "<dsl>"        add a constraint (e.g. forbid X until chapter-0004)');
    console.log("    .constraints                   list constraints of the current book");
    console.log("    .constraint remove <id>        remove a constraint");
    console.log("  Configuration:");
    console.log("    .config                        show LLM configuration");
    console.log("    .config set <key> <value>      set config (e.g. llm.model gpt-4o-mini)");
    console.log("  General:");
    console.log("    .help                           show this help");
    console.log("    .exit                           exit REPL");
    console.log("JavaScript context:");
    console.log("  book                            current open book");
    console.log("  await book.compose({ intent: '...', targetWords: 1500 })");
    console.log("  await book.edit({ target: 'chapter-0001/scene-1/paragraph-3', operation: 'soften' })");
    console.log("  await book.query({ type: 'characters' })");
    console.log("  await book.projection()");
  };

  for await (const line of rl) {
    const trimmed = line.trim();

    if (trimmed === "" || trimmed === ".exit") {
      if (trimmed === ".exit") break;
      continue;
    }

    if (trimmed === ".help") {
      help();
      continue;
    }

    if (trimmed === ".books") {
      try {
        const books = await listBooks(projectRoot);
        if (books.length === 0) {
          console.log("No books found.");
        } else {
          for (const b of books) {
            console.log(`${b.id}  "${b.title}"  [${b.genre}]  ${b.createdAt}`);
          }
        }
      } catch (error) {
        console.error("Failed to list books:", error instanceof Error ? error.message : error);
      }
      continue;
    }

    if (trimmed.startsWith(".open ")) {
      const bookId = trimmed.slice(5).trim();
      try {
        const message = await context.openBook(bookId);
        console.log(message);
      } catch (error) {
        console.error("Failed to open book:", error instanceof Error ? error.message : error);
      }
      continue;
    }

    if (trimmed.startsWith(".create ")) {
      const parts = trimmed.slice(7).trim().split(" ");
      const title = parts[0] ?? "Untitled";
      const genre = parts[1] ?? "general";
      try {
        const message = await context.createBook(title, genre);
        console.log(message);
      } catch (error) {
        console.error("Failed to create book:", error instanceof Error ? error.message : error);
      }
      continue;
    }

    if (trimmed.startsWith(".import ")) {
      const sourceDir = trimmed.slice(7).trim();
      try {
        const bookId = await importBook(projectRoot, sourceDir);
        const message = await context.openBook(bookId);
        console.log(`Imported book to ${bookId}\n${message}`);
      } catch (error) {
        console.error("Failed to import book:", error instanceof Error ? error.message : error);
      }
      continue;
    }

    if (trimmed.startsWith(".config ")) {
      const rest = trimmed.slice(7).trim();
      if (rest.startsWith("set ")) {
        const setParts = rest.slice(4).trim().split(" ");
        const key = setParts[0];
        const value = setParts.slice(1).join(" ");
        if (!key || value === undefined) {
          console.error("Usage: .config set <key> <value>");
          continue;
        }
        try {
          await setConfigValue(projectRoot, key, value);
          console.log(`Set ${key} = ${value}`);
        } catch (error) {
          console.error("Failed to set config:", error instanceof Error ? error.message : error);
        }
      } else {
        console.error("Usage: .config set <key> <value>");
      }
      continue;
    }

    if (trimmed === ".config") {
      try {
        const config = await getDisplayConfig(projectRoot);
        console.log(`model:    ${config.model}`);
        console.log(`baseUrl:  ${config.baseUrl}`);
        console.log(`apiKey:   ${config.apiKey}`);
      } catch (error) {
        console.error("Failed to read config:", error instanceof Error ? error.message : error);
      }
      continue;
    }

    if (!state.book) {
      if (trimmed.startsWith(".")) {
        console.error("No book is open. Use .open or .create first.");
      }
      continue;
    }

    if (trimmed === ".info") {
      try {
        console.log(await bookInfo(state.book));
      } catch (error) {
        console.error("Failed to get book info:", error instanceof Error ? error.message : error);
      }
      continue;
    }

    if (trimmed.startsWith(".export ")) {
      const targetDir = trimmed.slice(7).trim();
      try {
        await exportBook(projectRoot, state.book.id, path.resolve(targetDir));
        console.log(`Exported book to ${path.resolve(targetDir)}`);
      } catch (error) {
        console.error("Failed to export book:", error instanceof Error ? error.message : error);
      }
      continue;
    }

    if (trimmed === ".snapshots") {
      try {
        console.log(await listSnapshots(state.book));
      } catch (error) {
        console.error("Failed to list snapshots:", error instanceof Error ? error.message : error);
      }
      continue;
    }

    if (trimmed.startsWith(".snapshot ")) {
      const name = trimmed.slice(9).trim();
      try {
        const id = await state.book.snapshot(name || `manual-${Date.now()}`);
        console.log(`Created snapshot: ${id}`);
      } catch (error) {
        console.error("Failed to create snapshot:", error instanceof Error ? error.message : error);
      }
      continue;
    }

    if (trimmed.startsWith(".restore ")) {
      const snapshotId = trimmed.slice(8).trim();
      try {
        await state.book.restoreSnapshot(snapshotId);
        console.log(`Restored snapshot: ${snapshotId}`);
      } catch (error) {
        console.error("Failed to restore snapshot:", error instanceof Error ? error.message : error);
      }
      continue;
    }

    if (trimmed === ".propose") {
      try {
        const proposal = await state.book.proposePatch();
        state.lastProposal = proposal;
        console.log(`Proposed patch: ${proposal.description}`);
        for (const op of proposal.operations) {
          console.log(`  ${op.op}: ${op.path}`);
        }
      } catch (error) {
        console.error("Failed to propose patch:", error instanceof Error ? error.message : error);
      }
      continue;
    }

    if (trimmed === ".apply") {
      if (!state.lastProposal) {
        console.error("No proposal to apply. Run .propose first.");
        continue;
      }
      try {
        const result = await state.book.applyPatch(state.lastProposal);
        console.log(`Applied ${result.applied} operations.`);
        state.lastProposal = undefined;
      } catch (error) {
        console.error("Failed to apply patch:", error instanceof Error ? error.message : error);
      }
      continue;
    }

    if (trimmed === ".constraints") {
      try {
        const constraints = state.book.listConstraints();
        if (constraints.length === 0) {
          console.log("No constraints found.");
        } else {
          for (const c of constraints) {
            console.log(`${c.id}: ${c.properties.dsl}`);
          }
        }
      } catch (error) {
        console.error("Failed to list constraints:", error instanceof Error ? error.message : error);
      }
      continue;
    }

    if (trimmed.startsWith(".constraint add ")) {
      const dsl = trimmed.slice(15).trim().replace(/^"|"$/g, "");
      try {
        const constraint = state.book.addConstraint(dsl);
        console.log(`Added constraint: ${constraint.id}: ${dsl}`);
      } catch (error) {
        console.error("Failed to add constraint:", error instanceof Error ? error.message : error);
      }
      continue;
    }

    if (trimmed.startsWith(".constraint remove ")) {
      const id = trimmed.slice(18).trim();
      try {
        state.book.removeConstraint(id);
        console.log(`Removed constraint: ${id}`);
      } catch (error) {
        console.error("Failed to remove constraint:", error instanceof Error ? error.message : error);
      }
      continue;
    }

    try {
      const result = await vm.runInContext(`(async () => { return ${trimmed}; })()`, context);
      if (result !== undefined) {
        console.log(result);
      }
    } catch (error) {
      try {
        const result = await vm.runInContext(`(async () => { ${trimmed} })()`, context);
        if (result !== undefined) {
          console.log(result);
        }
      } catch (innerError) {
        console.error("Error:", innerError instanceof Error ? innerError.message : innerError);
      }
    }
  }

  state.book?.close();
  rl.close();
  console.log("Goodbye.");
}
