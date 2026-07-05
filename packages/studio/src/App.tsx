import { helloCore } from "@yanstory/core";

export default function App() {
  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>YanStory Studio</h1>
      <p>{helloCore()}</p>
    </div>
  );
}
