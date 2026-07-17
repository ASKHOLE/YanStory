import type { BookListing, BookInfo } from "../api/client.js";

interface BookListProps {
  books: BookListing[];
  current: BookInfo | null;
  onSelect: (id: string) => void;
  onCreate: (title: string, genre: string) => void;
  loading: boolean;
}

export function BookList({ books, current, onSelect, onCreate, loading }: BookListProps) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const genre = String(data.get("genre") ?? "").trim();
    if (!title) return;
    onCreate(title, genre || "general");
    form.reset();
  }

  return (
    <aside style={{ width: 280, borderRight: "1px solid #e5e7eb", padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Books</h2>
      <form onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
        <input name="title" placeholder="Title" required style={{ width: "100%", marginBottom: 8 }} />
        <input name="genre" placeholder="Genre" style={{ width: "100%", marginBottom: 8 }} />
        <button type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Creating..." : "Create Book"}
        </button>
      </form>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {books.map((book) => (
          <li key={book.id} style={{ marginBottom: 8 }}>
            <button
              onClick={() => onSelect(book.id)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: 8,
                background: current?.id === book.id ? "#eff6ff" : "transparent",
                border: "1px solid #e5e7eb",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 600 }}>{book.title}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                {book.id} · {book.genre}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
