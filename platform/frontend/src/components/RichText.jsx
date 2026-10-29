// "Markdown-lite" rendering of LLM text: headings, lists, **bold**, *italic*.
// React elements only (no injected HTML).

function inline(text, keyBase) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k}>{tok.slice(1, -1)}</code>);
    else out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function RichText({ text, className = "" }) {
  if (!text) return null;
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks = [];
  let list = null;
  let para = [];

  const flushPara = () => {
    if (para.length) blocks.push({ type: "p", lines: para });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const ordered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    // "### Title" or a line entirely in bold ("**Synthesis**", "**Synthesis:**") = section title
    const heading = line.match(/^\s*#{1,6}\s+(.*)$/) || line.match(/^\s*\*\*([^*]{1,60}?)\s*:?\*\*\s*:?\s*$/);
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if (heading) {
      flushPara();
      flushList();
      blocks.push({ type: "h", text: heading[1] });
    } else if (bullet || ordered) {
      flushPara();
      const type = bullet ? "ul" : "ol";
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push(bullet ? bullet[1] : ordered[2]);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();

  return (
    <div className={`rich ${className}`}>
      {blocks.map((b, i) => {
        if (b.type === "h") return <h4 key={i}>{inline(b.text, i)}</h4>;
        if (b.type === "ul") return <ul key={i}>{b.items.map((t, j) => <li key={j}>{inline(t, `${i}-${j}`)}</li>)}</ul>;
        if (b.type === "ol") return <ol key={i}>{b.items.map((t, j) => <li key={j}>{inline(t, `${i}-${j}`)}</li>)}</ol>;
        return <p key={i}>{b.lines.map((l, j) => <span key={j}>{j > 0 && <br />}{inline(l, `${i}-${j}`)}</span>)}</p>;
      })}
    </div>
  );
}
