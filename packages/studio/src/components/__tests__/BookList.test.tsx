// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BookList } from "../BookList.js";

const sampleBooks = [
  { id: "book-1", title: "Book One", genre: "xuanhuan", createdAt: "2026-07-17T00:00:00Z" },
  { id: "book-2", title: "Book Two", genre: "wuxia", createdAt: "2026-07-17T00:00:00Z" },
];

describe("BookList", () => {
  it("renders books and highlights current", () => {
    render(
      <BookList
        books={sampleBooks}
        current={{ id: "book-1", title: "Book One", genre: "xuanhuan", author: "", chapters: 0, scenes: 0, paragraphs: 0, snapshots: 0, constraints: 0 }}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        loading={false}
      />
    );

    expect(screen.getByText("Book One")).toBeInTheDocument();
    expect(screen.getByText("Book Two")).toBeInTheDocument();
  });

  it("calls onSelect when a book is clicked", () => {
    const onSelect = vi.fn();
    render(
      <BookList
        books={sampleBooks}
        current={null}
        onSelect={onSelect}
        onCreate={vi.fn()}
        loading={false}
      />
    );

    fireEvent.click(screen.getByText("Book Two"));
    expect(onSelect).toHaveBeenCalledWith("book-2");
  });

  it("calls onCreate with title and genre on submit", () => {
    const onCreate = vi.fn();
    render(
      <BookList
        books={[]}
        current={null}
        onSelect={vi.fn()}
        onCreate={onCreate}
        loading={false}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Title"), { target: { value: "New Book" } });
    fireEvent.change(screen.getByPlaceholderText("Genre"), { target: { value: "xianxia" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Book" }));

    expect(onCreate).toHaveBeenCalledWith("New Book", "xianxia");
  });

  it("disables the create button while loading", () => {
    render(
      <BookList
        books={[]}
        current={null}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        loading={true}
      />
    );

    expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled();
  });
});
