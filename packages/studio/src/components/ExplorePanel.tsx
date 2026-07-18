import { useEffect, useState } from "react";
import type { BookInfo, SearchResult, CharacterItem, EventItem, RelationshipNode, RelationshipLink } from "../api/client.js";
import { api } from "../api/client.js";
import { CluesPanel } from "./CluesPanel.js";

type ExploreTab = "search" | "characters" | "events" | "relationships" | "clues";

interface ExplorePanelProps {
  book: BookInfo;
}

export function ExplorePanel({ book }: ExplorePanelProps) {
  const [tab, setTab] = useState<ExploreTab>("search");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      {error && <div style={{ padding: 12, background: "#fee2e2", borderRadius: 4, marginBottom: 16 }}>{error}</div>}

      <nav style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        {(["search", "characters", "events", "relationships", "clues"] as ExploreTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 16px",
              background: tab === t ? "#2563eb" : "#f3f4f6",
              color: tab === t ? "#fff" : "#111827",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "search" && <SearchPanel book={book} setLoading={setLoading} setError={setError} loading={loading} />}
      {tab === "characters" && <CharactersPanel book={book} setLoading={setLoading} setError={setError} loading={loading} />}
      {tab === "events" && <EventsPanel book={book} setLoading={setLoading} setError={setError} loading={loading} />}
      {tab === "relationships" && <RelationshipsPanel book={book} setLoading={setLoading} setError={setError} loading={loading} />}
      {tab === "clues" && <CluesPanel book={book} setLoading={setLoading} setError={setError} loading={loading} />}
    </div>
  );
}

interface PanelProps {
  book: BookInfo;
  loading: boolean;
  setLoading: (value: boolean) => void;
  setError: (value: string | null) => void;
}

function SearchPanel({ book, loading, setLoading, setError }: PanelProps) {
  const [query, setQuery] = useState("");
  const [nodeType, setNodeType] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const nodeTypes = nodeType ? [nodeType] : undefined;
      const response = await api.search(book.id, query, nodeTypes, 10, 0);
      setResults(response.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by meaning..."
          style={{ flex: 1 }}
          required
        />
        <select value={nodeType} onChange={(e) => setNodeType(e.target.value)} style={{ width: 140 }}>
          <option value="">All types</option>
          <option value="paragraph">Paragraph</option>
          <option value="character">Character</option>
          <option value="event">Event</option>
          <option value="location">Location</option>
        </select>
        <button type="submit" disabled={loading || !query}>{loading ? "Searching..." : "Search"}</button>
      </form>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {results.map((result) => (
          <li
            key={result.nodeId}
            style={{
              padding: 12,
              marginBottom: 8,
              border: "1px solid #e5e7eb",
              borderRadius: 4,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{result.label}</strong>
              <span style={{ color: "#6b7280", fontSize: 12 }}>{result.type} · {result.score.toFixed(3)}</span>
            </div>
            <code style={{ fontSize: 12 }}>{result.nodeId}</code>
          </li>
        ))}
      </ul>
      {!loading && results.length === 0 && <p style={{ color: "#6b7280" }}>No results yet.</p>}
    </div>
  );
}

function CharactersPanel({ book, loading, setLoading, setError }: PanelProps) {
  const [characters, setCharacters] = useState<CharacterItem[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.listCharacters(book.id);
      setCharacters(response.characters);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  return (
    <div>
      <button onClick={load} disabled={loading} style={{ marginBottom: 16 }}>{loading ? "Loading..." : "Refresh"}</button>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {characters.map((character) => (
          <li
            key={character.id}
            style={{
              padding: 12,
              marginBottom: 8,
              border: "1px solid #e5e7eb",
              borderRadius: 4,
            }}
          >
            <strong>{character.label}</strong>{" "}
            <code style={{ fontSize: 12 }}>{character.id}</code>
            {character.appearsIn.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 14, color: "#4b5563" }}>
                Appears in: {character.appearsIn.map((a) => `Ch.${a.chapterNumber}`).join(", ")}
              </div>
            )}
          </li>
        ))}
      </ul>
      {!loading && characters.length === 0 && <p style={{ color: "#6b7280" }}>No characters found.</p>}
    </div>
  );
}

function EventsPanel({ book, loading, setLoading, setError }: PanelProps) {
  const [events, setEvents] = useState<EventItem[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.listEvents(book.id);
      setEvents(response.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  return (
    <div>
      <button onClick={load} disabled={loading} style={{ marginBottom: 16 }}>{loading ? "Loading..." : "Refresh"}</button>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {events.map((event) => (
          <li
            key={event.id}
            style={{
              padding: 12,
              marginBottom: 8,
              borderLeft: "4px solid #2563eb",
              background: "#f9fafb",
              borderRadius: 4,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{event.label}</strong>
              {event.when && <span style={{ color: "#6b7280", fontSize: 12 }}>{event.when}</span>}
            </div>
            <code style={{ fontSize: 12 }}>{event.id}</code>
          </li>
        ))}
      </ul>
      {!loading && events.length === 0 && <p style={{ color: "#6b7280" }}>No events found.</p>}
    </div>
  );
}

function RelationshipsPanel({ book, loading, setLoading, setError }: PanelProps) {
  const [nodes, setNodes] = useState<RelationshipNode[]>([]);
  const [links, setLinks] = useState<RelationshipLink[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.listRelationships(book.id);
      setNodes(response.nodes);
      setLinks(response.links);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div>
      <button onClick={load} disabled={loading} style={{ marginBottom: 16 }}>{loading ? "Loading..." : "Refresh"}</button>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {links.map((link, index) => {
          const source = nodeMap.get(link.source);
          const target = nodeMap.get(link.target);
          return (
            <li
              key={`${link.source}-${link.target}-${index}`}
              style={{
                padding: 12,
                marginBottom: 8,
                border: "1px solid #e5e7eb",
                borderRadius: 4,
              }}
            >
              <strong>{source?.label ?? link.source}</strong>{" "}
              <span style={{ color: "#6b7280" }}>—{link.strength} shared scene{link.strength === 1 ? "" : "s"}—</span>{" "}
              <strong>{target?.label ?? link.target}</strong>
            </li>
          );
        })}
      </ul>
      {!loading && links.length === 0 && <p style={{ color: "#6b7280" }}>No relationships found.</p>}
    </div>
  );
}
