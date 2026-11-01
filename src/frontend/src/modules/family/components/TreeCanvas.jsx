import { memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react';
import { Popover, Tooltip } from 'antd';
import { AimOutlined, CompressOutlined, ExpandOutlined, MinusOutlined, PlusOutlined, QuestionOutlined } from '@ant-design/icons';
import { useRegional } from '../../../lib/datetime';
import { useLocale } from '../../../context/LocaleContext';
import { CARD_H, CARD_W, connectorPaths, layoutTree, lineage, roundedPath } from '../layout';
import { ageOf, displayName, formatPartial, initials, lifeYears, maybeDeceased } from '../format';

function useFmtPartial() {
  const regional = useRegional();
  return (value) => formatPartial(value, regional.dateFormat);
}

const PAD = 120;
const MIN_K = 0.15;
const MAX_K = 2.2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function Avatar({ person, size = 48, className = '' }) {
  const [broken, setBroken] = useState(false);
  const url = !broken && person?.photoUrl;
  return (
    <span className={`fam-avatar fam-avatar--${person?.gender || 'unknown'} ${className}`} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {url ? <img src={url} alt="" loading="lazy" draggable={false} onError={() => setBroken(true)} /> : <span>{initials(person)}</span>}
    </span>
  );
}

const PersonCard = memo(function PersonCard({ node, selected, dim, related, onSelect, onOpen, onPlaceholder, t }) {
  const person = node.person;
  if (node.placeholder) {
    return (
      <div
        className={`fam-card fam-card--ghost${dim ? ' is-dim' : ''}`}
        style={{ transform: `translate(${node.x + PAD}px, ${node.y + PAD}px)`, width: CARD_W, height: CARD_H }}
        onClick={(event) => {
          event.stopPropagation();
          onPlaceholder?.(node);
        }}
        role="button"
        tabIndex={0}
        title={t('family.ghost.hint')}
      >
        <span className="fam-avatar fam-avatar--ghost" style={{ width: 36, height: 36 }}>
          ?
        </span>
        <div className="fam-card__text">
          <div className="fam-card__first fam-card__first--ghost">{t(`family.ghost.${person.gender === 'male' ? 'father' : person.gender === 'female' ? 'mother' : 'parent'}`)}</div>
        </div>
      </div>
    );
  }
  const age = ageOf(person);
  return (
    <div
      className={`fam-card fam-card--${person.gender}${person.isAlive ? '' : ' is-deceased'}${selected ? ' is-selected' : ''}${dim ? ' is-dim' : ''}${related ? ' is-related' : ''}`}
      style={{ transform: `translate(${node.x + PAD}px, ${node.y + PAD}px)`, width: CARD_W, height: CARD_H }}
      data-person={node.personId}
      title={displayName(person, { withPatronymic: true })}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(person.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onOpen?.(person.id);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => event.key === 'Enter' && onSelect(node.personId)}
    >
      {node.copies > 1 && (
        <span className={`fam-card__union${node.familyState && node.familyState !== 'active' ? ' is-past' : ''}`} title={t('family.ghost.copy', { count: node.copies })}>
          ⚭ {node.copy + 1}
        </span>
      )}
      <Avatar person={person} size={36} />
      <div className="fam-card__text">
        <div className="fam-card__first">{person.firstName || person.lastName || '—'}</div>
        {!person.isAlive && <span className="fam-mourning" aria-label={t('family.deceased')} />}
        {person.isAlive
          ? age !== null && (
              <div className="fam-card__meta">
                <span className={`fam-card__age${maybeDeceased(person) ? ' is-doubt' : ''}`}>
                  {t('family.ageShort', { count: age })}
                  {maybeDeceased(person) ? ' ?' : ''}
                </span>
              </div>
            )
          : lifeYears(person) && (
              // The dead: years of life, not an age that reads like «now».
              <div className="fam-card__meta">
                <span className="fam-card__years">{lifeYears(person)}</span>
              </div>
            )}
      </div>
    </div>
  );
});

function QuickAdd({ node, kin, onQuickAdd, t }) {
  const x = node.x + PAD;
  const y = node.y + PAD;
  const buttons = [
    kin.parents < 2 && { key: 'parent', left: x + CARD_W / 2 - 15, top: y - 15 - 14, label: t('family.add.parent') },
    { key: 'child', left: x + CARD_W / 2 - 15, top: y + CARD_H + 14, label: t('family.add.child') },
    { key: 'partner', left: x + CARD_W + 14, top: y + CARD_H / 2 - 15, label: t('family.add.partner') },
    { key: 'sibling', left: x - 14 - 30, top: y + CARD_H / 2 - 15, label: t('family.add.sibling') },
  ].filter(Boolean);
  return buttons.map((b) => (
    <Tooltip key={b.key} title={b.label}>
      <button
        type="button"
        className={`fam-quick fam-quick--${b.key}`}
        style={{ left: b.left, top: b.top }}
        onClick={(event) => {
          event.stopPropagation();
          onQuickAdd(node.id, b.key);
        }}
        aria-label={b.label}
      >
        <PlusOutlined />
      </button>
    </Tooltip>
  ));
}

/** The ring on a couple line: state at a glance, dates on hover, a click edits the union. */
function UnionRing({ line, t, canEdit, onUnion, dim }) {
  const fmt = useFmtPartial();
  const u = line.union;
  const from = u?.startDate ? fmt(u.startDate) : null;
  const to = u?.endDate ? fmt(u.endDate) : null;
  const status = t(`family.status.${u?.status || 'married'}`);
  let tip = status;
  if (line.state === 'widowed' && u?.status !== 'widowed') tip = t('family.union.byDeath');
  if (from && to) tip += ` · ${from} – ${to}`;
  else if (from) tip += ` · ${t('family.union.since', { date: from })}`;
  else if (to) tip += ` · ${t('family.union.until', { date: to })}`;
  const x = (line.x1 + line.x2) / 2 + PAD;
  const y = line.y + PAD;
  return (
    <Tooltip title={canEdit ? `${tip} · ${t('family.union.clickToEdit')}` : tip}>
      <button
        type="button"
        className={`fam-ring is-${line.state}${dim ? ' is-dim' : ''}`}
        style={{ left: x - 9, top: y - 9 }}
        onClick={(event) => {
          event.stopPropagation();
          if (canEdit) onUnion?.(u);
        }}
        aria-label={tip}
      />
    </Tooltip>
  );
}

function Legend({ t }) {
  const rows = [
    ['active', t('family.legend.active')],
    ['ended', t('family.legend.ended')],
    ['widowed', t('family.legend.widowed')],
    ['implied', t('family.legend.implied')],
    ['same', t('family.legend.same')],
  ];
  return (
    <div className="fam-legend">
      {rows.map(([key, label]) => (
        <div key={key} className="fam-legend__row">
          <svg width="44" height="14" aria-hidden="true">
            {key === 'same' ? (
              <line x1="2" y1="7" x2="42" y2="7" className="fam-same" />
            ) : (
              <g className={`fam-couple is-${key === 'implied' ? 'active is-implied' : key}`}>
                <line x1="2" y1="7" x2="42" y2="7" />
              </g>
            )}
            {['active', 'ended', 'widowed'].includes(key) && <circle cx="22" cy="7" r="5" className={`fam-legend__ring is-${key}`} />}
          </svg>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * The tree drawing: automatic layout, pan (drag / two fingers), zoom at the
 * cursor (wheel, pinch, +/−), minimap, line-of-descent highlight and quick
 * "add relative" buttons around the selected person.
 */
const TreeCanvas = forwardRef(function TreeCanvas({ data, selectedId, onSelect, onOpen, onQuickAdd, onPlaceholder, onUnion, canEdit, homeId }, ref) {
  const { t } = useLocale();
  const viewportRef = useRef(null);
  const worldRef = useRef(null);
  const view = useRef({ x: 0, y: 0, k: 1 });
  const [mini, setMini] = useState({ x: 0, y: 0, k: 1, w: 1, h: 1 });
  const [full, setFull] = useState(false);
  const frame = useRef(0);
  const fitted = useRef(false);

  const showUnknown = data.tree?.showUnknownParents !== false;
  const layout = useMemo(() => layoutTree(data.persons, data.parents, data.unions, { showUnknown }), [data.persons, data.parents, data.unions, showUnknown]);
  const nodeOf = useMemo(() => new Map(layout.nodes.filter((n) => n.personId !== null && !n.copy).map((n) => [n.personId, n])), [layout]);
  const worldW = layout.width + PAD * 2;
  const worldH = layout.height + PAD * 2;

  const highlight = useMemo(() => {
    if (!selectedId || !nodeOf.has(selectedId)) return null;
    const { up, down } = lineage(layout.graph, selectedId);
    const near = new Set([selectedId, ...up, ...down]);
    for (const id of [selectedId, ...down]) for (const p of layout.graph.partnersOf.get(id) || []) near.add(p);
    return { up, down, near };
  }, [selectedId, layout, nodeOf]);

  const apply = useCallback(() => {
    const { x, y, k } = view.current;
    if (worldRef.current) worldRef.current.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = viewportRef.current;
      if (el) setMini({ x, y, k, w: el.clientWidth, h: el.clientHeight });
    });
  }, []);

  const zoomAt = useCallback(
    (factor, cx, cy) => {
      const v = view.current;
      const k = clamp(v.k * factor, MIN_K, MAX_K);
      const f = k / v.k;
      view.current = { k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f };
      apply();
    },
    [apply]
  );

  const animateTo = useCallback(
    (target) => {
      const start = { ...view.current };
      const t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / 380);
        const e = 1 - Math.pow(1 - p, 3);
        view.current = {
          x: start.x + (target.x - start.x) * e,
          y: start.y + (target.y - start.y) * e,
          k: start.k + (target.k - start.k) * e,
        };
        apply();
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
    [apply]
  );

  const fit = useCallback(
    (animated = true) => {
      const el = viewportRef.current;
      if (!el) return;
      const k = clamp(Math.min(el.clientWidth / worldW, el.clientHeight / worldH, 1), MIN_K, MAX_K);
      const target = { k, x: (el.clientWidth - worldW * k) / 2, y: (el.clientHeight - worldH * k) / 2 };
      if (animated) animateTo(target);
      else {
        view.current = target;
        apply();
      }
    },
    [worldW, worldH, animateTo, apply]
  );

  const centerOn = useCallback(
    (id, { zoom = null, animated = true } = {}) => {
      const el = viewportRef.current;
      const node = nodeOf.get(id);
      if (!el || !node) return;
      const k = zoom ?? Math.max(view.current.k, 0.75);
      const cx = (node.x + PAD + CARD_W / 2) * k;
      const cy = (node.y + PAD + CARD_H / 2) * k;
      const target = { k, x: el.clientWidth / 2 - cx, y: el.clientHeight / 2 - cy };
      if (animated) animateTo(target);
      else {
        view.current = target;
        apply();
      }
    },
    [nodeOf, animateTo, apply]
  );

  useImperativeHandle(ref, () => ({ fit, centerOn }), [fit, centerOn]);

  // First view: the whole tree when it is readable, otherwise its home person.
  useEffect(() => {
    if (fitted.current || !layout.nodes.length || !viewportRef.current) return;
    fitted.current = true;
    const el = viewportRef.current;
    const k = Math.min(el.clientWidth / worldW, el.clientHeight / worldH);
    const start = homeId && nodeOf.has(homeId) ? homeId : layout.nodes.find((n) => n.personId !== null)?.personId;
    if (k >= 0.55 || !start) fit(false);
    else centerOn(start, { zoom: 0.8, animated: false });
  }, [layout, worldW, worldH, fit, centerOn, homeId, nodeOf]);

  useEffect(() => {
    const onResize = () => apply();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [apply]);

  // Wheel: pinch / ctrl / mouse wheel zoom at the cursor; trackpad scroll pans.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const mouseLike = event.deltaMode === 1 || (Math.abs(event.deltaY) >= 40 && event.deltaX === 0 && Number.isInteger(event.deltaY));
      if (event.ctrlKey || event.metaKey || mouseLike) {
        zoomAt(Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0018)), event.clientX - rect.left, event.clientY - rect.top);
      } else {
        view.current = { ...view.current, x: view.current.x - event.deltaX, y: view.current.y - event.deltaY };
        apply();
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt, apply]);

  // Drag to pan, two fingers to pinch.
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const moved = useRef(false);
  const onPointerDown = (event) => {
    if (event.target.closest('.fam-quick, .fam-controls, .fam-mini')) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    moved.current = false;
    gesture.current = { view: { ...view.current }, pts: new Map(pointers.current) };
  };
  const onPointerMove = (event) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const start = gesture.current;
    const rect = viewportRef.current.getBoundingClientRect();
    const now = [...pointers.current.values()];
    const was = [...start.pts.values()];
    if (now.length >= 2 && was.length >= 2) {
      const d0 = Math.hypot(was[0].x - was[1].x, was[0].y - was[1].y) || 1;
      const d1 = Math.hypot(now[0].x - now[1].x, now[0].y - now[1].y);
      const c0 = { x: (was[0].x + was[1].x) / 2 - rect.left, y: (was[0].y + was[1].y) / 2 - rect.top };
      const c1 = { x: (now[0].x + now[1].x) / 2 - rect.left, y: (now[0].y + now[1].y) / 2 - rect.top };
      const k = clamp(start.view.k * (d1 / d0), MIN_K, MAX_K);
      const f = k / start.view.k;
      view.current = { k, x: c1.x - (c0.x - start.view.x) * f, y: c1.y - (c0.y - start.view.y) * f };
      if (!moved.current) viewportRef.current.setPointerCapture?.(event.pointerId);
      moved.current = true;
    } else {
      const p0 = was[0];
      const dx = event.clientX - p0.x;
      const dy = event.clientY - p0.y;
      // Capture only once it is a drag: capturing on press would send the
      // click to the background instead of the card.
      if (!moved.current && Math.abs(dx) + Math.abs(dy) > 4) {
        moved.current = true;
        viewportRef.current.setPointerCapture?.(event.pointerId);
      }
      view.current = { ...start.view, x: start.view.x + dx, y: start.view.y + dy };
    }
    apply();
  };
  const onPointerUp = (event) => {
    pointers.current.delete(event.pointerId);
    gesture.current = { view: { ...view.current }, pts: new Map(pointers.current) };
  };

  // Clicks on the background (not after a drag) clear the selection.
  const onClickCapture = (event) => {
    if (moved.current) {
      event.stopPropagation();
      event.preventDefault();
      moved.current = false;
    }
  };

  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest?.('input, textarea, [contenteditable="true"], .ant-modal, .ant-drawer')) return;
      const el = viewportRef.current;
      if (!el) return;
      if (event.key === '+' || event.key === '=') zoomAt(1.2, el.clientWidth / 2, el.clientHeight / 2);
      else if (event.key === '-') zoomAt(1 / 1.2, el.clientWidth / 2, el.clientHeight / 2);
      else if (event.key === '0') fit();
      else if (event.key === 'Escape') onSelect(null);
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomAt, fit, onSelect]);

  const selectedNode = selectedId ? nodeOf.get(selectedId) : null;
  const selectedKin = useMemo(
    () => ({ parents: selectedId ? (layout.graph.parentsOf.get(selectedId) || []).length : 0 }),
    [selectedId, layout]
  );

  const hl = highlight;
  const lineClass = (ids) => {
    if (!hl) return '';
    const real = ids.filter((id) => id !== null && id !== undefined);
    return real.length && real.every((id) => hl.near.has(id)) ? ' is-hot' : ' is-dim';
  };

  // Minimap geometry.
  const MW = 180;
  const ms = Math.min(MW / worldW, 120 / worldH);
  const mh = worldH * ms;
  const vr = {
    x: (-mini.x / mini.k) * ms,
    y: (-mini.y / mini.k) * ms,
    w: (mini.w / mini.k) * ms,
    h: (mini.h / mini.k) * ms,
  };
  const jump = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const wx = (event.clientX - rect.left) / ms;
    const wy = (event.clientY - rect.top) / ms;
    const el = viewportRef.current;
    const k = view.current.k;
    animateTo({ k, x: el.clientWidth / 2 - wx * k, y: el.clientHeight / 2 - wy * k });
  };

  const toggleFull = () => {
    const el = viewportRef.current?.parentElement;
    if (!document.fullscreenElement) el?.requestFullscreen?.().then(() => setFull(true)).catch(() => {});
    else document.exitFullscreen?.().then(() => setFull(false));
  };
  useEffect(() => {
    const on = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  return (
    <div className="fam-stage" data-tour="family.canvas">
      <div
        ref={viewportRef}
        className="fam-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
        onClick={() => onSelect(null)}
      >
        <div ref={worldRef} className="fam-world" style={{ width: worldW, height: worldH }}>
          <svg className="fam-lines" width={worldW} height={worldH} aria-hidden="true">
            <g transform={`translate(${PAD} ${PAD})`}>
              {layout.connectors.map((c) =>
                connectorPaths(c).map((p) => <path key={`${c.key}-${p.id}`} d={p.d} className={`fam-line${p.secondary ? ' is-secondary' : ''}${lineClass([...c.realParents, p.realId])}`} />)
              )}
              {layout.sameLines.map((l) => (
                <path
                  key={l.key}
                  className={`fam-same${hl ? (hl.near.has(l.realId) ? ' is-hot' : ' is-dim') : ''}`}
                  d={roundedPath(l.points)}
                />
              ))}
              {layout.coupleLines.map((c) =>
                c.adjacent ? (
                  <g key={c.key} className={`fam-couple is-${c.state}${c.implied ? ' is-implied' : ''}${lineClass([c.realA, c.realB])}`}>
                    <line x1={c.x1} y1={c.y} x2={c.x2} y2={c.y} />
                  </g>
                ) : (
                  <path
                    key={c.key}
                    className={`fam-couple is-far${lineClass([c.realA, c.realB])}`}
                    d={`M ${c.x1} ${c.y} C ${c.x1 + 60} ${c.y}, ${c.x2 - 60} ${c.y2}, ${c.x2} ${c.y2}`}
                  />
                )
              )}
            </g>
          </svg>
          {layout.nodes.map((node) => (
            <PersonCard
              key={node.id}
              node={node}
              t={t}
              selected={node.personId === selectedId}
              related={Boolean(hl && hl.near.has(node.personId) && node.personId !== selectedId)}
              dim={Boolean(hl && !hl.near.has(node.placeholder ? node.of : node.personId))}
              onSelect={onSelect}
              onOpen={onOpen}
              onPlaceholder={onPlaceholder}
            />
          ))}
          {layout.coupleLines
            .filter((c) => c.adjacent && !c.implied && c.unionId)
            .map((c) => (
              <UnionRing key={`ring-${c.key}`} line={c} t={t} canEdit={canEdit} onUnion={onUnion} dim={Boolean(hl) && lineClass([c.realA, c.realB]) === ' is-dim'} />
            ))}
          {canEdit && selectedNode && <QuickAdd node={selectedNode} kin={selectedKin} onQuickAdd={onQuickAdd} t={t} />}
        </div>
      </div>

      <div className="fam-controls" data-tour="family.controls">
        <Tooltip title={t('family.zoomIn')} placement="left">
          <button type="button" onClick={() => zoomAt(1.25, viewportRef.current.clientWidth / 2, viewportRef.current.clientHeight / 2)} aria-label={t('family.zoomIn')}>
            <PlusOutlined />
          </button>
        </Tooltip>
        <Tooltip title={t('family.zoomOut')} placement="left">
          <button type="button" onClick={() => zoomAt(0.8, viewportRef.current.clientWidth / 2, viewportRef.current.clientHeight / 2)} aria-label={t('family.zoomOut')}>
            <MinusOutlined />
          </button>
        </Tooltip>
        <Tooltip title={t('family.fit')} placement="left">
          <button type="button" onClick={() => fit()} aria-label={t('family.fit')}>
            <CompressOutlined />
          </button>
        </Tooltip>
        {selectedId && (
          <Tooltip title={t('family.centerSelected')} placement="left">
            <button type="button" onClick={() => centerOn(selectedId)} aria-label={t('family.centerSelected')}>
              <AimOutlined />
            </button>
          </Tooltip>
        )}
        <Popover content={<Legend t={t} />} title={t('family.legend.title')} placement="leftTop" trigger="click">
          <button type="button" aria-label={t('family.legend.title')} title={t('family.legend.title')}>
            <QuestionOutlined />
          </button>
        </Popover>
        {document.fullscreenEnabled && (
          <Tooltip title={full ? t('family.exitFullscreen') : t('family.fullscreen')} placement="left">
            <button type="button" onClick={toggleFull} aria-label={t('family.fullscreen')}>
              {full ? <CompressOutlined /> : <ExpandOutlined />}
            </button>
          </Tooltip>
        )}
      </div>

      {layout.nodes.length > 6 && (
        <div className="fam-mini" style={{ width: worldW * ms, height: mh }} onClick={jump} role="presentation">
          <svg width={worldW * ms} height={mh}>
            {layout.nodes.map((n) => (
              <rect
                key={n.id}
                x={(n.x + PAD) * ms}
                y={(n.y + PAD) * ms}
                width={Math.max(2, CARD_W * ms)}
                height={Math.max(2, CARD_H * ms)}
                rx="1"
                className={`fam-mini__node fam-mini__node--${n.placeholder ? 'unknown' : n.person.gender}${n.personId === selectedId ? ' is-selected' : ''}`}
              />
            ))}
            <rect x={vr.x} y={vr.y} width={vr.w} height={vr.h} className="fam-mini__view" />
          </svg>
        </div>
      )}
    </div>
  );
});

export default TreeCanvas;
