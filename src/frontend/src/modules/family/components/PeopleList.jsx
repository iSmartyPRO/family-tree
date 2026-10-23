import { useMemo, useState } from 'react';
import { Input, Progress, Table, Tooltip } from 'antd';
import { CheckOutlined, ManOutlined, MinusOutlined, QuestionOutlined, SearchOutlined, WomanOutlined } from '@ant-design/icons';
import { useLocale } from '../../../context/LocaleContext';
import { useRegional } from '../../../lib/datetime';
import { displayName, formatPartial, searchText } from '../format';
import { Avatar } from './TreeCanvas';

/*
 * What is known about a person. Each check is one point of the "filled in"
 * score; death details count only for the deceased, contacts only for the living.
 */
const CHECKS = [
  { key: 'photo', test: (p) => Boolean(p.photoUrl) },
  { key: 'names', test: (p) => Boolean(p.firstName && p.lastName) },
  { key: 'gender', test: (p) => p.gender !== 'unknown' },
  { key: 'birthDate', test: (p) => Boolean(p.birthDate) },
  { key: 'birthPlace', test: (p) => Boolean(p.birthPlace) },
  { key: 'parents', test: (p, k) => k.parents > 0 },
  { key: 'death', test: (p) => Boolean(p.deathDate), applies: (p) => !p.isAlive },
  { key: 'contacts', test: (p) => Object.values(p.contacts || {}).some(Boolean), applies: (p) => p.isAlive },
  { key: 'bio', test: (p) => Boolean(p.bio || p.occupation) },
];

export function completeness(person, kin) {
  const checks = CHECKS.filter((c) => !c.applies || c.applies(person)).map((c) => ({ key: c.key, ok: c.test(person, kin) }));
  const done = checks.filter((c) => c.ok).length;
  return { checks, percent: Math.round((done / checks.length) * 100) };
}

const GENDER_ICON = { male: <ManOutlined />, female: <WomanOutlined />, unknown: <QuestionOutlined /> };

