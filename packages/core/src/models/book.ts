import { EmbeddingStore } from "../embeddings/store.js";
import { randomUUID } from "node:crypto";
import { GraphStore } from "../graph/store.js";
import { AddressResolver } from "../address/resolver.js";
import { ensureBookLayout, getBookPaths, type BookPaths } from "../project/layout.js";
import { type GraphNode, type NodeType, type Branch } from "../graph/types.js";
import type { LLMClient } from "../llm/client.js";
import type { EmbeddingProvider } from "../embeddings/types.js";
import { compose } from "../operations/compose.js";
import { edit } from "../operations/edit.js";
import { query } from "../operations/query.js";
import { snapshot, restoreSnapshot } from "../operations/snapshot.js";
import { buildProjection } from "../projection/markdown.js";
import { proposePatch } from "../diff/proposal.js";
import { applyPatch } from "../operations/patch.js";
import { parseConstraint } from "../constraints/parser.js";
import {
  checkoutBranch,
  forkBranch,
  getCurrentBranch,
  listBranches,
  mergeBranches,
} from "../operations/branch.js";
import type { MergeProposal } from "../operations/branch.js";
import type {
  ComposeOptions,
  ComposeResult,
  EditOptions,
  EditResult,
  QueryOptions,
  QueryResult,
  PatchProposal,
  ApplyPatchResult,
} from "../operations/types.js";

export interface CreateBookOptions {
  projectRoot: string;
  title: string;
  genre: string;
  author?: string;
}

export class Book {
  readonly id: string;
  readonly projectRoot: string;
  readonly store: GraphStore;
  readonly resolver: AddressResolver;
  readonly paths: BookPaths;
  llmClient: LLMClient | undefined;
  private embeddingProvider?: EmbeddingProvider;
  private embeddingStore?: EmbeddingStore;

  private constructor(id: string, projectRoot: string, store: GraphStore, paths: BookPaths) {
    this.id = id;
    this.projectRoot = projectRoot;
    this.store = store;
    this.resolver = new AddressResolver(store);
    this.paths = paths;
  }

  static async create(options: CreateBookOptions): Promise<Book> {
    const id = `book-${Date.now()}`;
    const paths = await ensureBookLayout(options.projectRoot, id);
    const store = new GraphStore(paths.graphDb);

    const now = new Date().toISOString();
    store.createNode({
      id: "book",
      bookId: id,
      type: "book",
      label: options.title,
      contentUri: null,
      properties: {
        title: options.title,
        genre: options.genre,
        author: options.author ?? null,
      },
      createdAt: now,
      updatedAt: now,
    });

    store.createNode({
      id: "characters",
      bookId: id,
      type: "note",
      label: "characters",
      contentUri: null,
      properties: { kind: "container" },
      createdAt: now,
      updatedAt: now,
    });
    store.createEdge({
      id: randomUUID(),
      bookId: id,
      type: "contains",
      fromId: "book",
      toId: "characters",
      properties: {},
      createdAt: now,
    });

    store.createNode({
      id: "locations",
      bookId: id,
      type: "note",
      label: "locations",
      contentUri: null,
      properties: { kind: "container" },
      createdAt: now,
      updatedAt: now,
    });
    store.createEdge({
      id: randomUUID(),
      bookId: id,
      type: "contains",
      fromId: "book",
      toId: "locations",
      properties: {},
      createdAt: now,
    });

    return new Book(id, options.projectRoot, store, paths);
  }

  static async open(projectRoot: string, bookId: string): Promise<Book> {
    const paths = getBookPaths(projectRoot, bookId);
    const store = new GraphStore(paths.graphDb);
    return new Book(bookId, projectRoot, store, paths);
  }

  getNode(path: string): GraphNode | undefined {
    return this.resolver.resolveSingle(this.id, path);
  }

  findNodes(type?: NodeType): GraphNode[] {
    return this.store.findNodes({ bookId: this.id, type });
  }

