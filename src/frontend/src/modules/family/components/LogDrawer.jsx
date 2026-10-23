import { useCallback, useEffect, useRef, useState } from 'react';
import { App, Button, Drawer, Empty, Segmented, Select, Spin, Tooltip } from 'antd';
import {
  CameraOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  LinkOutlined,
  LoginOutlined,
  SendOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useLocale } from '../../../context/LocaleContext';
import { fmtDate, fmtTime } from '../../../lib/datetime';
import { errorMessage } from '../../../lib/errors';
import { familyApi } from '../api';

const ICON = {
  'link.open': <EyeOutlined />,
  'link.hello': <LoginOutlined />,
  'link.clone': <LinkOutlined />,
  'person.create': <UserAddOutlined />,
  'person.delete': <DeleteOutlined />,
  'photo.set': <CameraOutlined />,
  'photo.remove': <CameraOutlined />,
  'suggest.photo': <CameraOutlined />,
  'edit.photo': <CameraOutlined />,
  'access.update': <TeamOutlined />,
};
const iconOf = (action) =>
  ICON[action] || (action.startsWith('suggest.') ? <SendOutlined /> : action.startsWith('share.') ? <LinkOutlined /> : <EditOutlined />);
const tone = (action) =>
  action.startsWith('link.') ? 'visit' : action.startsWith('suggest.') ? 'suggest' : action.startsWith('edit.') ? 'edit' : action.endsWith('.delete') || action.endsWith('.remove') || action === 'share.revoke' ? 'remove' : 'member';

/** t() with a fallback for keys that may not exist (older or future actions). */
const tt = (t, key, fallback) => {
  const value = t(key);
  return value === key ? fallback : value;
};

/** What changed, in words: field names of the person form, statuses, formats. */
function Details({ entry, t }) {
  const d = entry.details || {};
  const parts = [];
  if (Array.isArray(d.fields) && d.fields.length) {
    parts.push(
      d.fields
        .filter((f) => !['relation', 'familyOrder'].includes(f))
        .map((f) => tt(t, `family.form.${f}`, f))
        .join(', ')
    );
    if (d.fields.includes('familyOrder')) parts.push(t('family.families.title'));
  }
  if (d.parent) parts.push(`${t('family.log.parent')}: ${d.parent}`);
  if (d.partner) parts.push(`${t('family.log.partner')}: ${d.partner}`);
  if (d.status) parts.push(t(`family.status.${d.status}`));
  if (d.relation) parts.push(t(`family.add.${d.relation}`));
  if (d.of) parts.push(`${t('family.log.of')}: ${d.of}`);
  if (d.name) parts.push(`«${d.name}»`);
  if (d.format) parts.push(d.format.toUpperCase());
  if (d.access) parts.push(t(`family.share.level.${d.access}`));
  if (d.author) parts.push(`${t('family.log.from')}: ${d.author}`);
  if (typeof d.persons === 'number') parts.push(t('family.peopleCount', { count: d.persons }));
  const text = parts.filter(Boolean).join(' · ');
  return text ? <div className="fam-log__details">{text}</div> : null;
}

/** Activity log of the tree: members' actions and link visitors' opens, proposals and edits. */
export default function LogDrawer({ open, treeId, onClose, onPerson }) {
  const { t } = useLocale();
  const { message } = App.useApp();
  const [who, setWho] = useState('all');
  const [shareId, setShareId] = useState(null);
  const [shares, setShares] = useState([]);
  const [entries, setEntries] = useState(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  // Only the latest request may fill the list (filters change while loading).
  const seq = useRef(0);

  // Another tree: its own filters.
  useEffect(() => {
    setWho('all');
    setShareId(null);
  }, [treeId]);

  const load = useCallback(
    async (before) => {
      const mine = ++seq.current;
      setBusy(true);
      try {
        const { data } = await familyApi.log(treeId, { who, shareId: shareId || undefined, before });
        if (mine !== seq.current) return;
        setEntries((prev) => (before ? [...(prev || []), ...data.entries] : data.entries));
        setMore(data.more);
      } catch (err) {
        if (mine === seq.current) message.error(errorMessage(err));
      } finally {
        if (mine === seq.current) setBusy(false);
      }
    },
    [treeId, who, shareId, message]
  );
  useEffect(() => {
    if (!open) return;
    setEntries(null);
    load();
  }, [open, load]);
  useEffect(() => {
    if (open) familyApi.shares(treeId).then((r) => setShares(r.data.shares)).catch(() => setShares([]));
  }, [open, treeId]);

  let lastDay = null;
  return (
    <Drawer open={open} onClose={onClose} width={560} title={t('family.log.title')} className="fam-log" destroyOnHidden>
      <div className="fam-log__filters">
        <Segmented
          value={who}
          onChange={setWho}
          options={[
            { value: 'all', label: t('family.log.all') },
            { value: 'members', label: t('family.log.members') },
            { value: 'visitors', label: t('family.log.visitors') },
          ]}
        />
        <Select
          allowClear
          placeholder={t('family.log.anyLink')}
          value={shareId}
          onChange={setShareId}
          style={{ minWidth: 200 }}
          options={shares.map((s) => ({ value: s.id, label: s.title || s.viewName || t('family.views.whole') }))}
        />
      </div>
      {!entries ? (
        <div className="page-fallback">
          <Spin />
        </div>
      ) : !entries.length ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('family.log.empty')} />
      ) : (
        <div className="fam-log__list">
          {entries.map((e) => {
            const day = fmtDate(e.at);
            const head = day !== lastDay ? <div className="fam-log__day">{day}</div> : null;
            lastDay = day;
            const actor = e.user ? e.user.name : e.visitor?.name || t('family.log.anonymous');
            return (
              <div key={e.id}>
                {head}
                <div className={`fam-log__row is-${tone(e.action)}`}>
                  <span className="fam-log__icon">{iconOf(e.action)}</span>
                  <div className="fam-log__body">
                    <div className="fam-log__line">
                      <b>{actor}</b>
                      {e.visitor?.phone && (
                        <a href={`tel:${e.visitor.phone.replace(/[^\d+]/g, '')}`} className="fam-log__phone">
                          {e.visitor.phone}
                        </a>
                      )}
                      <span>{tt(t, `family.log.action.${e.action}`, e.action)}</span>
                      {e.personName && (
                        <button type="button" className="fam-log__person" onClick={() => e.personId && onPerson?.(e.personId)}>
                          {e.personName}
                        </button>
                      )}
                    </div>
                    <Details entry={e} t={t} />
                    <div className="fam-log__meta">
                      <span>{fmtTime(e.at)}</span>
                      {e.share && (
                        <span>
                          <LinkOutlined /> {e.share.title || t('family.views.whole')}
                        </span>
                      )}
                      {e.ip && (
                        <Tooltip title={e.userAgent}>
                          <span>IP {e.ip}</span>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {more && (
            <Button block onClick={() => load(entries[entries.length - 1].id)} loading={busy}>
              {t('family.log.more')}
            </Button>
          )}
        </div>
      )}
    </Drawer>
  );
}