/** Everyone in the tree as a table: what is known and what is missing. */
export default function PeopleList({ data, selectedId, onSelect, onOpen }) {
  const { t } = useLocale();
  const regional = useRegional();
  const [query, setQuery] = useState('');
  const [missing, setMissing] = useState(null);

  const rows = useMemo(() => {
    const parents = new Map();
    const children = new Map();
    const partners = new Map();
    for (const l of data.parents) {
      parents.set(l.childId, (parents.get(l.childId) || 0) + 1);
      children.set(l.parentId, (children.get(l.parentId) || 0) + 1);
    }
    for (const u of data.unions) {
      partners.set(u.partnerA, (partners.get(u.partnerA) || 0) + 1);
      partners.set(u.partnerB, (partners.get(u.partnerB) || 0) + 1);
    }
    return data.persons.map((p) => {
      const kin = { parents: parents.get(p.id) || 0, children: children.get(p.id) || 0, partners: partners.get(p.id) || 0 };
      return { key: p.id, person: p, kin, ...completeness(p, kin), search: searchText(p) };
    });
  }, [data]);

  // How many people miss each item: the chips double as filters.
  const gaps = useMemo(
    () =>
      CHECKS.map((c) => ({
        key: c.key,
        count: rows.filter((r) => r.checks.some((x) => x.key === c.key && !x.ok)).length,
      })).filter((g) => g.count > 0),
    [rows]
  );
  const average = rows.length ? Math.round(rows.reduce((s, r) => s + r.percent, 0) / rows.length) : 0;

  const shown = rows.filter((r) => {
    if (query && !r.search.includes(query.trim().toLowerCase())) return false;
    if (missing && !r.checks.some((c) => c.key === missing && !c.ok)) return false;
    return true;
  });

  const date = (value) => formatPartial(value, regional.dateFormat);

  const columns = [
    {
      title: t('family.list.person'),
      key: 'person',
      sorter: (a, b) => displayName(a.person).localeCompare(displayName(b.person)),
      render: (_, r) => (
        <span className="fam-list-person">
          <Avatar person={r.person} size={34} />
          <span className="fam-list-person__text">
            <b>{displayName(r.person, { withPatronymic: true })}</b>
            {r.person.maidenName && <span>{t('family.panel.born', { name: r.person.maidenName })}</span>}
          </span>
        </span>
      ),
    },
    {
      title: t('family.form.gender'),
      key: 'gender',
      width: 84,
      align: 'center',
      render: (_, r) => (
        <Tooltip title={t(`family.gender.${r.person.gender}`)}>
          <span className={`fam-list-gender fam-list-gender--${r.person.gender}`}>{GENDER_ICON[r.person.gender]}</span>
        </Tooltip>
      ),
    },
    {
      title: t('family.list.born'),
      key: 'born',
      sorter: (a, b) => String(a.person.birthDate || '9999').localeCompare(String(b.person.birthDate || '9999')),
      defaultSortOrder: null,
      render: (_, r) => (
        <span className="fam-list-life">
          {r.person.birthDate ? date(r.person.birthDate) : <span className="fam-list-none">—</span>}
          {r.person.birthPlace && <small>{r.person.birthPlace}</small>}
        </span>
      ),
    },
    {
      title: t('family.list.died'),
      key: 'died',
      responsive: ['md'],
      render: (_, r) =>
        r.person.isAlive ? (
          <span className="fam-list-alive">{t('family.form.alive')}</span>
        ) : (
          <span className="fam-list-life">
            {r.person.deathDate ? date(r.person.deathDate) : '?'}
            {r.person.deathPlace && <small>{r.person.deathPlace}</small>}
          </span>
        ),
    },
    {
      title: t('family.list.relatives'),
      key: 'kin',
      responsive: ['lg'],
      render: (_, r) => (
        <span className="fam-list-kin">
          <Tooltip title={t('family.panel.parents')}>
            <span className={r.kin.parents ? '' : 'is-zero'}>↑ {r.kin.parents}</span>
          </Tooltip>
          <Tooltip title={t('family.panel.partners')}>
            <span className={r.kin.partners ? '' : 'is-zero'}>⚭ {r.kin.partners}</span>
          </Tooltip>
          <Tooltip title={t('family.panel.children')}>
            <span className={r.kin.children ? '' : 'is-zero'}>↓ {r.kin.children}</span>
          </Tooltip>
        </span>
      ),
    },
    {
      title: t('family.list.data'),
      key: 'data',
      render: (_, r) => (
        <span className="fam-list-checks">
          {r.checks.map((c) => (
            <Tooltip key={c.key} title={`${t(`family.list.check.${c.key}`)}: ${c.ok ? t('family.list.yes') : t('family.list.no')}`}>
              <span className={`fam-check${c.ok ? ' is-ok' : ''}`}>{c.ok ? <CheckOutlined /> : <MinusOutlined />}</span>
            </Tooltip>
          ))}
        </span>
      ),
    },
    {
      title: t('family.list.filled'),
      key: 'percent',
      width: 140,
      sorter: (a, b) => a.percent - b.percent,
      render: (_, r) => <Progress percent={r.percent} size="small" status={r.percent >= 80 ? 'success' : 'normal'} className="fam-list-progress" />,
    },
  ];

  return (
    <div className="fam-people" data-tour="family.list">
      <div className="fam-people__summary">
        <div className="fam-people__score">
          <Progress type="circle" percent={average} size={64} />
          <div>
            <b>{t('family.list.average')}</b>
            <span>{t('family.list.averageText')}</span>
          </div>
        </div>
        <div className="fam-people__gaps">
          <button type="button" className={`fam-gap${!missing ? ' is-active' : ''}`} onClick={() => setMissing(null)}>
            {t('family.list.all', { count: rows.length })}
          </button>
          {gaps.map((g) => (
            <button key={g.key} type="button" className={`fam-gap${missing === g.key ? ' is-active' : ''}`} onClick={() => setMissing(missing === g.key ? null : g.key)}>
              {t(`family.list.missing.${g.key}`)} <b>{g.count}</b>
            </button>
          ))}
        </div>
        <Input prefix={<SearchOutlined />} allowClear placeholder={t('family.searchPlaceholder')} value={query} onChange={(e) => setQuery(e.target.value)} className="fam-people__search" />
      </div>
      <Table
        size="middle"
        columns={columns}
        dataSource={shown}
        pagination={false}
        sticky
        rowClassName={(r) => (r.key === selectedId ? 'is-selected' : '')}
        onRow={(r) => ({
          onClick: () => onSelect(r.key),
          onDoubleClick: () => onOpen?.(r.key),
        })}
        locale={{ emptyText: t('family.list.empty') }}
      />
    </div>
  );
}
