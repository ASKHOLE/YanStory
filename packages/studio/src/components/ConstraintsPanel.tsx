import { useEffect, useState } from "react";
import type {
  BookInfo,
  ConstraintItem,
  ConstraintTimelineItem,
} from "../api/client.js";
import { api } from "../api/client.js";

type ViewMode = "list" | "timeline";

interface ConstraintsPanelProps {
  book: BookInfo;
  loading: boolean;
  run: <T>(p: Promise<T>, onSuccess: (r: T) => void) => Promise<void>;
  showMessage: (text: string) => void;
}

interface ChapterInfo {
  id: string;
  label: string;
  chapterNumber: number;
}

export function ConstraintsPanel({
  book,
  loading,
  run,
  showMessage,
}: ConstraintsPanelProps) {
  const [view, setView] = useState<ViewMode>("list");
  const [constraints, setConstraints] = useState<ConstraintItem[]>([]);
  const [timeline, setTimeline] = useState<ConstraintTimelineItem[]>([]);
  const [chapters, setChapters] = useState<ChapterInfo[]>([]);

  async function loadList() {
    const result = await api.listConstraints(book.id);
    setConstraints(result.constraints);
  }

  async function loadTimeline() {
    const [timelineResult, chaptersResult] = await Promise.all([
      api.listConstraintTimeline(book.id),
      api.listChapters(book.id),
    ]);
    setTimeline(timelineResult.timeline);
    setChapters(chaptersResult.chapters);
  }

  async function load() {
    if (view === "list") {
      await loadList();
    } else {
      await loadTimeline();
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, view]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const dsl = String(data.get("dsl") ?? "");
    await run(api.addConstraint(book.id, dsl), () => {
      showMessage("Constraint added");
      void load();
    });
    form.reset();
  }

  async function remove(id: string) {
    await run(api.removeConstraint(book.id, id), () => {
      showMessage("Constraint removed");
      void load();
    });
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          name="dsl"
          placeholder="e.g. forbid 魔法 until chapter-0004"
          style={{ flex: 1 }}
          required
        />
        <button type="submit" disabled={loading}>Add</button>
      </form>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setView("list")} disabled={view === "list"}>
          List
        </button>
        <button onClick={() => setView("timeline")} disabled={view === "timeline"}>
          Timeline
        </button>
        <button onClick={load} disabled={loading}>Refresh</button>
      </div>

      {view === "list" ? (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {constraints.map((c) => (
            <li key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #e5e7eb" }}>
              <span><code>{c.id}</code>: {c.dsl}</span>
              <button onClick={() => remove(c.id)} disabled={loading}>Remove</button>
            </li>
          ))}
        </ul>
      ) : (
        <ConstraintTimeline timeline={timeline} chapters={chapters} />
      )}
    </div>
  );
}

function ConstraintTimeline({
  timeline,
  chapters,
}: {
  timeline: ConstraintTimelineItem[];
  chapters: ChapterInfo[];
}) {
  if (chapters.length === 0) {
    return <p style={{ color: "#6b7280" }}>No chapters available for timeline.</p>;
  }

  const maxChapter = Math.max(
    ...chapters.map((c) => c.chapterNumber),
    ...timeline.map((t) => t.endChapterNumber ?? 0),
    ...timeline.map((t) => t.startChapterNumber ?? 0)
  );

  const chapterPositions = new Map<number, number>();
  if (maxChapter > 1) {
    for (const chapter of chapters) {
      const pos = ((chapter.chapterNumber - 1) / (maxChapter - 1)) * 100;
      chapterPositions.set(chapter.chapterNumber, pos);
    }
  } else {
    chapterPositions.set(maxChapter, 0);
  }

  return (
    <div>
      <div style={{ position: "relative", height: 24, marginBottom: 8, marginLeft: 120 }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 10,
            height: 4,
            background: "#e5e7eb",
            borderRadius: 2,
          }}
        />
        {chapters.map((chapter) => {
          const left = chapterPositions.get(chapter.chapterNumber) ?? 0;
          return (
            <div
              key={chapter.id}
              style={{
                position: "absolute",
                left: `${left}%`,
                top: 0,
                transform: "translateX(-50%)",
                textAlign: "center",
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#9ca3af", margin: "0 auto" }} />
              <div style={{ fontSize: 10, color: "#6b7280", whiteSpace: "nowrap" }}>
                {chapter.chapterNumber}. {chapter.label}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {timeline.map((item) => (
          <div key={item.id} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: 120, fontSize: 12, paddingRight: 8, wordBreak: "break-word" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontSize: 10,
                  textTransform: "uppercase",
                  background: item.kind === "forbid" ? "#fee2e2" : "#dbeafe",
                  color: item.kind === "forbid" ? "#991b1b" : "#1e40af",
                  marginRight: 6,
                }}
              >
                {item.kind}
              </span>
              {item.kind === "forbid" ? item.subject : item.event}
            </div>
            <div style={{ position: "relative", flex: 1, height: 24 }}>
              {item.kind === "forbid" ? (
                <ForbidBar item={item} chapterPositions={chapterPositions} maxChapter={maxChapter} />
              ) : (
                <RequireMarker item={item} chapterPositions={chapterPositions} />
              )}
            </div>
          </div>
        ))}
      </div>

      {timeline.length === 0 && (
        <p style={{ color: "#6b7280", marginTop: 16 }}>No constraints to visualize.</p>
      )}
    </div>
  );
}

function ForbidBar({
  item,
  chapterPositions,
  maxChapter,
}: {
  item: Extract<ConstraintTimelineItem, { kind: "forbid" }>;
  chapterPositions: Map<number, number>;
  maxChapter: number;
}) {
  const start = item.startChapterNumber ?? 1;
  const startPos = chapterPositions.get(start) ?? 0;
  let endPos: number;
  let openEnded = false;

  if (item.endChapterNumber !== null) {
    endPos = chapterPositions.get(item.endChapterNumber) ?? 100;
  } else {
    endPos = maxChapter > 1 ? 100 : 100;
    openEnded = true;
  }

  return (
    <div
      style={{
        position: "absolute",
        left: `${startPos}%`,
        width: `${Math.max(endPos - startPos, 0)}%`,
        top: 8,
        height: 8,
        background: openEnded ? "#fecaca" : "#ef4444",
        borderRadius: 4,
        border: openEnded ? "2px dashed #ef4444" : undefined,
      }}
      title={item.dsl}
    />
  );
}

function RequireMarker({
  item,
  chapterPositions,
}: {
  item: Extract<ConstraintTimelineItem, { kind: "require" }>;
  chapterPositions: Map<number, number>;
}) {
  if (item.endChapterNumber === null) return null;
  const pos = chapterPositions.get(item.endChapterNumber) ?? 0;
  return (
    <div
      style={{
        position: "absolute",
        left: `${pos}%`,
        top: 4,
        transform: "translateX(-50%)",
        width: 0,
        height: 0,
        borderLeft: "8px solid transparent",
        borderRight: "8px solid transparent",
        borderBottom: "14px solid #3b82f6",
      }}
      title={item.dsl}
    />
  );
}
