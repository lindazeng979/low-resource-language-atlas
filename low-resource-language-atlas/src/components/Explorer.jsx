import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AtlasMap from "./AtlasMap.jsx";
import LanguagePanel from "./LanguagePanel.jsx";
import { countryName, fmt } from "../data/atlas.js";
import { LAYERS } from "../map/layers.js";

const LAYER_ORDER = ["coverage", "tools", "resourceClass", "endangerment", "documentation", "speakers", "littauer"];

/**
 * The full explorer. Keeps the June prototype's family and country filters
 * and side panel, and adds layers, search and shareable links (?lang=…).
 */
export default function Explorer({ atlas }) {
  const mapRef = useRef(null);
  const [layerId, setLayerId] = useState(() => new URLSearchParams(location.search).get("layer") ?? "tools");
  const [family, setFamily] = useState("All");
  const [country, setCountry] = useState("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => {
    const code = new URLSearchParams(location.search).get("lang");
    return code ? atlas.byGlottocode.get(code) ?? null : null;
  });

  const mappable = useMemo(() => atlas.languages.filter((l) => l.latitude != null), [atlas]);

  const families = useMemo(() => {
    const counts = new Map();
    for (const l of mappable) if (l.familyName) counts.set(l.familyName, (counts.get(l.familyName) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [mappable]);

  const countries = useMemo(() => {
    const set = new Set(mappable.flatMap((l) => l.countries));
    return [...set].map((code) => [code, countryName(code)]).sort((a, b) => a[1].localeCompare(b[1]));
  }, [mappable]);

  const visible = useMemo(
    () =>
      mappable.filter(
        (l) => (family === "All" || l.familyName === family) && (country === "All" || l.countries.includes(country)),
      ),
    [mappable, family, country],
  );

  const layer = LAYERS[layerId] ?? LAYERS.tools;
  const styleFor = useCallback((l) => layer.style(l), [layer]);

  const select = useCallback(
    (language) => {
      setSelected(language);
      const params = new URLSearchParams(location.search);
      if (language) params.set("lang", language.glottocode);
      else params.delete("lang");
      const qs = params.toString();
      history.replaceState(null, "", `${location.pathname}${qs ? `?${qs}` : ""}#explore`);
      if (language && language.latitude != null) mapRef.current?.flyTo(language, 5);
    },
    [],
  );

  // Deep link on first load: frame the language once the map has a size.
  useEffect(() => {
    if (selected?.latitude != null) {
      const t = setTimeout(() => mapRef.current?.flyTo(selected, 5), 400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const exact = [];
    const starts = [];
    const contains = [];
    for (const l of atlas.languages) {
      const name = l.name.toLowerCase();
      if (l.iso639_3 === q || l.glottocode === q || name === q) exact.push(l);
      else if (name.startsWith(q)) starts.push(l);
      else if (name.includes(q)) contains.push(l);
    }
    // Within each tier, the most widely spoken first: "quechua" should offer
    // the large Quechua varieties before the small ones.
    const bySpeakers = (a, b) => (b.speakers ?? 0) - (a.speakers ?? 0);
    return [...exact.sort(bySpeakers), ...starts.sort(bySpeakers), ...contains.sort(bySpeakers)].slice(0, 8);
  }, [query, atlas]);

  const counts = useMemo(() => {
    const total = visible.length;
    return { total };
  }, [visible]);

  return (
    <div className="explorer">
      <div className="explorer__bar">
        <div className="layer-tabs" role="tablist" aria-label="Map layer">
          {LAYER_ORDER.map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={id === layerId}
              className="layer-tab"
              onClick={() => setLayerId(id)}
            >
              {LAYERS[id].label}
            </button>
          ))}
        </div>
        <div className="explorer__filters">
          <div className="search">
            <label htmlFor="lang-search" className="sr-only">
              Find a language
            </label>
            <input
              id="lang-search"
              type="search"
              placeholder="Find a language, ISO code or Glottocode"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            {matches.length > 0 && (
              <ul className="search__results" role="listbox">
                {matches.map((l) => (
                  <li key={l.glottocode}>
                    <button
                      onClick={() => {
                        select(l);
                        setQuery("");
                      }}
                    >
                      <strong>{l.name}</strong>
                      <span>
                        {l.iso639_3 ?? l.glottocode}
                        {l.countries[0] ? ` · ${countryName(l.countries[0])}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <label className="select">
            <span>Family</span>
            <select value={family} onChange={(e) => setFamily(e.target.value)}>
              <option value="All">All families</option>
              {families.map(([name, n]) => (
                <option key={name} value={name}>
                  {name} ({fmt.format(n)})
                </option>
              ))}
            </select>
          </label>
          <label className="select">
            <span>Country</span>
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="All">All countries</option>
              {countries.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="explorer__stage" data-panel={selected ? "" : undefined}>
        <div className="explorer__map">
          <AtlasMap
            languages={visible}
            styleFor={styleFor}
            selected={selected}
            onSelect={select}
            mapRef={mapRef}
            label={`World map of ${fmt.format(visible.length)} languages, coloured by ${layer.label.toLowerCase()}`}
          />
          <div className="map-legend">
            <p className="map-legend__blurb">{layer.blurb}</p>
            <ul>
              {layer.legend().map((item) => (
                <li key={item.label}>
                  <span className="swatch" data-ring={item.ring ? "" : undefined} style={{ "--swatch": item.swatch }} />
                  {item.label}
                </li>
              ))}
            </ul>
            <p className="map-legend__count">
              {fmt.format(counts.total)} languages shown · drag to pan · ⌘/Ctrl + scroll, pinch, or two fingers to zoom
            </p>
          </div>
          <div className="map-zoom">
            <button className="icon-btn" onClick={() => mapRef.current?.zoomBy(1.8)} aria-label="Zoom in">
              +
            </button>
            <button className="icon-btn" onClick={() => mapRef.current?.zoomBy(1 / 1.8)} aria-label="Zoom out">
              −
            </button>
            <button className="icon-btn" onClick={() => mapRef.current?.resetZoom()} aria-label="Reset view">
              ⟲
            </button>
          </div>
        </div>
        {selected && <LanguagePanel atlas={atlas} language={selected} onClose={() => select(null)} />}
      </div>
    </div>
  );
}
