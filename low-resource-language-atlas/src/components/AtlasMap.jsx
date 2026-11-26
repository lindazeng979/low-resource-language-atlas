import { useEffect, useRef, useState } from "react";
import { feature, mesh } from "topojson-client";
import world from "world-atlas/countries-110m.json";
import { LanguageMap } from "../map/LanguageMap.js";
import { countryName, fmt } from "../data/atlas.js";

const basemap = {
  land: feature(world, world.objects.countries),
  borders: mesh(world, world.objects.countries, (a, b) => a !== b),
};

/**
 * React wrapper around the canvas map. `languages` + `styleFor` define what is
 * drawn; changing either redraws without rebuilding the map.
 */
export default function AtlasMap({
  languages,
  styleFor,
  selected = null,
  onSelect,
  interactive = true,
  className = "",
  label,
  mapRef,
  tooltip = true,
}) {
  const frame = useRef(null);
  const base = useRef(null);
  const points = useRef(null);
  const map = useRef(null);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const instance = new LanguageMap({
      frame: frame.current,
      baseCanvas: base.current,
      pointsCanvas: points.current,
      interactive,
      onHover: (language, at) => setHover(language ? { language, at } : null),
      onSelect: (language) => onSelectRef.current?.(language),
    });
    instance.setBasemap(basemap);
    map.current = instance;
    if (mapRef) mapRef.current = instance;
    return () => instance.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    map.current?.setLayer(languages, styleFor);
  }, [languages, styleFor]);

  useEffect(() => {
    map.current?.setSelected(selected);
  }, [selected, languages, styleFor]);

  return (
    <div className={`atlas-map ${className}`} ref={frame} role="img" aria-label={label}>
      <canvas ref={base} className="atlas-map__base" aria-hidden="true" />
      <canvas ref={points} className="atlas-map__points" aria-hidden="true" />
      {tooltip && hover && (
        <div
          className="map-tip"
          style={{
            left: hover.at.x,
            top: hover.at.y,
          }}
          data-flip={hover.at.x > (frame.current?.clientWidth ?? 0) - 240 ? "" : undefined}
        >
          <strong>{hover.language.name}</strong>
          <span>
            {[hover.language.familyName ?? (hover.language.isIsolate ? "Isolate" : null), hover.language.countries.slice(0, 2).map(countryName).join(", ")]
              .filter(Boolean)
              .join(" — ")}
          </span>
          {hover.language.speakers ? <span>{fmt.format(hover.language.speakers)} speakers</span> : null}
          {interactive && <em>Click for details</em>}
        </div>
      )}
    </div>
  );
}
