import path from "node:path";
import fs from "node:fs/promises";
import {
  Book,
  ensureProjectLayout,
  listBooks,
  bookExists,
  createLLMClient,
  createLLMStub,
  loadSecrets,
  resolveLLMConfig,
  resolveEmbeddingConfig,
  createEmbeddingProvider,
  createHashEmbeddingProvider,
  HashEmbeddingProvider,
  type LLMClient,
  type EmbeddingProvider,
  type ResolvedEmbeddingConfig,
  type Branch,
  type MergeProposal,
} from "@yanstory/core";

export interface BookManagerOptions {
  projectRoot: string;
  useStub?: boolean;
  embeddingProvider?: EmbeddingProvider;
}

export class BookManager {
  private readonly projectRoot: string;
  private readonly useStub: boolean;
  private readonly embeddingProviderExternal: boolean;
  private readonly openBooks = new Map<string, Book>();
  private llmClient: LLMClient | undefined;
  private embeddingProvider: EmbeddingProvider;
  private embeddingConfig: ResolvedEmbeddingConfig;

  constructor(options: BookManagerOptions) {
    this.projectRoot = path.resolve(options.projectRoot);
    this.useStub = options.useStub ?? false;
    this.embeddingProviderExternal = options.embeddingProvider !== undefined;
    this.embeddingProvider = options.embeddingProvider ?? createHashEmbeddingProvider();
    this.embeddingConfig = resolveEmbeddingConfig({});
  }

  async initialize(): Promise<void> {
    await ensureProjectLayout(this.projectRoot);
    const secrets = await loadSecrets(this.projectRoot);
    this.embeddingConfig = resolveEmbeddingConfig(secrets);
    if (!this.embeddingProviderExternal) {
      this.embeddingProvider = createEmbeddingProvider(this.embeddingConfig);
    }
    if (!this.useStub) {
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

  getEmbeddingConfig(): ResolvedEmbeddingConfig {
    const provider = this.embeddingProvider;
    const base = this.embeddingConfig;
    if (provider instanceof HashEmbeddingProvider) {
      return {
        provider: "hash",
        model: provider.model(),
        dimension: provider.dimension(),
      };
    }
    return {
      provider: "fastembed",
      model: provider.model(),
      dimension: provider.dimension(),
      cacheDir: base.cacheDir,
    };
  }

  async forkBranch(bookId: string, name: string): Promise<Branch> {
    const book = await this.getBook(bookId);
    return book.forkBranch(name);
  }

  async checkoutBranch(bookId: string, branchId: string): Promise<Branch> {
    const book = await this.getBook(bookId);
    await book.checkoutBranch(branchId);
    this.closeBook(bookId);
    const reopened = await this.openBook(bookId);
    return reopened.getCurrentBranch();
  }

  async mergeBranches(bookId: string, sourceBranchId: string): Promise<MergeProposal> {
    const book = await this.getBook(bookId);
    return book.mergeBranches(sourceBranchId);
  }

  private attachClient(book: Book): void {
    book.setEmbeddingProvider(this.embeddingProvider);
    if (this.useStub) {
      book.setLLMClient(createLLMStub());
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
