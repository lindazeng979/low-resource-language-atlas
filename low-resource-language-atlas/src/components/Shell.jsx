import { useEffect, useState } from "react";

/**
 * Top bar, chapter rail and keyboard navigation.
 *
 * "Present" without slides: every chapter is an anchor, so a talk can jump
 * straight to one (…#speakers-vs-data), and ←/→ (or j/k, PageUp/PageDown)
 * step between chapters when focus is not in a form field.
 */
export function useChapters(chapters) {
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    const els = chapters.map((c) => document.getElementById(c.id)).filter(Boolean);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setCurrent(entry.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [chapters]);

  useEffect(() => {
    function onKey(event) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = document.activeElement?.tagName;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(tag)) return;
      const forward = ["ArrowRight", "j", "PageDown"].includes(event.key);
      const back = ["ArrowLeft", "k", "PageUp"].includes(event.key);
      if (!forward && !back) return;
      const ids = chapters.map((c) => c.id);
      const tops = ids.map((id) => document.getElementById(id)?.getBoundingClientRect().top ?? 0);
      // The chapter whose top is nearest above the reading line is "here".
      let index = tops.findLastIndex((top) => top <= 80);
      if (index < 0) index = -1;
      const next = forward ? index + 1 : Math.max(0, tops[index] < -10 ? index : index - 1);
      if (next < 0 || next >= ids.length) return;
      event.preventDefault();
      document.getElementById(ids[next])?.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", `${location.pathname}${location.search}#${ids[next]}`);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chapters]);

  return current;
}

export function TopBar({ chapters, current }) {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > window.innerHeight * 0.85);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const nightNow = chapters.find((c) => c.id === current)?.night;
  return (
    <header className="topbar" data-solid={solid ? "" : undefined} data-night={nightNow ? "" : undefined}>
      <div className="wrap">
        <a className="brand" href="#top">
          <Mark />
          Low-Resource Language Atlas
        </a>
        <nav aria-label="Chapters">
          {chapters
            .filter((c) => c.nav)
            .map((c) => (
              <a key={c.id} href={`#${c.id}`} aria-current={current === c.id ? "true" : undefined} className={c.keep ? "nav-keep" : undefined}>
                {c.nav}
              </a>
            ))}
        </nav>
      </div>
    </header>
  );
}

export function Rail({ chapters, current }) {
  const night = chapters.find((c) => c.id === current)?.night;
  return (
    <nav className="rail" aria-label="Jump to chapter" data-night={night ? "" : undefined}>
      {chapters.map((c, i) => (
        <a key={c.id} href={`#${c.id}`} aria-current={current === c.id ? "true" : undefined}>
          <span>
            {String(i).padStart(2, "0")} · {c.title}
          </span>
        </a>
      ))}
    </nav>
  );
}

export function Mark() {
  // A few lit points among many dark ones: the atlas in one glyph.
  const dots = [
    [5, 7, 0], [11, 5, 0], [17, 8, 1], [8, 12, 0], [14, 13, 0], [19, 15, 0],
    [6, 17, 1], [12, 18, 0], [16, 19, 0], [10, 9, 0], [3, 12, 0],
  ];
  return (
    <svg className="brand__mark" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="10.25" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.2" />
      {dots.map(([x, y, lit], i) => (
        <circle key={i} cx={x} cy={y} r={lit ? 1.9 : 1.2} fill={lit ? "#f5b942" : "currentColor"} fillOpacity={lit ? 1 : 0.55} />
      ))}
    </svg>
  );
}

export function Chapter({ id, num, title, lede, children, tone, takeaway }) {
  return (
    <section id={id} className={`chapter${tone ? ` chapter--${tone}` : ""}`} aria-labelledby={`${id}-h`}>
      <div className="wrap">
        <div className="chapter__head">
          <span className="chapter__num">{num}</span>
          <h2 id={`${id}-h`}>{title}</h2>
          {lede && <p className="lede">{lede}</p>}
        </div>
        {children}
        {takeaway && (
          <p className="takeaway">
            <span className="takeaway__label">Say this</span>
            <span>{takeaway}</span>
          </p>
        )}
      </div>
    </section>
  );
}

export function Cite({ children, href }) {
  return (
    <p className="cite">
      Source: {href ? <a href={href}>{children}</a> : children}
    </p>
  );
}
