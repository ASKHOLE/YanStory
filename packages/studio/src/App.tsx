import { useEffect, useState } from "react";
import { api, type BookInfo, type BookListing } from "./api/client.js";
import { BookList } from "./components/BookList.js";
import { BookWorkspace } from "./components/BookWorkspace.js";

export default function App() {
  const [books, setBooks] = useState<BookListing[]>([]);
  const [currentBook, setCurrentBook] = useState<BookInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadBooks() {
    try {
      const result = await api.listBooks();
      setBooks(result.books);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    void loadBooks();
  }, []);

  async function handleCreate(title: string, genre: string) {
    setLoading(true);
    try {
      const created = await api.createBook(title, genre);
      await loadBooks();
      await handleSelect(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(id: string) {
    setLoading(true);
    try {
      const info = await api.openBook(id);
      setCurrentBook(info);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function refreshCurrent() {
    if (!currentBook) return;
    const info = await api.getBookInfo(currentBook.id);
    setCurrentBook(info);
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <BookList
        books={books}
        current={currentBook}
        onSelect={handleSelect}
        onCreate={handleCreate}
        loading={loading}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {error && (
          <div style={{ padding: 12, background: "#fee2e2" }}>
            Error: {error}
          </div>
        )}
        {currentBook ? (
          <BookWorkspace book={currentBook} onRefresh={refreshCurrent} />
        ) : (
          <div style={{ padding: 24, color: "#6b7280" }}>Select or create a book to start writing.</div>
        )}
      </div>
    </div>
  );
}
