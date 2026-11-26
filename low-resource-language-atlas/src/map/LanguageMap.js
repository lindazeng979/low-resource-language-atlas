/**
 * Canvas world map of languages, with hover and click hit-testing.
 *
 * Ported from the July rebuild (ClaudeCodeTest/web/src/map.js) and generalised:
 * colour and size now come from a "layer" function so the same map can show
 * documentation, endangerment, speakers, NLP resource class or tool coverage.
 *
 * Two stacked canvases: land is redrawn on zoom and resize only; points are
 * redrawn on hover too. ~8,000 points is comfortable for canvas and would not
 * be for SVG or Leaflet markers, which is why the June prototype's Leaflet map
 * was replaced once the atlas grew from 45 languages to all of them.
 *
 * Hit-testing uses a quadtree in *base* projected coordinates, so zooming
 * never rebuilds it: the pointer is inverted through the current transform.
 *
 * Projection: Equal Earth, which is equal-area. When the subject is who is
 * represented, Mercator's inflation of the far north would mislead.
 */

import { geoEqualEarth, geoPath } from "d3-geo";
import { quadtree } from "d3-quadtree";
import { select } from "d3-selection";
import { zoom, zoomIdentity } from "d3-zoom";
import "d3-transition";

const HOVER_RADIUS_PX = 9;

/**
 * @typedef {Object} Style
 * @property {string} fill
 * @property {number} [r]      radius in CSS px at zoom 1
 * @property {number} [alpha]
 * @property {boolean} [ring]  draw as a hollow ring (missing data)
 * @property {number} [z]      draw order; higher draws later (on top)
 */

export class LanguageMap {
  constructor({ frame, baseCanvas, pointsCanvas, onHover, onSelect, interactive = true }) {
    this.frame = frame;
    this.baseCanvas = baseCanvas;
    this.pointsCanvas = pointsCanvas;
    this.onHover = onHover ?? (() => {});
    this.onSelect = onSelect ?? (() => {});
    this.interactive = interactive;

    this.projection = geoEqualEarth();
    this.path = geoPath(this.projection);
    this.transform = zoomIdentity;
    this.placed = [];
    this.tree = null;
    this.hovered = null;
    this.selected = null;
    this.languages = [];
    /** @type {(language: object) => Style|null} */
    this.styleFor = () => ({ fill: "#888" });
    this.theme = readTheme(frame);

    if (interactive) {
      this._installZoom();
      this._installPointer();
    }
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(frame);
  }

  destroy() {
    this.resizeObserver.disconnect();
  }

  setBasemap(basemap) {
    this.basemap = basemap;
    this.drawBase();
  }

  /** Replace the visible set and the styling function together. */
  setLayer(languages, styleFor) {
    this.languages = languages;
    this.styleFor = styleFor;
    if (this.hovered && !languages.includes(this.hovered.language)) {
      this.hovered = null;
      this.onHover(null, null);
    }
    this._place();
    this.drawPoints();
  }

  /** Re-read colours from CSS (call after a theme change). */
  refreshTheme() {
    this.theme = readTheme(this.frame);
    this.draw();
  }

  setSelected(language) {
    this.selected = language ? this.placed.find((p) => p.language === language) ?? null : null;
    this.drawPoints();
  }

  resize() {
    const width = this.frame.clientWidth;
    const height = this.frame.clientHeight;
    if (!width || !height) return;
    this.width = width;
    this.height = height;
    for (const canvas of [this.baseCanvas, this.pointsCanvas]) sizeCanvas(canvas, width, height);
    this.projection.fitExtent(
      [
        [6, 6],
        [width - 6, height - 6],
      ],
      { type: "Sphere" },
    );
    this._place();
    this.draw();
  }

  _place() {
    if (!this.width) return;
    const placed = [];
    for (const language of this.languages) {
      const point = this.projection([language.longitude, language.latitude]);
      if (!point) continue;
      const style = this.styleFor(language);
      if (!style) continue;
      placed.push({ language, x: point[0], y: point[1], style });
    }
    // Draw order: emphasised marks last, so they are never buried.
    placed.sort((a, b) => (a.style.z ?? 0) - (b.style.z ?? 0));
    this.placed = placed;
    this.tree = quadtree()
      .x((d) => d.x)
      .y((d) => d.y)
      .addAll(placed.filter((p) => !p.style.inert));
    if (this.selected) this.selected = placed.find((p) => p.language === this.selected.language) ?? null;
  }

  draw() {
    this.drawBase();
    this.drawPoints();
  }

  drawBase() {
    if (!this.width || !this.basemap) return;
    const context = prepare(this.baseCanvas, this.width, this.height);
    const { k, x, y } = this.transform;
    context.save();
    context.translate(x, y);
    context.scale(k, k);
    this.path.context(context);

    context.beginPath();
    this.path({ type: "Sphere" });
    context.fillStyle = this.theme.sea;
    context.fill();

    context.beginPath();
    this.path(this.basemap.land);
    context.fillStyle = this.theme.land;
    context.fill();

    context.beginPath();
    this.path(this.basemap.borders);
    context.lineWidth = 0.5 / k;
    context.strokeStyle = this.theme.landEdge;
    context.stroke();
    context.restore();
  }

