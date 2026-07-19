import { useEffect, useState } from "react";
import type {
  BookInfo,
  ConstraintItem,
  ConstraintTimelineItem,
  ConstraintViolation,
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

function constraintKind(dsl: string): string {
  const lower = dsl.trim().toLowerCase();
  if (lower.startsWith("forbid ")) return "forbid";
  if (lower.startsWith("require ")) return "require";
  if (lower.startsWith("never ")) return "never";
  if (lower.startsWith("prevent ")) return "prevent";
  if (lower.startsWith("cannot ")) return "cannot";
  return "constraint";
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
  const [precheckTarget, setPrecheckTarget] = useState("");
  const [precheckIntent, setPrecheckIntent] = useState("");
  const [precheckViolations, setPrecheckViolations] = useState<ConstraintViolation[]>([]);

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

  async function runPrecheck(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = await api.precheckConstraints(book.id, precheckTarget, precheckIntent);
    setPrecheckViolations(result.violations);
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          name="dsl"
          placeholder="e.g. forbid 魔法 until chapter-0004, never 主角死亡, prevent ..."
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

      {view === "list" && (
        <form onSubmit={runPrecheck} style={{ marginBottom: 16, padding: 12, border: "1px solid #e5e7eb", borderRadius: 6 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>Causal pre-check</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              placeholder="Target path (e.g. chapter-0002/scene-1/paragraph-1)"
              value={precheckTarget}
              onChange={(e) => setPrecheckTarget(e.target.value)}
              style={{ flex: 1 }}
              required
            />
            <input
              placeholder="Intent / text to check"
              value={precheckIntent}
              onChange={(e) => setPrecheckIntent(e.target.value)}
              style={{ flex: 1 }}
              required
            />
            <button type="submit" disabled={loading}>Pre-check</button>
          </div>
          {precheckViolations.length === 0 ? (
            precheckTarget && precheckIntent && (
              <p style={{ color: "#15803d", margin: 0 }}>No causal violations detected.</p>
            )
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {precheckViolations.map((v) => (
                <li key={v.constraintId} style={{ color: "#991b1b", marginBottom: 4 }}>
                  {v.message}
                </li>
              ))}
            </ul>
          )}
        </form>
      )}

      {view === "list" ? (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {constraints.map((c) => (
            <li key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #e5e7eb" }}>
              <span>
                <KindBadge kind={constraintKind(c.dsl)} />
                <code>{c.id}</code>: {c.dsl}
              </span>
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

function KindBadge({ kind }: { kind: string }) {
  const isNegative = kind === "forbid" || kind === "never" || kind === "prevent" || kind === "cannot";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 6px",
        borderRadius: 4,
        fontSize: 10,
        textTransform: "uppercase",
        background: isNegative ? "#fee2e2" : "#dbeafe",
        color: isNegative ? "#991b1b" : "#1e40af",
        marginRight: 6,
      }}
    >
      {kind}
    </span>
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
        {timeline.map((item) => {
          const isRange =
            item.kind === "forbid" || item.kind === "never" || item.kind === "prevent" || item.kind === "cannot";
          const label =
            item.kind === "forbid" || item.kind === "never"
              ? item.subject
              : item.kind === "require" || item.kind === "prevent"
              ? item.event
              : `${item.actor} ${item.action}`;
          return (
            <div key={item.id} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ width: 120, fontSize: 12, paddingRight: 8, wordBreak: "break-word" }}>
                <KindBadge kind={item.kind} />
                {label}
              </div>
              <div style={{ position: "relative", flex: 1, height: 24 }}>
                {isRange ? (
                  <ConstraintBar item={item} chapterPositions={chapterPositions} maxChapter={maxChapter} />
                ) : (
                  <RequireMarker item={item as Extract<ConstraintTimelineItem, { kind: "require" }>} chapterPositions={chapterPositions} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {timeline.length === 0 && (
        <p style={{ color: "#6b7280", marginTop: 16 }}>No constraints to visualize.</p>
      )}
    </div>
  );
}

function ConstraintBar({
  item,
  chapterPositions,
  maxChapter,
}: {
  item: Extract<
    ConstraintTimelineItem,
    { kind: "forbid" | "never" | "prevent" | "cannot" }
  >;
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