  compose(options: ComposeOptions): Promise<ComposeResult> {
    return compose(this, options);
  }

  edit(options: EditOptions): Promise<EditResult> {
    return edit(this, options);
  }

  query(options: QueryOptions): Promise<QueryResult> {
    return query(this, options);
  }

  snapshot(name: string): Promise<string> {
    return snapshot(this, name);
  }

  restoreSnapshot(snapshotId: string): Promise<void> {
    return restoreSnapshot(this, snapshotId);
  }

  forkBranch(name: string): Promise<Branch> {
    return forkBranch(this, name);
  }

  listBranches(): Branch[] {
    return listBranches(this);
  }

  getCurrentBranch(): Branch {
    return getCurrentBranch(this);
  }

  checkoutBranch(branchId: string): Promise<Branch> {
    return checkoutBranch(this, branchId);
  }

  mergeBranches(sourceBranchId: string): Promise<MergeProposal> {
    return mergeBranches(this, sourceBranchId);
  }

  async projection(target?: string): Promise<string> {
    return buildProjection(this, target);
  }

  proposePatch(): Promise<PatchProposal> {
    return proposePatch(this);
  }

  applyPatch(proposal: PatchProposal): Promise<ApplyPatchResult> {
    return applyPatch(this, { proposal });
  }

  addConstraint(dsl: string): GraphNode {
    const rule = parseConstraint(dsl);
    const id = `constraint-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    this.store.createNode({
      id,
      bookId: this.id,
      type: "constraint",
      label: dsl,
      contentUri: null,
      properties: { dsl, rule },
      createdAt: now,
      updatedAt: now,
    });
    return this.store.getNode(this.id, id)!;
  }

  listConstraints(): GraphNode[] {
    return this.store.findNodes({ bookId: this.id, type: "constraint" });
  }

  removeConstraint(constraintId: string): void {
    this.store.deleteNode(this.id, constraintId);
  }

  setEmbeddingProvider(provider: EmbeddingProvider): void {
    this.embeddingProvider = provider;
    this.embeddingStore = new EmbeddingStore(this.store, provider);
  }

  getEmbeddingStore(): EmbeddingStore | undefined {
    return this.embeddingStore;
  }

  async ensureEmbeddings(nodeTypes?: string[]): Promise<void> {
    if (!this.embeddingStore || !this.embeddingProvider) {
      throw new Error("Embedding provider not configured. Call book.setEmbeddingProvider(...) first.");
    }

    const nodes = this.store
      .findNodes({ bookId: this.id })
      .filter((node) => !nodeTypes || nodeTypes.length === 0 || nodeTypes.includes(node.type));

    const model = this.embeddingProvider.model();
    const dimension = this.embeddingProvider.dimension();

    const nodesNeedingEmbeddings = nodes.filter((node) => {
      const existing = this.embeddingStore!.get(this.id, node.id);
      if (!existing) return true;
      return existing.model !== model || existing.vector.length !== dimension;
    });
    if (nodesNeedingEmbeddings.length === 0) return;

    const texts = nodesNeedingEmbeddings.map((node) => this.nodeToEmbedText(node));
    const vectors = await this.embeddingProvider.embed(texts);
    const now = new Date().toISOString();

    for (let i = 0; i < nodesNeedingEmbeddings.length; i++) {
      await this.embeddingStore.upsert({
        id: randomUUID(),
        bookId: this.id,
        nodeId: nodesNeedingEmbeddings[i].id,
        model,
        vector: vectors[i],
        createdAt: now,
      });
    }
  }

  private nodeToEmbedText(node: GraphNode): string {
    const parts: string[] = [node.type, node.label];
    if (node.properties.summary) parts.push(String(node.properties.summary));
    if (node.properties.text) parts.push(String(node.properties.text));
    return parts.filter(Boolean).join("\n");
  }

  close(): void {
    try {
      this.store.close();
    } catch {
      // Already closed; ignore.
    }
  }

  setLLMClient(client: LLMClient): void {
    this.llmClient = client;
  }
}
