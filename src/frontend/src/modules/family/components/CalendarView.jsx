import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Segmented, Tooltip } from 'antd';
import { CalendarOutlined, DownloadOutlined, GiftOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useLocale } from '../../../context/LocaleContext';
import { useRegional } from '../../../lib/datetime';
import { localeTag } from '../../../i18n/languages';
import { annualDates, daysBetween, monthWeeks, occurrencesIn, startOfDay, toIcs, upcoming } from '../calendar';
import { shortName } from '../format';
import { Avatar } from './TreeCanvas';

/** A tulip: memory without the sign of any one faith. */
export function MemoryIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21v-8" />
      <path d="M12 13c-3.3 0-5-2.4-5-5.6V4l2.6 1.8L12 3l2.4 2.8L17 4v3.4c0 3.2-1.7 5.6-5 5.6Z" />
      <path d="M12 18c-1.6-1.9-3.6-2.6-6-2.3.4 2.3 2.4 3.6 6 3.3M12 18c1.6-1.9 3.6-2.6 6-2.3-.4 2.3-2.4 3.6-6 3.3" />
    </svg>
  );
}

const TypeIcon = ({ type }) => (type === 'birth' ? <GiftOutlined /> : <MemoryIcon />);

/**
 * Birthdays and memorial days of the people shown: the next ones first, then
 * a month as a grid with the year as a strip of months, and the month's dates
 * day by day. Exported as a yearly .ics for any phone calendar.
 */
