import { useEffect, useRef, useState } from 'react';
import type { RoomPoint } from './stream-worker';

interface Transform {
  scale: number;
  tx: number;
  ty: number;
}

/** Fallback dot color for a room whose environment has no entry in `envColors`. */
const DEFAULT_DOT = '#818cf8';

/**
 * Canvas scatter-plot of one area/Z-level's rooms. Deliberately minimal
 * (dots, pan, zoom) — the point is to show that a render can be driven off
 * the lightweight {@link RoomPoint} index `streamRooms` produces, without
 * ever materialising the full room graph (custom lines, userData, …). Dots
 * are colored by environment using the same palette `readerExport` uses.
 */
export default function RoomMiniMap({
  rooms,
  envColors,
}: {
  rooms: RoomPoint[];
  envColors: Record<number, [number, number, number]>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [transform, setTransform] = useState<Transform | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  // Fit the view to the room bounding box whenever the room set changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || rooms.length === 0) {
      setTransform(null);
      return;
    }
    // Reduce, not `Math.min(...xs)` — spreading tens of thousands of room
    // coordinates as call arguments overflows the engine's argument/stack
    // limit on large areas.
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const room of rooms) {
      if (room.x < minX) minX = room.x;
      if (room.x > maxX) maxX = room.x;
      if (room.y < minY) minY = room.y;
      if (room.y > maxY) maxY = room.y;
    }
    const w = canvas.clientWidth || 640;
    const h = canvas.clientHeight || 420;
    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    const scale = Math.min((w - 40) / spanX, (h - 40) / spanY, 40);
    setTransform({
      scale,
      tx: w / 2 - ((minX + maxX) / 2) * scale,
      ty: h / 2 + ((minY + maxY) / 2) * scale, // Mudlet y grows north (up); canvas y grows down.
    });
  }, [rooms]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !transform) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 640;
    const h = canvas.clientHeight || 420;
    canvas.width = w * dpr;
    canvas.height = h * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, w, h);

    // Resolve each env's CSS color once, not per room.
    const cssByEnv = new Map<number, string>();
    const colorFor = (env: number): string => {
      let css = cssByEnv.get(env);
      if (css === undefined) {
        const rgb = envColors[env];
        css = rgb ? `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})` : DEFAULT_DOT;
        cssByEnv.set(env, css);
      }
      return css;
    };

    const dot = Math.max(1.5, Math.min(4, transform.scale * 0.35));
    for (const room of rooms) {
      const px = room.x * transform.scale + transform.tx;
      const py = -room.y * transform.scale + transform.ty;
      if (px < -dot || py < -dot || px > w + dot || py > h + dot) continue;
      ctx.fillStyle = colorFor(room.env);
      ctx.fillRect(px - dot / 2, py - dot / 2, dot, dot);
    }
  }, [rooms, transform, envColors]);

  // React registers `onWheel` as a passive listener, so `e.preventDefault()`
  // there is silently ignored and the page scrolls along with the zoom.
  // A native listener with `{ passive: false }` is the only way to actually
  // suppress the page scroll.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      // Re-derive tx/ty so the world point under the cursor stays under the
      // cursor. Scaling in place while leaving tx/ty fixed zooms around room
      // coordinate (0,0) instead — every tick then drags the map toward that
      // fixed point rather than zooming where the user is looking.
      const cx = e.offsetX;
      const cy = e.offsetY;
      setTransform((t) => {
        if (!t) return t;
        const newScale = Math.min(Math.max(t.scale * factor, 0.05), 200);
        const worldX = (cx - t.tx) / t.scale;
        const worldY = (t.ty - cy) / t.scale;
        return {
          scale: newScale,
          tx: cx - worldX * newScale,
          ty: cy + worldY * newScale,
        };
      });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="h-[420px] w-full cursor-grab rounded-xl border border-slate-800 bg-slate-950 active:cursor-grabbing"
      onMouseDown={(e) => {
        dragRef.current = { x: e.clientX, y: e.clientY };
      }}
      onMouseMove={(e) => {
        const drag = dragRef.current;
        if (!drag) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        dragRef.current = { x: e.clientX, y: e.clientY };
        setTransform((t) => (t ? { ...t, tx: t.tx + dx, ty: t.ty + dy } : t));
      }}
      onMouseUp={() => {
        dragRef.current = null;
      }}
      onMouseLeave={() => {
        dragRef.current = null;
      }}
    />
  );
}
