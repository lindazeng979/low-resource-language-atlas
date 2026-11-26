import { useMemo, useRef, useState } from "react";
import { scaleLinear, scaleLog } from "d3-scale";
import { compact, fmt } from "../data/atlas.js";

/* Shared bits ------------------------------------------------------------ */

function useTip() {
  const [tip, setTip] = useState(null);
  const ref = useRef(null);
  const show = (event, content) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    setTip({ x: event.clientX - box.left, y: event.clientY - box.top, content });
  };
  const node = tip ? (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>
      {tip.content}
    </div>
  ) : null;
  return { ref, show, hide: () => setTip(null), node };
}

function DataTable({ columns, rows, caption }) {
  return (
    <details className="table-toggle">
      <summary>Show as a table</summary>
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.num ? "num" : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} className={c.num ? "num" : undefined}>
                  {c.format ? c.format(r[c.key]) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/* Horizontal bars: one series, one colour, value labels at the bar end --- */

export function BarList({ rows, total, color = "var(--accent)", caption, unit = "languages", highlight }) {
  const tip = useTip();
  const max = total ?? Math.max(...rows.map((r) => r.value));
  return (
    <div className="chart barlist" ref={tip.ref}>
      <ul className="barlist__rows">
        {rows.map((r) => (
          <li
            key={r.label}
            onPointerMove={(e) =>
              tip.show(
                e,
                <>
                  <b>{r.label}</b>
                  {fmt.format(r.value)} {unit}
                  {total ? ` · ${((100 * r.value) / total).toFixed(1)}%` : ""}
                </>,
              )
            }
            onPointerLeave={tip.hide}
            data-hl={highlight === r.label ? "" : undefined}
          >
            <span className="barlist__label">{r.label}</span>
            <span className="barlist__track">
              <span className="barlist__bar" style={{ width: `${Math.max(0.4, (100 * r.value) / max)}%`, background: r.color ?? color }} />
            </span>
            <span className="barlist__value">
              {fmt.format(r.value)}
              {total ? <em> {((100 * r.value) / total).toFixed(r.value / total < 0.1 ? 1 : 0)}%</em> : null}
            </span>
          </li>
        ))}
      </ul>
      {tip.node}
      <DataTable
        caption={caption}
        columns={[
          { key: "label", label: "Category" },
          { key: "value", label: unit, num: true, format: (v) => fmt.format(v) },
        ]}
        rows={rows}
      />
    </div>
  );
}

/* Speakers vs data: log–log scatter, named outliers labelled ------------ */

export function SpeakersVsData({ languages, labelled }) {
  const tip = useTip();
  const W = 960;
  const H = 520;
  const m = { t: 16, r: 24, b: 56, l: 64 };
  const { points, noWiki } = useMemo(() => {
    const pts = [];
    const none = [];
    for (const l of languages) {
      if (!l.speakers || l.speakers < 1000 || l.endangerment === 6) continue;
      if (l.wikipedia) pts.push(l);
      else none.push(l);
    }
    return { points: pts, noWiki: none };
  }, [languages]);

  const x = scaleLog().domain([1e3, 1.5e9]).range([m.l, W - m.r]).clamp(true);
  const y = scaleLog().domain([1, 8e6]).range([H - m.b - 40, m.t]).clamp(true);
  const stripY = H - m.b - 8;
  const labelSet = new Set(labelled.map((d) => d.iso));
  const label = (l) => labelled.find((d) => d.iso === l.iso639_3);

  const xticks = [1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9];
  const yticks = [1, 100, 1e4, 1e6];

  const tipFor = (l) => (
    <>
      <b>{l.name}</b>
      {fmt.format(l.speakers)} speakers · {l.wikipedia ? `${fmt.format(l.wikipedia.articles)} Wikipedia articles` : "no Wikipedia"}
    </>
  );

  return (
    <div className="chart" ref={tip.ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Scatter plot of speakers against Wikipedia articles per language, log scales">
        <g className="grid">
          {xticks.map((t) => (
            <line key={t} x1={x(t)} x2={x(t)} y1={m.t} y2={stripY + 8} />
          ))}
          {yticks.map((t) => (
            <line key={t} x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        <g className="axis">
          {xticks.map((t) => (
            <text key={t} x={x(t)} y={H - m.b + 28} textAnchor="middle">
              {compact.format(t)}
            </text>
          ))}
          {yticks.map((t) => (
            <text key={t} x={m.l - 10} y={y(t) + 4} textAnchor="end">
              {compact.format(t)}
            </text>
          ))}
          <text x={(m.l + W - m.r) / 2} y={H - 8} textAnchor="middle">
            Speakers (Wikidata, log scale)
          </text>
          <text transform={`translate(16 ${(m.t + stripY) / 2}) rotate(-90)`} textAnchor="middle">
            Wikipedia articles (log scale)
          </text>
          <text x={m.l - 10} y={stripY + 4} textAnchor="end">
            none
          </text>
        </g>
        <g>
          {noWiki.map((l) => (
            <circle
              key={l.glottocode}
              cx={x(l.speakers)}
              cy={stripY + ((hash(l.glottocode) % 13) - 6)}
              r={labelSet.has(l.iso639_3) ? 5 : 2.4}
              className="dot dot--none"
              data-hl={labelSet.has(l.iso639_3) ? "" : undefined}
              onPointerMove={(e) => tip.show(e, tipFor(l))}
              onPointerLeave={tip.hide}
            />
          ))}
          {[...points]
            .sort((a, b) => labelSet.has(a.iso639_3) - labelSet.has(b.iso639_3))
            .map((l) => (
              <circle
                key={l.glottocode}
                cx={x(l.speakers)}
                cy={y(l.wikipedia.articles)}
                r={labelSet.has(l.iso639_3) ? 5.5 : 3}
                className="dot"
                data-hl={labelSet.has(l.iso639_3) ? "" : undefined}
                onPointerMove={(e) => tip.show(e, tipFor(l))}
                onPointerLeave={tip.hide}
              />
            ))}
        </g>
        <g className="labels">
          {[...points, ...noWiki]
            .filter((l) => labelSet.has(l.iso639_3))
            .map((l) => {
              const d = label(l);
              const cx = x(l.speakers);
              const cy = l.wikipedia ? y(l.wikipedia.articles) : stripY;
              return (
                <text key={l.glottocode} x={cx + (d.dx ?? 8)} y={cy + (d.dy ?? -8)} textAnchor={d.anchor ?? "start"} className="dot-label">
                  {d.name ?? l.name}
                </text>
              );
            })}
        </g>
      </svg>
      {tip.node}
      <DataTable
        caption="Named languages: speakers and Wikipedia articles"
        columns={[
          { key: "name", label: "Language" },
          { key: "speakers", label: "Speakers", num: true, format: (v) => fmt.format(v) },
          { key: "articles", label: "Wikipedia articles", num: true, format: (v) => (v ? fmt.format(v) : "none") },
        ]}
        rows={[...points, ...noWiki]
          .filter((l) => labelSet.has(l.iso639_3))
          .sort((a, b) => b.speakers - a.speakers)
          .map((l) => ({ name: l.name, speakers: l.speakers, articles: l.wikipedia?.articles ?? 0 }))}
      />
    </div>
  );
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/* The long tail: languages ranked by speakers -------------------------- */

export function LongTail({ languages }) {
  const tip = useTip();
  const W = 960;
  const H = 360;
  const m = { t: 20, r: 20, b: 44, l: 64 };
  const ranked = useMemo(
    () => languages.filter((l) => l.speakers && l.endangerment !== 6).sort((a, b) => b.speakers - a.speakers),
    [languages],
  );
  const total = ranked.reduce((s, l) => s + l.speakers, 0);
  let acc = 0;
  let half = 0;
  for (let i = 0; i < ranked.length; i++) {
    acc += ranked[i].speakers;
    if (acc >= total / 2) {
      half = i + 1;
      break;
    }
  }
  const under10k = ranked.filter((l) => l.speakers < 10_000).length;
  const x = scaleLinear().domain([0, ranked.length]).range([m.l, W - m.r]);
  const y = scaleLog().domain([1, 2e9]).range([H - m.b, m.t]).clamp(true);
  const step = Math.max(1, Math.floor(ranked.length / 900));
  const path = ranked
    .filter((_, i) => i % step === 0 || i < 60)
    .map((l) => `${x(ranked.indexOf(l)).toFixed(1)},${y(l.speakers).toFixed(1)}`)
    .join(" L");

  return (
    <div className="chart" ref={tip.ref}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Languages ranked by speakers. The top ${half} account for half of all speakers counted.`}
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const i = Math.round(x.invert(((e.clientX - box.left) / box.width) * W));
          const l = ranked[Math.max(0, Math.min(ranked.length - 1, i))];
          if (l) tip.show(e, <><b>#{fmt.format(i + 1)} · {l.name}</b>{fmt.format(l.speakers)} speakers</>);
        }}
        onPointerLeave={tip.hide}
      >
        <g className="grid">
          {[1e2, 1e4, 1e6, 1e8].map((t) => (
            <line key={t} x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        <rect x={m.l} y={m.t} width={x(half) - m.l} height={H - m.b - m.t} className="half-band" />
        <path d={`M${path}`} className="tail-line" />
        <g className="axis">
          {[1e2, 1e4, 1e6, 1e8].map((t) => (
            <text key={t} x={m.l - 10} y={y(t) + 4} textAnchor="end">
              {compact.format(t)}
            </text>
          ))}
          {[1, 1000, 2000, 3000, 4000].filter((t) => t <= ranked.length).map((t) => (
            <text key={t} x={x(t)} y={H - m.b + 22} textAnchor="middle">
              {t === 1 ? "#1" : `#${fmt.format(t)}`}
            </text>
          ))}
          <text x={(m.l + W - m.r) / 2} y={H - 4} textAnchor="middle">
            Languages ranked by number of speakers
          </text>
        </g>
        <text x={x(half) + 10} y={m.t + 18} className="annot">
          The first {half} languages: half of all speakers counted
        </text>
      </svg>
      {tip.node}
      <p className="chart-sub" style={{ marginTop: 10 }}>
        Of the {fmt.format(ranked.length)} living languages with a Wikidata speaker figure, {fmt.format(under10k)} ({Math.round((100 * under10k) / ranked.length)}%) have fewer than 10,000
        speakers.
      </p>
      <DataTable
        caption="Top 20 languages by speakers"
        columns={[
          { key: "rank", label: "Rank", num: true },
          { key: "name", label: "Language" },
          { key: "speakers", label: "Speakers", num: true, format: (v) => fmt.format(v) },
        ]}
        rows={ranked.slice(0, 20).map((l, i) => ({ rank: i + 1, name: l.name, speakers: l.speakers }))}
      />
    </div>
  );
}

/* Joshi classes: languages per class vs their share of NLP data -------- */

export function ClassLadder({ classes }) {
  const tip = useTip();
  const max = Math.max(...classes.map((c) => c.languages));
  const x = scaleLog().domain([1, max]).range([4, 100]);
  return (
    <div className="chart ladder" ref={tip.ref}>
      <ol className="ladder__rows">
        {[...classes].reverse().map((c) => (
          <li
            key={c.cls}
            onPointerMove={(e) =>
              tip.show(
                e,
                <>
                  <b>
                    Class {c.cls} · {c.name}
                  </b>
                  {fmt.format(c.languages)} languages{c.speakersShare != null ? ` · ${c.speakersShare}% of speakers` : ""}
                </>,
              )
            }
            onPointerLeave={tip.hide}
          >
            <span className="ladder__cls" style={{ "--c": c.color }}>
              {c.cls}
            </span>
            <span className="ladder__name">
              <strong>{c.name}</strong>
              <span>{c.examples}</span>
            </span>
            <span className="ladder__track">
              <span className="ladder__bar" style={{ width: `${x(Math.max(1, c.languages))}%`, background: c.color }} />
            </span>
            <span className="ladder__n">{fmt.format(c.languages)}</span>
          </li>
        ))}
      </ol>
      {tip.node}
      <DataTable
        caption="Joshi et al. 2020 classes"
        columns={[
          { key: "cls", label: "Class", num: true },
          { key: "name", label: "Name" },
          { key: "languages", label: "Languages", num: true, format: (v) => fmt.format(v) },
          { key: "examples", label: "Examples" },
        ]}
        rows={classes}
      />
    </div>
  );
}

/* Stacked bar: part-to-whole, ≤ 6 segments ---------------------------- */

export function StackBar({ segments, total, caption }) {
  const tip = useTip();
  return (
    <div className="chart" ref={tip.ref}>
      <div className="stack" role="img" aria-label={caption}>
        {segments.map((s) => (
          <span
            key={s.label}
            className="stack__seg"
            style={{ flexGrow: s.value, background: s.color }}
            data-ring={s.ring ? "" : undefined}
            onPointerMove={(e) =>
              tip.show(
                e,
                <>
                  <b>{s.label}</b>
                  {fmt.format(s.value)} languages · {((100 * s.value) / total).toFixed(1)}%
                </>,
              )
            }
            onPointerLeave={tip.hide}
          />
        ))}
      </div>
      <ul className="stack__legend">
        {segments.map((s) => (
          <li key={s.label}>
            <span className="swatch" data-ring={s.ring ? "" : undefined} style={{ "--swatch": s.color }} />
            <span>{s.label}</span>
            <b>{fmt.format(s.value)}</b>
            <em>{((100 * s.value) / total).toFixed(1)}%</em>
          </li>
        ))}
      </ul>
      {tip.node}
      <DataTable
        caption={caption}
        columns={[
          { key: "label", label: "Status" },
          { key: "value", label: "Languages", num: true, format: (v) => fmt.format(v) },
        ]}
        rows={segments}
      />
    </div>
  );
}