export default function CalendarView({ data, selectedId, onSelect, relationTo, title }) {
  const { t } = useLocale();
  const regional = useRegional();
  const tag = localeTag(regional.locale);
  const today = startOfDay(new Date());
  const [kind, setKind] = useState('all');
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [day, setDay] = useState(null);
  const agendaRef = useRef(null);
  const stripRef = useRef(null);

  const { list, undated } = useMemo(() => annualDates(data.persons), [data.persons]);
  const dates = useMemo(() => (kind === 'all' ? list : list.filter((d) => d.type === kind)), [list, kind]);
  const next = useMemo(() => upcoming(dates, today), [dates, today.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const yearDates = useMemo(() => occurrencesIn(dates, cursor.y), [dates, cursor.y]);
  const monthDates = yearDates.filter((o) => o.date.getMonth() === cursor.m);
  const perMonth = useMemo(() => {
    const counts = Array.from({ length: 12 }, () => ({ birth: 0, death: 0 }));
    for (const o of yearDates) counts[o.date.getMonth()][o.type] += 1;
    return counts;
  }, [yearDates]);
  const byDay = useMemo(() => {
    const map = new Map();
    for (const o of monthDates) {
      const d = o.date.getDate();
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(o);
    }
    return map;
  }, [monthDates]);

  const fmt = useMemo(
    () => ({
      month: new Intl.DateTimeFormat(tag, { month: 'long' }),
      monthShort: new Intl.DateTimeFormat(tag, { month: 'short' }),
      monthYear: new Intl.DateTimeFormat(tag, { month: 'long', year: 'numeric' }),
      dayMonth: new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'long' }),
      weekday: new Intl.DateTimeFormat(tag, { weekday: 'short' }),
      weekdayLong: new Intl.DateTimeFormat(tag, { weekday: 'long' }),
    }),
    [tag]
  );
  const cap = (s) => (s ? s[0].toLocaleUpperCase(tag) + s.slice(1) : s);
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => fmt.weekday.format(new Date(2024, 0, 7 + ((regional.weekStart + i) % 7)))), [fmt, regional.weekStart]);
  const weeks = useMemo(() => monthWeeks(cursor.y, cursor.m, regional.weekStart), [cursor, regional.weekStart]);

  // The chosen month stays in view in the strip of months.
  useEffect(() => {
    stripRef.current?.querySelector('.is-current')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [cursor.m]);

  const go = (delta) => {
    setDay(null);
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };
  const goToday = () => {
    setCursor({ y: today.getFullYear(), m: today.getMonth() });
    setDay(today.getDate());
  };
  const pickDay = (date) => {
    const d = date.getDate();
    setDay((cur) => (cur === d ? null : d));
    requestAnimationFrame(() => agendaRef.current?.querySelector(`[data-day="${d}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };
  const openOccurrence = (o) => {
    setCursor({ y: o.date.getFullYear(), m: o.date.getMonth() });
    setDay(o.date.getDate());
    onSelect?.(o.person.id);
  };

  // Swipe between months on phones.
  const touch = useRef(null);
  const onTouchStart = (e) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  };

  /** «Turns 45», «45 years since birth», «12 years of memory». */
  const what = (o) => {
    if (o.type === 'death') return t('family.calendar.memory', { count: o.years });
    if (!o.alive) return t('family.calendar.bornAgo', { count: o.years });
    if (o.years === 0) return t('family.calendar.born');
    return o.date < today ? t('family.calendar.turned', { count: o.years }) : t('family.calendar.turns', { count: o.years });
  };
  const when = (inDays) => (inDays === 0 ? t('family.calendar.today') : inDays === 1 ? t('family.calendar.tomorrow') : t('family.calendar.inDays', { count: inDays }));

  const exportIcs = () => {
    const body = toIcs(dates, {
      name: t('family.calendar.icsName', { name: title }),
      uidPrefix: `tree-${data.tree?.id || 'shared'}`,
      label: (d) => {
        const name = shortName(d.person);
        return d.type === 'birth'
          ? { summary: t('family.calendar.icsBirth', { name }), description: t('family.calendar.icsBornIn', { year: d.year }) }
          : { summary: t('family.calendar.icsMemory', { name }), description: t('family.calendar.icsDiedIn', { year: d.year }) };
      },
    });
    const url = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'family').replace(/[\\/:*?"<>|]+/g, ' ').trim()}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const isThisMonth = cursor.y === today.getFullYear() && cursor.m === today.getMonth();
  const agenda = [...byDay.entries()];

  return (
    <div className="fam-cal">
      <div className="fam-cal__inner">
        <section className="fam-cal__soon" aria-label={t('family.calendar.upcoming')}>
          <div className="fam-cal__soon-head">
            <h3>{t('family.calendar.upcoming')}</h3>
            <div className="fam-cal__tools">
              <Segmented
                size="small"
                value={kind}
                onChange={setKind}
                options={[
                  { value: 'all', label: t('family.calendar.all') },
                  { value: 'birth', icon: <GiftOutlined />, label: t('family.calendar.births') },
                  { value: 'death', icon: <MemoryIcon />, label: t('family.calendar.memorials') },
                ]}
              />
              <Tooltip title={t('family.calendar.icsHint')}>
                <Button size="small" icon={<DownloadOutlined />} onClick={exportIcs} disabled={!dates.length}>
                  <span className="fam-cal__ics-label">{t('family.calendar.ics')}</span>
                </Button>
              </Tooltip>
            </div>
          </div>
          {next.length ? (
            <div className="fam-cal__rail">
              {next.map((o) => (
                <button
                  type="button"
                  key={`${o.key}-${o.date.getFullYear()}`}
                  className={`fam-cal__soon-card fam-cal__soon-card--${o.type}${o.inDays === 0 ? ' is-today' : ''}${selectedId === o.person.id ? ' is-selected' : ''}`}
                  onClick={() => openOccurrence(o)}
                >
                  <span className="fam-cal__when">
                    <TypeIcon type={o.type} />
                    {when(o.inDays)}
                  </span>
                  <span className={`fam-cal__ring fam-cal__ring--${o.type} fam-cal__ring--${o.person.gender || 'unknown'}`}>
                    <Avatar person={o.person} size={52} />
                  </span>
                  <span className="fam-cal__soon-name">{shortName(o.person)}</span>
                  <span className="fam-cal__soon-what">{what(o)}</span>
                  <span className="fam-cal__soon-date">
                    {fmt.dayMonth.format(o.date)} · {fmt.weekday.format(o.date)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="fam-cal__empty">
              <CalendarOutlined />
              <span>{t('family.calendar.empty')}</span>
            </div>
          )}
        </section>

        <div className="fam-cal__main">
          <section className="fam-cal__month">
            <div className="fam-cal__nav">
              <Button type="text" shape="circle" icon={<LeftOutlined />} onClick={() => go(-1)} aria-label={t('family.calendar.prev')} />
              <h3 className="fam-cal__title">{cap(fmt.monthYear.format(new Date(cursor.y, cursor.m, 1)))}</h3>
              <Button type="text" shape="circle" icon={<RightOutlined />} onClick={() => go(1)} aria-label={t('family.calendar.next')} />
              <Button size="small" className="fam-cal__today-btn" onClick={goToday} disabled={isThisMonth && day === today.getDate()}>
                {t('family.calendar.today')}
              </Button>
            </div>

            <div className="fam-cal__strip" ref={stripRef}>
              {perMonth.map((c, m) => (
                <button
                  type="button"
                  key={m}
                  className={`fam-cal__strip-item${m === cursor.m ? ' is-current' : ''}${cursor.y === today.getFullYear() && m === today.getMonth() ? ' is-now' : ''}`}
                  onClick={() => {
                    setDay(null);
                    setCursor((cur) => ({ ...cur, m }));
                  }}
                >
                  <span className="fam-cal__strip-name">{fmt.monthShort.format(new Date(2024, m, 1)).replace('.', '')}</span>
                  <span className="fam-cal__strip-dots">
                    {c.birth > 0 && <i className="is-birth">{c.birth}</i>}
                    {c.death > 0 && <i className="is-death">{c.death}</i>}
                    {!c.birth && !c.death && <i className="is-none">·</i>}
                  </span>
                </button>
              ))}
            </div>

            <div className="fam-cal__grid" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
              {weekdays.map((w, i) => (
                <div key={`w${i}`} className="fam-cal__wd">
                  {w}
                </div>
              ))}
              {weeks.flat().map((date, i) => {
                if (!date) return <div key={`e${i}`} className="fam-cal__cell is-out" />;
                const d = date.getDate();
                const events = byDay.get(d) || [];
                const isToday = daysBetween(today, date) === 0;
                const births = events.filter((o) => o.type === 'birth').length;
                const deaths = events.length - births;
                return (
                  <button
                    type="button"
                    key={d}
                    className={`fam-cal__cell${events.length ? ' has-events' : ''}${isToday ? ' is-today' : ''}${day === d ? ' is-picked' : ''}${births ? ' has-birth' : ''}${deaths && !births ? ' only-death' : ''}`}
                    onClick={() => pickDay(date)}
                    aria-label={`${fmt.dayMonth.format(date)}${events.length ? `: ${events.map((o) => shortName(o.person)).join(', ')}` : ''}`}
                  >
                    <span className="fam-cal__num">{d}</span>
                    {events.length > 0 && (
                      <span className="fam-cal__faces">
                        {events.slice(0, events.length > 3 ? 2 : 3).map((o) => (
                          <span key={o.key} className={`fam-cal__face fam-cal__face--${o.type}`}>
                            <Avatar person={o.person} size={22} />
                          </span>
                        ))}
                        {events.length > 3 && <span className="fam-cal__more">+{events.length - 2}</span>}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="fam-cal__legend">
              <span className="fam-cal__legend-item is-birth">
                <GiftOutlined /> {t('family.calendar.births')}
              </span>
              <span className="fam-cal__legend-item is-death">
                <MemoryIcon /> {t('family.calendar.memorials')}
              </span>
            </div>
          </section>

          <section className="fam-cal__agenda" ref={agendaRef} aria-label={cap(fmt.month.format(new Date(cursor.y, cursor.m, 1)))}>
            {agenda.length ? (
              agenda.map(([d, events]) => {
                const date = new Date(cursor.y, cursor.m, d);
                const inDays = daysBetween(today, date);
                return (
                  <div key={d} data-day={d} className={`fam-cal__day${day === d ? ' is-picked' : ''}${inDays === 0 ? ' is-today' : ''}${inDays < 0 ? ' is-past' : ''}`}>
                    <div className="fam-cal__badge">
                      <span className="fam-cal__badge-num">{d}</span>
                      <span className="fam-cal__badge-wd">{fmt.weekday.format(date)}</span>
                    </div>
                    <div className="fam-cal__events">
                      {inDays >= 0 && inDays <= 30 && <div className="fam-cal__countdown">{when(inDays)}</div>}
                      {events.map((o) => {
                        const relation = relationTo?.(o.person.id);
                        return (
                          <button
                            type="button"
                            key={o.key}
                            className={`fam-cal__event fam-cal__event--${o.type}${selectedId === o.person.id ? ' is-selected' : ''}`}
                            onClick={() => onSelect?.(o.person.id)}
                          >
                            <span className={`fam-cal__ring fam-cal__ring--small fam-cal__ring--${o.type} fam-cal__ring--${o.person.gender || 'unknown'}`}>
                              <Avatar person={o.person} size={38} />
                            </span>
                            <span className="fam-cal__event-text">
                              <span className="fam-cal__event-name">{shortName(o.person)}</span>
                              <span className="fam-cal__event-meta">
                                {relation && <span className="fam-cal__relation">{relation}</span>}
                                <span>{what(o)}</span>
                                <span className="fam-cal__year">{o.year}</span>
                              </span>
                            </span>
                            <span className={`fam-cal__type fam-cal__type--${o.type}`} title={o.type === 'birth' ? t('family.calendar.birth') : t('family.calendar.memorial')}>
                              <TypeIcon type={o.type} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="fam-cal__empty fam-cal__empty--month">
                <CalendarOutlined />
                <span>{t('family.calendar.emptyMonth')}</span>
              </div>
            )}
            {undated > 0 && <div className="fam-cal__undated">{t('family.calendar.undated', { count: undated })}</div>}
          </section>
        </div>
      </div>
    </div>
  );
}
