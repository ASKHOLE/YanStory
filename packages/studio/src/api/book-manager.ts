import path from "node:path";
import fs from "node:fs/promises";
import {
  Book,
  ensureProjectLayout,
  listBooks,
  bookExists,
  createLLMClient,
  loadSecrets,
  resolveLLMConfig,
  createHashEmbeddingProvider,
  type LLMClient,
  type EmbeddingProvider,
} from "@yanstory/core";

export interface BookManagerOptions {
  projectRoot: string;
  useStub?: boolean;
  embeddingProvider?: EmbeddingProvider;
}

export class BookManager {
  private readonly projectRoot: string;
  private readonly useStub: boolean;
  private readonly openBooks = new Map<string, Book>();
  private llmClient: LLMClient | undefined;
  private embeddingProvider: EmbeddingProvider;

  constructor(options: BookManagerOptions) {
    this.projectRoot = path.resolve(options.projectRoot);
    this.useStub = options.useStub ?? false;
    this.embeddingProvider = options.embeddingProvider ?? createHashEmbeddingProvider();
  }

  async initialize(): Promise<void> {
    await ensureProjectLayout(this.projectRoot);
    if (!this.useStub) {
      const secrets = await loadSecrets(this.projectRoot);
      const config = resolveLLMConfig(secrets);
      this.llmClient = createLLMClient(config);
    }
  }

  async listBooks() {
    return listBooks(this.projectRoot);
  }

  async createBook(title: string, genre: string): Promise<Book> {
    const book = await Book.create({ projectRoot: this.projectRoot, title, genre });
    this.attachClient(book);
    this.openBooks.set(book.id, book);
    return book;
  }

  async openBook(bookId: string): Promise<Book> {
    const existing = this.openBooks.get(bookId);
    if (existing) return existing;

    if (!(await bookExists(this.projectRoot, bookId))) {
      throw new Error(`Book not found: ${bookId}`);
    }

    const book = await Book.open(this.projectRoot, bookId);
    this.attachClient(book);
    this.openBooks.set(bookId, book);
    return book;
  }

  async getBook(bookId: string): Promise<Book> {
    return this.openBook(bookId);
  }

  closeBook(bookId: string): void {
    const book = this.openBooks.get(bookId);
    if (book) {
      book.close();
      this.openBooks.delete(bookId);
    }
  }

  closeAll(): void {
    for (const book of this.openBooks.values()) {
      book.close();
    }
    this.openBooks.clear();
  }

  private attachClient(book: Book): void {
    book.setEmbeddingProvider(this.embeddingProvider);
    if (this.useStub) {
      // Stub LLM is provided per-request in tests; do not attach globally.
      return;
    }
    if (this.llmClient) {
      book.setLLMClient(this.llmClient);
    }
  }
}

export async function tempProjectRoot(): Promise<string> {
  return fs.mkdtemp(path.join(process.env.TMPDIR ?? "/tmp", "yanstory-studio-"));
}