  drawPoints() {
    if (!this.width) return;
    const context = prepare(this.pointsCanvas, this.width, this.height);
    const { k, x: tx, y: ty } = this.transform;
    // Hold radius roughly constant on screen: zooming should separate
    // crowded points, not inflate them into blobs.
    const zoomScale = Math.min(1.8, Math.max(0.8, Math.sqrt(k)));

    for (const item of this.placed) {
      const x = item.x * k + tx;
      const y = item.y * k + ty;
      if (x < -30 || y < -30 || x > this.width + 30 || y > this.height + 30) continue;
      const { fill, r = 2.1, alpha = 0.85, ring = false } = item.style;
      const radius = r * zoomScale;
      context.globalAlpha = alpha;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      if (ring) {
        context.lineWidth = 1;
        context.strokeStyle = fill;
        context.stroke();
      } else {
        context.fillStyle = fill;
        context.fill();
      }
    }
    context.globalAlpha = 1;

    for (const [item, emphasis] of [
      [this.selected, 2],
      [this.hovered, 1],
    ]) {
      if (!item) continue;
      const x = item.x * k + tx;
      const y = item.y * k + ty;
      const r = Math.max(5, (item.style.r ?? 2) * zoomScale + 2.5);
      // A ring in the ground colour separates the highlighted mark from the
      // dozen other languages it overlaps in dense regions.
      context.beginPath();
      context.arc(x, y, r + 2, 0, Math.PI * 2);
      context.fillStyle = this.theme.halo;
      context.fill();
      context.beginPath();
      context.arc(x, y, r, 0, Math.PI * 2);
      context.fillStyle = item.style.fill;
      context.fill();
      context.lineWidth = emphasis === 2 ? 2 : 1.5;
      context.strokeStyle = this.theme.ink;
      context.stroke();
    }
  }

  /** Smoothly frame a point at a given zoom; used by deep links and search. */
  flyTo(language, scale = 4) {
    if (!this.zoomBehaviour || !this.width) return;
    const point = this.projection([language.longitude, language.latitude]);
    if (!point) return;
    const t = zoomIdentity
      .translate(this.width / 2, this.height / 2)
      .scale(scale)
      .translate(-point[0], -point[1]);
    select(this.pointsCanvas).transition().duration(750).call(this.zoomBehaviour.transform, t);
  }

  resetZoom() {
    if (!this.zoomBehaviour) return;
    select(this.pointsCanvas).transition().duration(450).call(this.zoomBehaviour.transform, zoomIdentity);
  }

  zoomBy(factor) {
    if (!this.zoomBehaviour) return;
    select(this.pointsCanvas).transition().duration(250).call(this.zoomBehaviour.scaleBy, factor);
  }

  _installZoom() {
    this.zoomBehaviour = zoom()
      .scaleExtent([1, 40])
      .filter((event) => {
        // Let the page scroll past the map: zoom with ctrl/⌘ + wheel (or a
        // trackpad pinch, which arrives as ctrl + wheel), and on touch screens
        // pan or pinch with two fingers so one finger still scrolls the page.
        if (event.type === "wheel") return event.ctrlKey || event.metaKey;
        if (event.type.startsWith("touch")) return event.touches.length >= 2;
        return !event.button;
      })
      .on("zoom", (event) => {
        this.transform = event.transform;
        this._clearHover();
        this.draw();
      });
    select(this.pointsCanvas).call(this.zoomBehaviour).on("dblclick.zoom", null);
  }

  _installPointer() {
    const locate = (event) => {
      const rect = this.pointsCanvas.getBoundingClientRect();
      return this.findAt(event.clientX - rect.left, event.clientY - rect.top);
    };
    this.pointsCanvas.addEventListener("pointermove", (event) => {
      const found = locate(event);
      if (found === this.hovered) return;
      this.hovered = found;
      this.pointsCanvas.style.cursor = found ? "pointer" : "grab";
      this.drawPoints();
      this.onHover(found?.language ?? null, found ? this.toScreen(found) : null);
    });
    this.pointsCanvas.addEventListener("pointerleave", () => this._clearHover());
    let down = null;
    this.pointsCanvas.addEventListener("pointerdown", (event) => {
      down = { x: event.clientX, y: event.clientY };
    });
    this.pointsCanvas.addEventListener("click", (event) => {
      // A drag that pans the map is not a click on a language.
      if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) return;
      const found = locate(event);
      this.onSelect(found?.language ?? null);
    });
  }

  toScreen(item) {
    return { x: item.x * this.transform.k + this.transform.x, y: item.y * this.transform.k + this.transform.y };
  }

  _clearHover() {
    if (!this.hovered) return;
    this.hovered = null;
    this.drawPoints();
    this.onHover(null, null);
  }

  findAt(screenX, screenY) {
    if (!this.tree) return null;
    const { k, x: tx, y: ty } = this.transform;
    return this.tree.find((screenX - tx) / k, (screenY - ty) / k, HOVER_RADIUS_PX / k) ?? null;
  }
}

function readTheme(element) {
  const styles = getComputedStyle(element);
  const read = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
  return {
    sea: read("--map-sea", "#0b1220"),
    land: read("--map-land", "#1a2333"),
    landEdge: read("--map-edge", "#2a3446"),
    halo: read("--map-halo", "#0b1220"),
    ink: read("--map-ink", "#ffffff"),
  };
}

function sizeCanvas(canvas, width, height) {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

function prepare(canvas, width, height) {
  const ratio = window.devicePixelRatio || 1;
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  return context;
}
