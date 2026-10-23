import { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useLocale } from '../../../context/LocaleContext';
import { buildTimeline } from '../timeline';
import { buildFamilies, lineage } from '../layout';
import { ageOf, displayName, lifeYears } from '../format';
import { Avatar } from './TreeCanvas';

const ROW = 40;
const HEAD = 34;
const WIDE = { name: 260, indent: 16 };
// Phones: a narrow outline so the lifelines keep most of the screen.
const NARROW = { name: 150, indent: 9 };
const LEAD = 24; // room for the first year label

/**
 * Lifelines: the family as an outline (names, indented by generation) next to
 * bars on one axis of years. Narrow and tall, so it reads like a tree turned
 * on its side, with ages and overlaps of lives visible at a glance.
 */
export default function TimelineView({ data, selectedId, onSelect, onOpen }) {
  const { t } = useLocale();
  const wrapRef = useRef(null);
  const tip = useRef(null);
  const [width, setWidth] = useState(900);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tl = useMemo(() => buildTimeline(data.persons, data.parents, data.unions), [data]);
  const graph = useMemo(() => buildFamilies(data.persons, data.parents, data.unions), [data]);
  const near = useMemo(() => {
    if (!selectedId) return null;
    const { up, down } = lineage(graph, selectedId);
    const set = new Set([selectedId, ...up, ...down]);
    for (const id of [selectedId, ...down]) for (const p of graph.partnersOf.get(id) || []) set.add(p);
    return set;
  }, [selectedId, graph]);

  // Selecting someone elsewhere scrolls their row into view.
  useEffect(() => {
    if (!selectedId || !wrapRef.current) return;
    const index = tl.rowOf.get(selectedId);
    if (index === undefined) return;
    const el = wrapRef.current;
    const top = HEAD + index * ROW;
    if (top < el.scrollTop + HEAD || top > el.scrollTop + el.clientHeight - ROW * 2) el.scrollTo({ top: top - el.clientHeight / 3, behavior: 'smooth' });
  }, [selectedId, tl]);

  const { name: NAME_W, indent: INDENT } = width < 576 ? NARROW : WIDE;
  // A view that matches nobody: no years to draw.
  if (!tl.rows.length || !Number.isFinite(tl.minYear) || !Number.isFinite(tl.maxYear)) {
    return (
      <div className="fam-tl" ref={wrapRef}>
        <div className="fam-empty-kin">{t('family.list.empty')}</div>
      </div>
    );
  }
  const span = Math.max(1, tl.maxYear - tl.minYear);
  const plotW = Math.max(span * 5, width - NAME_W - 24 - LEAD);
  const px = plotW / span;
  const x = (year) => LEAD + (year - tl.minYear) * px;
  const height = tl.rows.length * ROW;
  const decades = [];
  for (let y = tl.minYear; y <= tl.maxYear; y += 10) decades.push(y);
  const step = px * 10 < 46 ? 20 : 10;

  const isDim = (id) => Boolean(near && !near.has(id));
  const rowY = (i) => i * ROW + ROW / 2;

  return (
    <div className="fam-tl" ref={wrapRef} data-tour="family.timeline">
      <div className="fam-tl__grid" style={{ width: NAME_W + plotW + 24 + LEAD, height: HEAD + height + 24 }}>
        {/* Year header */}
        <div className="fam-tl__head" style={{ width: NAME_W + plotW + 24 + LEAD }}>
          <div className="fam-tl__corner" style={{ width: NAME_W }}>
            {t('family.timeline.people', { count: tl.rows.length })}
          </div>
          <svg width={plotW + 24 + LEAD} height={HEAD} className="fam-tl__axis">
            {decades
              .filter((y) => (y - tl.minYear) % step === 0)
              .map((y) => (
                <text key={y} x={x(y)} y={HEAD - 11} textAnchor="middle">
                  {y}
                </text>
              ))}
            <line x1={x(tl.now)} x2={x(tl.now)} y1={HEAD - 6} y2={HEAD} className="fam-tl__nowtick" />
          </svg>
        </div>

        {/* Names: an outline of the family */}
        <div className="fam-tl__names" style={{ width: NAME_W, height }}>
          {tl.rows.map((row, i) => {
            const p = row.person;
            return (
              <div
                key={row.id}
                className={`fam-tl__name${row.id === selectedId ? ' is-selected' : ''}${isDim(row.id) ? ' is-dim' : ''}${row.partnerOf !== null ? ' is-partner' : ''}`}
                style={{ top: i * ROW, height: ROW, paddingLeft: 10 + row.depth * INDENT, '--indent': `${row.depth * INDENT}px` }}
                onClick={() => onSelect(row.id)}
                onDoubleClick={() => onOpen?.(row.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelect(row.id)}
              >
                {Array.from({ length: row.depth }, (_, d) => (
                  <span key={d} className="fam-tl__guide" style={{ left: 10 + d * INDENT + 6 }} />
                ))}
                <Avatar person={p} size={26} />
                <span className="fam-tl__label">{displayName(p)}</span>
              </div>
            );
          })}
        </div>

        {/* Bars, branches and couples */}
        <svg className="fam-tl__plot" width={plotW + 24 + LEAD} height={height} style={{ left: NAME_W, top: HEAD }}>
          <defs>
            {['male', 'female', 'unknown'].map((g) => (
              <linearGradient key={g} id={`fam-tl-${g}`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" className={`fam-tl__stop fam-tl__stop--${g}`} stopOpacity="0.95" />
                <stop offset="1" className={`fam-tl__stop fam-tl__stop--${g}`} stopOpacity="0.55" />
              </linearGradient>
            ))}
            <linearGradient id="fam-tl-fade" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0.6" stopColor="white" stopOpacity="1" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <mask id="fam-tl-open">
              <rect x="0" y="0" width="100%" height="100%" fill="url(#fam-tl-fade)" />
            </mask>
          </defs>

          {decades.map((y) => (
            <line key={y} x1={x(y)} x2={x(y)} y1={0} y2={height} className={`fam-tl__decade${(y - tl.minYear) % step === 0 ? ' is-major' : ''}`} />
          ))}
          {tl.rows.map((row, i) => (
            <rect
              key={`bg-${row.id}`}
              x={0}
              y={i * ROW}
              width={plotW + 24 + LEAD}
              height={ROW}
              className={`fam-tl__rowbg${i % 2 ? ' is-odd' : ''}${row.id === selectedId ? ' is-selected' : ''}`}
            />
          ))}
          <line x1={x(tl.now)} x2={x(tl.now)} y1={0} y2={height} className="fam-tl__now" />

          {tl.branches.map((b) => {
            const top = rowY(b.fromRow);
            const bottom = rowY(b.toRow);
            const dim = near && !(b.parents.every((id) => near.has(id)) && near.has(b.childId));
            return (
              <g key={`br-${b.childId}`} className={`fam-tl__branch${b.estimated ? ' is-estimated' : ''}${dim ? ' is-dim' : ''}`}>
                <line x1={x(b.year)} x2={x(b.year)} y1={top} y2={bottom - 7} />
                <circle cx={x(b.year)} cy={top} r="3" />
              </g>
            );
          })}

          {tl.couples.map((c) => {
            const ya = rowY(c.rowA);
            const yb = rowY(c.rowB);
            const at = c.year ? x(c.year) : null;
            const ended = ['divorced', 'separated'].includes(c.union?.status);
            const dim = near && !(near.has(c.a) && near.has(c.b));
            return at === null ? null : (
              <g key={`cp-${c.a}-${c.b}`} className={`fam-tl__couple${ended ? ' is-ended' : ''}${c.estimated ? ' is-estimated' : ''}${dim ? ' is-dim' : ''}`}>
                <line x1={at} x2={at} y1={ya} y2={yb} />
                <circle cx={at} cy={(ya + yb) / 2} r="4" />
              </g>
            );
          })}

          {tl.rows.map((row, i) => {
            const p = row.person;
            const x1 = x(row.from);
            const w = Math.max(6, x(row.to) - x1);
            const age = ageOf(p);
            const label = `${lifeYears(p) || (row.estimated ? `~${row.from}` : '')}${age !== null ? ` · ${t('family.ageShort', { count: age })}` : ''}`;
            const y = i * ROW + 10;
            return (
                <g
                  key={`bar-${row.id}`}
                  className={`fam-tl__bar fam-tl__bar--${p.gender}${row.estimated ? ' is-estimated' : ''}${p.isAlive ? ' is-alive' : ''}${row.id === selectedId ? ' is-selected' : ''}${isDim(row.id) ? ' is-dim' : ''}`}
                  onClick={() => onSelect(row.id)}
                  onDoubleClick={() => onOpen?.(row.id)}
                  onMouseMove={(e) => tip.current?.show(e, row, label)}
                  onMouseLeave={() => tip.current?.hide()}
                >
                  <rect x={x1} y={y} width={w} height={ROW - 20} rx={(ROW - 20) / 2} fill={`url(#fam-tl-${p.gender})`} mask={row.openEnd ? 'url(#fam-tl-open)' : undefined} />
                  {p.isAlive && <circle cx={x1 + w} cy={y + (ROW - 20) / 2} r="4" className="fam-tl__alive" />}
                  {w > 120 && (
                    <text x={x1 + 10} y={y + (ROW - 20) / 2 + 4} className="fam-tl__barlabel">
                      {label}
                    </text>
                  )}
                  {w <= 120 && label && (
                    // Beside the bar: on the right, or on the left when it would run off the chart.
                    x1 + w + 16 + label.length * 6.4 < plotW + LEAD ? (
                      <text x={x1 + w + (p.isAlive ? 10 : 6)} y={y + (ROW - 20) / 2 + 4} className="fam-tl__sidelabel">
                        {label}
                      </text>
                    ) : (
                      <text x={x1 - 6} y={y + (ROW - 20) / 2 + 4} textAnchor="end" className="fam-tl__sidelabel">
                        {label}
                      </text>
                    )
                  )}
                </g>
            );
          })}
        </svg>
      </div>
      <TimelineTip ref={tip} t={t} />
    </div>
  );
}

/** One floating tooltip for all bars: moved by hand, so hovering never re-renders the chart. */
const TimelineTip = memo(
  forwardRef(function TimelineTip({ t }, ref) {
    const [state, setState] = useState(null);
    const el = useRef(null);
    useImperativeHandle(ref, () => ({
      show(event, row, label) {
        const node = el.current;
        if (node) {
          node.style.left = `${event.clientX + 14}px`;
          node.style.top = `${event.clientY + 14}px`;
        }
        setState((prev) => (prev?.id === row.id ? prev : { id: row.id, row, label }));
      },
      hide() {
        setState(null);
      },
    }));
    return (
      <div ref={el} className={`fam-tl__tip${state ? ' is-open' : ''}`} role="tooltip">
        {state && (
          <>
            <b>{displayName(state.row.person, { withPatronymic: true })}</b>
            <span>{state.label || '—'}</span>
            {state.row.estimated && <i>{t('family.timeline.estimated')}</i>}
          </>
        )}
      </div>
    );
  })
);
