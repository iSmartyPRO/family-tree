import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, Drawer, Grid, Popover } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import { useLocale } from '../../../context/LocaleContext';

const FIRST_YEAR = 1700;
const DATE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

const split = (iso) => {
  const m = typeof iso === 'string' ? iso.match(DATE) : null;
  return m ? { year: Number(m[1]), month: m[2] ? Number(m[2]) : null, day: m[3] ? Number(m[3]) : null } : { year: null, month: null, day: null };
};
const daysIn = (year, month) => (month ? new Date(Date.UTC(year || 2000, month, 0)).getUTCDate() : 31);
const pad = (n) => String(n).padStart(2, '0');

/** One scrolling column; the picked item is scrolled to the middle when shown. */
function Column({ label, items, value, onPick }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const center = () => {
      const box = ref.current;
      const el = box?.querySelector('.is-on') || box?.querySelector('[data-anchor]');
      if (box && el && box.clientHeight) box.scrollTop = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
    };
    center();
    // Popovers and sheets are measured only after their opening animation starts.
    const frame = requestAnimationFrame(center);
    const timer = setTimeout(center, 120);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [value, items.length]);
  return (
    <div className="fam-dp__col">
      <div className="fam-dp__label">{label}</div>
      <div className="fam-dp__list" ref={ref} role="listbox" aria-label={label}>
        {items.map((item) => (
          <button
            key={item.value ?? 'none'}
            type="button"
            role="option"
            aria-selected={item.value === value}
            className={`fam-dp__item${item.value === value ? ' is-on' : ''}${item.value === null ? ' is-none' : ''}`}
            data-anchor={item.anchor ? '' : undefined}
            onClick={() => onPick(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Picker of a partial date: a year, a month of a year or a day. Day and month
 * may stay «unknown». `value` and `onChange` use ISO: "1950", "1950-03", "1950-03-08".
 */
function Panel({ value, onChange, onDone, monthFirst }) {
  const { t } = useLocale();
  const now = new Date().getFullYear();
  const [pick, setPick] = useState(() => split(value));
  useEffect(() => setPick(split(value)), [value]);

  const lang = typeof document !== 'undefined' ? document.documentElement.lang || 'ru' : 'ru';
  const monthNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(lang, { month: 'long' });
    return Array.from({ length: 12 }, (_, i) => {
      const name = fmt.format(new Date(Date.UTC(2000, i, 15)));
      return name.charAt(0).toUpperCase() + name.slice(1);
    });
  }, [lang]);

  const unknown = t('family.datePick.unknown');
  const years = useMemo(() => {
    const list = [];
    for (let y = now; y >= FIRST_YEAR; y -= 1) list.push({ value: y, label: String(y), anchor: !pick.year && y === now - 30 });
    return list;
  }, [now, pick.year]);
  const months = [{ value: null, label: unknown }, ...monthNames.map((name, i) => ({ value: i + 1, label: name }))];
  const days = [{ value: null, label: unknown }, ...Array.from({ length: daysIn(pick.year, pick.month) }, (_, i) => ({ value: i + 1, label: String(i + 1) }))];

  const emit = (next) => {
    const fixed = { ...next };
    if (!fixed.month) fixed.day = null;
    if (fixed.day && fixed.day > daysIn(fixed.year, fixed.month)) fixed.day = daysIn(fixed.year, fixed.month);
    setPick(fixed);
    if (!fixed.year) return;
    onChange(fixed.month ? (fixed.day ? `${fixed.year}-${pad(fixed.month)}-${pad(fixed.day)}` : `${fixed.year}-${pad(fixed.month)}`) : String(fixed.year));
  };

  const dayCol = <Column key="d" label={t('family.datePick.day')} items={days} value={pick.day} onPick={(day) => emit({ ...pick, day, month: pick.month || (day ? 1 : null) })} />;
  const monthCol = <Column key="m" label={t('family.datePick.month')} items={months} value={pick.month} onPick={(month) => emit({ ...pick, month })} />;
  const yearCol = <Column key="y" label={t('family.datePick.year')} items={years} value={pick.year} onPick={(year) => emit({ ...pick, year })} />;

  return (
    <div className="fam-dp">
      <div className="fam-dp__cols">{monthFirst ? [monthCol, dayCol, yearCol] : [dayCol, monthCol, yearCol]}</div>
      <div className="fam-dp__foot">
        <Button
          type="text"
          onClick={() => {
            setPick({ year: null, month: null, day: null });
            onChange('');
            onDone();
          }}
        >
          {t('family.datePick.clear')}
        </Button>
        <Button type="primary" onClick={onDone}>
          {t('family.datePick.done')}
        </Button>
      </div>
    </div>
  );
}

/** Calendar button for a PartialDate field: a popover on wide screens, a bottom sheet on phones. */
export default function DatePick({ value, onChange, monthFirst }) {
  const { t } = useLocale();
  const phone = Grid.useBreakpoint().sm === false;
  const [open, setOpen] = useState(false);
  const panel = <Panel value={value} onChange={onChange} onDone={() => setOpen(false)} monthFirst={monthFirst} />;
  const button = (onClick) => (
    <button type="button" className="fam-dp__btn" aria-label={t('family.datePick.open')} title={t('family.datePick.open')} onClick={onClick}>
      <CalendarOutlined />
    </button>
  );
  if (phone) {
    return (
      <>
        {button(() => setOpen(true))}
        <Drawer open={open} onClose={() => setOpen(false)} placement="bottom" height="auto" title={t('family.datePick.title')} className="fam-dp-sheet" destroyOnHidden>
          {panel}
        </Drawer>
      </>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen} trigger="click" placement="bottomRight" content={panel} destroyOnHidden overlayClassName="fam-dp-pop">
      {button()}
    </Popover>
  );
}
