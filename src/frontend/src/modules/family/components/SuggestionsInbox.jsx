import { useCallback, useEffect, useState } from 'react';
import { App, Button, Drawer, Empty, Segmented, Spin, Tag } from 'antd';
import { CheckOutlined, CloseOutlined, LinkOutlined } from '@ant-design/icons';
import { useLocale } from '../../../context/LocaleContext';
import { fmtSmart, useRegional } from '../../../lib/datetime';
import { errorMessage } from '../../../lib/errors';
import { familyApi } from '../api';
import { displayName, formatPartial } from '../format';
import { Avatar } from './TreeCanvas';

const DATE_FIELDS = ['birthDate', 'deathDate'];

function Value({ field, value, t, dateFormat }) {
  if (value === null || value === undefined || value === '') return <span className="fam-diff__empty">—</span>;
  if (field === 'gender') return t(`family.gender.${value}`);
  if (field === 'isAlive') return value ? t('family.form.alive') : t('family.form.dead');
  if (DATE_FIELDS.includes(field)) return formatPartial(value, dateFormat);
  return String(value);
}

function Diff({ s, persons, t, dateFormat }) {
  const current = persons.get(s.personId) || {};
  if (s.kind === 'photo') {
    return (
      <div className="fam-diff fam-diff--photo">
        <Avatar person={s.person || current} size={64} />
        <span className="fam-diff__arrow">→</span>
        {s.photoUrl ? <img src={s.photoUrl} alt="" className="fam-diff__photo" /> : <span className="fam-diff__empty">—</span>}
      </div>
    );
  }
  if (s.kind === 'relative') {
    const p = s.payload.person || {};
    return (
      <div className="fam-diff">
        <div className="fam-diff__new">
          <Tag color="green">{t(`family.add.${s.payload.relation?.type}`)}</Tag>
          <b>{displayName(p, { withPatronymic: true })}</b>
          {p.birthDate && <span>{formatPartial(p.birthDate, dateFormat)}</span>}
          {p.birthPlace && <span>{p.birthPlace}</span>}
        </div>
      </div>
    );
  }
  return (
    <div className="fam-diff">
      {Object.entries(s.payload).map(([field, value]) => (
        <div key={field} className="fam-diff__row">
          <span className="fam-diff__field">{t(`family.form.${field}`)}</span>
          <span className="fam-diff__old">
            <Value field={field} value={current[field]} t={t} dateFormat={dateFormat} />
          </span>
          <span className="fam-diff__arrow">→</span>
          <span className="fam-diff__nv">
            <Value field={field} value={value} t={t} dateFormat={dateFormat} />
          </span>
        </div>
      ))}
    </div>
  );
}

/** Changes visitors proposed through links: review, accept or reject. */
export default function SuggestionsInbox({ open, treeId, persons, onClose, onChanged }) {
  const { t } = useLocale();
  const { message } = App.useApp();
  const regional = useRegional();
  const [status, setStatus] = useState('pending');
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      setList((await familyApi.suggestions(treeId, status)).data.suggestions);
    } catch (err) {
      message.error(errorMessage(err));
    }
  }, [treeId, status, message]);
  useEffect(() => {
    if (open) {
      setList(null);
      load();
    }
  }, [open, load]);

  const review = async (s, accept) => {
    setBusy(s.id);
    try {
      await (accept ? familyApi.acceptSuggestion(s.id) : familyApi.rejectSuggestion(s.id));
      message.success(accept ? t('family.inbox.accepted') : t('family.inbox.rejected'));
      await load();
      onChanged?.();
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} width={520} title={t('family.inbox.title')} className="fam-inbox" destroyOnHidden>
      <Segmented
        block
        value={status}
        onChange={setStatus}
        options={[
          { value: 'pending', label: t('family.inbox.pending') },
          { value: 'done', label: t('family.inbox.done') },
        ]}
      />
      <div className="fam-inbox__list">
        {!list ? (
          <div className="page-fallback">
            <Spin />
          </div>
        ) : !list.length ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={status === 'pending' ? t('family.inbox.empty') : t('family.inbox.emptyDone')} />
        ) : (
          list.map((s) => (
            <article key={s.id} className={`fam-sugg fam-sugg--${s.status}`}>
              <header className="fam-sugg__head">
                {s.person && <Avatar person={s.person} size={36} />}
                <div>
                  <b>{s.person ? displayName(s.person, { withPatronymic: true }) : '—'}</b>
                  <span>
                    {t(`family.inbox.kind.${s.kind}`)} · {t('family.inbox.by', { name: s.authorName })}
                    {s.authorPhone ? ` · ${s.authorPhone}` : ''} · {fmtSmart(s.createdAt)}
                  </span>
                </div>
                {s.status !== 'pending' && <Tag color={s.status === 'rejected' ? 'default' : 'green'}>{t(`family.inbox.status.${s.status}`)}</Tag>}
              </header>
              <Diff s={s} persons={persons} t={t} dateFormat={regional.dateFormat} />
              {s.note && <p className="fam-sugg__note">«{s.note}»</p>}
              {s.via && (
                <div className="fam-sugg__via">
                  <LinkOutlined /> {s.via}
                </div>
              )}
              {s.status === 'pending' && (
                <footer className="fam-sugg__actions">
                  <Button icon={<CloseOutlined />} onClick={() => review(s, false)} loading={busy === s.id}>
                    {t('family.inbox.reject')}
                  </Button>
                  <Button type="primary" icon={<CheckOutlined />} onClick={() => review(s, true)} loading={busy === s.id}>
                    {t('family.inbox.accept')}
                  </Button>
                </footer>
              )}
            </article>
          ))
        )}
      </div>
    </Drawer>
  );
}
