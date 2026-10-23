import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloseOutlined, ExpandOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import { useLocale } from '../../../context/LocaleContext';

const MAX_ZOOM = 5;
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

/** Where the picture rests: centred, as large as fits, leaving room for the caption. */
function restRect(aspect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const phone = vw < 576;
  const maxW = vw - (phone ? 24 : 120);
  const maxH = vh - (phone ? 210 : 210);
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  return { left: (vw - w) / 2, top: Math.max(phone ? 78 : 72, (vh - h) / 2 - (phone ? 30 : 24)), width: w, height: h };
}

/**
 * A portrait, large: it grows out of the avatar it was opened from, the
 * page behind dims and blurs. Wheel, pinch or double tap zoom in; dragging
 * moves a zoomed picture; a swipe down (or Esc, or a tap outside) puts it back.
 *
 * `from`: the avatar element (its place is where the picture flies from and back to).
 */
export default function PhotoViewer({ open, src, thumb, from, title, subtitle, note, onClose }) {
  const { t } = useLocale();
  const [phase, setPhase] = useState('closed'); // closed → opening → open → closing
  const [aspect, setAspect] = useState(1);
  const aspectRef = useRef(1);
  aspectRef.current = aspect;
  const [fullReady, setFullReady] = useState(false);
  const [zoom, setZoom] = useState({ s: 1, x: 0, y: 0 });
  const [drop, setDrop] = useState(0); // swipe-down distance
  const [rect, setRect] = useState(null);
  const [touching, setTouching] = useState(false);
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const frameRef = useRef(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const originRect = useCallback(() => {
    const box = from?.getBoundingClientRect?.();
    if (!box || !box.width) return null;
    return { left: box.left, top: box.top, width: box.width, height: box.height };
  }, [from]);

  // Open: start on the avatar, then fly to the resting place.
  useLayoutEffect(() => {
    if (!open) return undefined;
    setFullReady(false);
    setAspect(1);
    aspectRef.current = 1;
    setZoom({ s: 1, x: 0, y: 0 });
    setDrop(0);
    const start = originRect();
    setRect(start || { ...restRect(1), scaleIn: true });
    setPhase('opening');
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        // The picture may already be here (cached): use its proportions.
        setRect(restRect(aspectRef.current));
        setPhase('open');
      })
    );
    return () => cancelAnimationFrame(frame);
  }, [open, src]); // eslint-disable-line react-hooks/exhaustive-deps

  // The whole picture arrives: take its proportions.
  useEffect(() => {
    if (!open || !src) return undefined;
    let live = true;
    const img = new Image();
    img.onload = () => {
      if (!live) return;
      const a = img.naturalWidth / img.naturalHeight || 1;
      aspectRef.current = a;
      setAspect(a);
      setFullReady(true);
      setPhase((ph) => {
        if (ph === 'open') setRect(restRect(a));
        return ph;
      });
    };
    img.src = src;
    return () => {
      live = false;
    };
  }, [open, src]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    const onResize = () => setRect(restRect(aspect));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, aspect]);

  const close = useCallback(() => {
    if (phase === 'closing') return;
    setZoom({ s: 1, x: 0, y: 0 });
    setDrop(0);
    const back = originRect();
    setPhase('closing');
    if (back) setRect(back);
    setTimeout(() => {
      setPhase('closed');
      onClose?.();
    }, 320);
  }, [phase, originRect, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') close();
      if (event.key === '+' || event.key === '=') zoomBy(1.4);
      if (event.key === '-') zoomBy(1 / 1.4);
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Zoom ────────────────────────────────────────────────────────────────
  const limit = useCallback(
    (z) => {
      if (z.s <= 1.001) return { s: 1, x: 0, y: 0 };
      const w = rect?.width || 0;
      const h = rect?.height || 0;
      const mx = (w * (z.s - 1)) / 2;
      const my = (h * (z.s - 1)) / 2;
      return { s: z.s, x: clamp(z.x, -mx, mx), y: clamp(z.y, -my, my) };
    },
    [rect]
  );
  /** Zoom by `factor` keeping the point (cx, cy) — screen coordinates — in place. */
  const zoomAt = useCallback(
    (factor, cx, cy) => {
      setZoom((z) => {
        const s = clamp(z.s * factor, 1, MAX_ZOOM);
        if (!rect) return z;
        const ox = cx - (rect.left + rect.width / 2);
        const oy = cy - (rect.top + rect.height / 2);
        const k = s / z.s;
        return limit({ s, x: ox - (ox - z.x) * k, y: oy - (oy - z.y) * k });
      });
    },
    [rect, limit]
  );
  const zoomBy = (factor) => rect && zoomAt(factor, rect.left + rect.width / 2, rect.top + rect.height / 2);

  const onWheel = (event) => {
    event.preventDefault();
    zoomAt(Math.exp(-event.deltaY * 0.0022), event.clientX, event.clientY);
  };
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return undefined;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  // ── Pointers: pan, pinch, swipe down, double tap ─────────────────────────
  const lastTap = useRef(0);
  const onPointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setTouching(true);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      const [a, b] = pts;
      gesture.current = { kind: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, start: zoomRef.current };
    } else if (pts.length === 1) {
      gesture.current = { kind: zoomRef.current.s > 1 ? 'pan' : 'swipe', sx: event.clientX, sy: event.clientY, start: zoomRef.current, moved: false };
    }
  };
  const onPointerMove = (event) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'pinch') {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const s = clamp((g.start.s * dist) / g.dist, 1, MAX_ZOOM);
      if (!rect) return;
      const ox = g.cx - (rect.left + rect.width / 2);
      const oy = g.cy - (rect.top + rect.height / 2);
      const k = s / g.start.s;
      setZoom(limit({ s, x: ox - (ox - g.start.x) * k, y: oy - (oy - g.start.y) * k }));
      return;
    }
    const dx = event.clientX - g.sx;
    const dy = event.clientY - g.sy;
    if (Math.hypot(dx, dy) > 4) g.moved = true;
    if (g.kind === 'pan') setZoom(limit({ s: g.start.s, x: g.start.x + dx, y: g.start.y + dy }));
    else if (g.kind === 'swipe') setDrop(Math.max(0, dy));
  };
  const onPointerUp = (event) => {
    pointers.current.delete(event.pointerId);
    const g = gesture.current;
    if (pointers.current.size) {
      // One finger left after a pinch: keep panning from here.
      const [p] = [...pointers.current.values()];
      gesture.current = { kind: zoomRef.current.s > 1 ? 'pan' : 'swipe', sx: p.x, sy: p.y, start: zoomRef.current, moved: true };
      return;
    }
    gesture.current = null;
    setTouching(false);
    if (!g) return;
    if (g.kind === 'swipe') {
      if (drop > 110) {
        close();
        return;
      }
      setDrop(0);
    }
    if (!g.moved && g.kind !== 'pinch') {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        lastTap.current = 0;
        if (zoomRef.current.s > 1) setZoom({ s: 1, x: 0, y: 0 });
        else zoomAt(2.5, event.clientX, event.clientY);
      } else lastTap.current = now;
    }
  };

  if (!open && phase === 'closed') return null;
  const shown = phase === 'open' && rect;
  const roundness = phase === 'open' ? 16 : from ? (rect?.width || 0) / 2 : 16;
  const fade = 1 - Math.min(drop / 360, 0.6);
  const zoomed = zoom.s > 1;

  return createPortal(
    <div className={`fam-pv is-${phase}${zoomed ? ' is-zoomed' : ''}${drop || touching ? ' is-touching' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="fam-pv__backdrop" style={{ opacity: phase === 'open' ? fade : 0 }} onClick={close} />
      <div className="fam-pv__bar" style={{ opacity: phase === 'open' ? fade : 0 }}>
        <button type="button" onClick={() => zoomBy(1 / 1.5)} disabled={!zoomed} aria-label={t('family.photo.zoomOut')} title={t('family.photo.zoomOut')}>
          <ZoomOutOutlined />
        </button>
        <button type="button" onClick={() => zoomBy(1.5)} disabled={zoom.s >= MAX_ZOOM} aria-label={t('family.photo.zoomIn')} title={t('family.photo.zoomIn')}>
          <ZoomInOutlined />
        </button>
        <a href={src} target="_blank" rel="noreferrer" aria-label={t('family.photo.original')} title={t('family.photo.original')}>
          <ExpandOutlined />
        </a>
        <button type="button" className="fam-pv__close" onClick={close} aria-label={t('common.close')} title={t('common.close')}>
          <CloseOutlined />
        </button>
      </div>
      {rect && (
        <div
          ref={frameRef}
          className="fam-pv__frame"
          style={{
            left: rect.left,
            top: rect.top + drop,
            width: rect.width,
            height: rect.height,
            borderRadius: roundness,
            transform: `scale(${drop ? 1 - Math.min(drop / 1400, 0.15) : 1})`,
            opacity: rect.scaleIn && phase !== 'open' ? 0 : 1,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="fam-pv__img" style={{ transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})` }}>
            {thumb && <img src={thumb} alt="" draggable={false} className="fam-pv__thumb" style={{ opacity: fullReady ? 0 : 1 }} />}
            <img src={src} alt={title} draggable={false} className="fam-pv__full" style={{ opacity: fullReady ? 1 : 0 }} />
          </div>
          {!fullReady && <span className="fam-pv__spinner" />}
        </div>
      )}
      {shown && (
        <div className="fam-pv__caption" style={{ opacity: fade }}>
          <b>{title}</b>
          {subtitle && <span>{subtitle}</span>}
          {note && <em>{note}</em>}
          <small>{t('family.photo.hint')}</small>
        </div>
      )}
    </div>,
    document.body
  );
}
