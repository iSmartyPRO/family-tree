import { useMemo, useRef, useState } from 'react';
import { App, Alert, Button, Dropdown, Popconfirm, Tooltip } from 'antd';
import {
  FilterOutlined,
  ZoomInOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  CloseOutlined,
  DeleteOutlined,
  DisconnectOutlined,
  EditOutlined,
  EnvironmentOutlined,
  HomeOutlined,
  LinkOutlined,
  MailOutlined,
  PhoneOutlined,
  PlusOutlined,
  ShopOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useLocale } from '../../../context/LocaleContext';
import { useRegional } from '../../../lib/datetime';
import { errorMessage } from '../../../lib/errors';
import { familyApi } from '../api';
import { ageOf, displayName, formatPartial, lifeYears, maybeDeceased, shortName, wouldBeNow } from '../format';
import { kinOf, missingParentSuggestion } from '../kin';
import { familiesOf, unionState } from '../layout';
import { Avatar } from './TreeCanvas';
import PhotoViewer from './PhotoViewer';

function contactHref(key, value) {
  const v = String(value).trim();
  const handle = v.replace(/^@/, '');
  switch (key) {
    case 'phone':
      return `tel:${v.replace(/[^\d+]/g, '')}`;
    case 'email':
      return `mailto:${v}`;
    case 'whatsapp':
      return `https://wa.me/${v.replace(/\D/g, '')}`;
    case 'telegram':
      return /^https?:/.test(v) ? v : `https://t.me/${handle}`;
    case 'instagram':
      return /^https?:/.test(v) ? v : `https://instagram.com/${handle}`;
    default:
      return /^https?:\/\//i.test(v) ? v : null;
  }
}

function Relative({ person, note, onOpen, onUnlink, canEdit, t, children }) {
  return (
    <div className="fam-rel">
      <button type="button" className="fam-rel__main" onClick={() => onOpen(person.id)}>
        <Avatar person={person} size={34} />
        <span className="fam-rel__text">
          <span className="fam-rel__name">{displayName(person)}</span>
          {note && <span className="fam-rel__note">{note}</span>}
        </span>
      </button>
      {children}
      {canEdit && onUnlink && (
        <Popconfirm title={t('family.panel.unlinkConfirm')} okText={t('family.panel.unlink')} cancelText={t('common.cancel')} onConfirm={onUnlink}>
          <Tooltip title={t('family.panel.unlink')}>
            <Button type="text" size="small" icon={<DisconnectOutlined />} aria-label={t('family.panel.unlink')} />
          </Tooltip>
        </Popconfirm>
      )}
    </div>
  );
}

/** Details of the selected person, their relatives and what can be done. */
export default function PersonPanel({ index, fullIndex, onShowAll, personId, treeId, canEdit, canManage, homeId, onClose, onSelect, onEdit, onAdd, onLink, onChanged, onSetHome, onUnion, relation, isMe, onSetMe, extraActions }) {
  const { t } = useLocale();
  const { message, modal } = App.useApp();
  const regional = useRegional();
  const person = index.persons.get(personId);
  const kin = useMemo(() => (person ? kinOf(index, personId) : null), [index, personId, person]);
  // With a view on, the panel shows only its people; limits and the «hidden»
  // note come from the whole tree.
  const filtered = Boolean(fullIndex && fullIndex !== index);
  const fullKin = useMemo(() => (person && filtered ? kinOf(fullIndex, personId) : kin), [filtered, fullIndex, personId, person, kin]);
  const hiddenCount = useMemo(() => {
    if (!filtered || !fullKin) return 0;
    const all = new Set([...fullKin.parents, ...fullKin.partners, ...fullKin.children, ...fullKin.siblings].map((k) => k.person.id));
    return [...all].filter((id) => !index.persons.has(id)).length;
  }, [filtered, fullKin, index]);
  const suggestion = useMemo(() => (person && canEdit ? missingParentSuggestion(index, personId) : null), [index, personId, person, canEdit]);
  const portraitRef = useRef(null);
  const [viewing, setViewing] = useState(false);
  if (!person || !kin) return null;

  // The person's families in drawing order (same rules as the tree).
  const families = familiesOf([...index.persons.values()], index.parentLinks, index.unions, person.id);
  const saveOrder = (order) =>
    run(() => familyApi.updatePerson(person.id, { familyOrder: order }), order.length ? t('family.families.saved') : t('family.families.autoSet'));
  const moveFamily = (i, delta) => {
    const order = families.map((f) => f.partner ?? 0);
    const [item] = order.splice(i, 1);
    order.splice(i + delta, 0, item);
    saveOrder(order);
  };

  const run = async (fn, ok) => {
    try {
      await fn();
      if (ok) message.success(ok);
      onChanged?.();
    } catch (err) {
      message.error(errorMessage(err));
    }
  };

  const age = ageOf(person);
  const date = (value) => formatPartial(value, regional.dateFormat);
  const roleOf = (p, kind) => t(`family.role.${kind}.${p.gender === 'male' ? 'male' : p.gender === 'female' ? 'female' : 'unknown'}`);
  const contacts = Object.entries(person.contacts || {}).filter(([, v]) => v);

  const addItems = [
    fullKin.parents.length < 2 && { key: 'parent', label: t('family.add.parent') },
    { key: 'child', label: t('family.add.child') },
    { key: 'partner', label: t('family.add.partner') },
    { key: 'sibling', label: t('family.add.sibling') },
  ].filter(Boolean);
  const linkItems = [
    fullKin.parents.length < 2 && { key: 'parent', label: t('family.link.asParent') },
    { key: 'child', label: t('family.link.asChild') },
    { key: 'partner', label: t('family.link.asPartner') },
  ].filter(Boolean);

  const remove = () =>
    modal.confirm({
      title: t('family.panel.deleteTitle', { name: shortName(person) }),
      content: t('family.panel.deleteText'),
      okText: t('common.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      onOk: () =>
        run(async () => {
          await familyApi.deletePerson(person.id);
          onClose();
        }, t('family.panel.deleted')),
    });

  return (
    <aside className="fam-panel" data-tour="family.panel">
      <div className="fam-panel__head">
        <Button type="text" icon={<CloseOutlined />} onClick={onClose} aria-label={t('common.close')} className="fam-panel__close" />
        {person.photoUrl ? (
          <button
            type="button"
            ref={portraitRef}
            className="fam-panel__portrait is-photo"
            onClick={() => setViewing(true)}
            aria-label={t('family.photo.open')}
            title={t('family.photo.open')}
          >
            <Avatar person={person} size={104} className="fam-panel__avatar" />
            {!person.isAlive && <span className="fam-mourning fam-mourning--lg" aria-label={t('family.deceased')} />}
            <span className="fam-panel__zoom" aria-hidden="true">
              <ZoomInOutlined />
            </span>
          </button>
        ) : (
          <span className="fam-panel__portrait">
            <Avatar person={person} size={104} className="fam-panel__avatar" />
            {!person.isAlive && <span className="fam-mourning fam-mourning--lg" aria-label={t('family.deceased')} />}
          </span>
        )}
        <PhotoViewer
          open={viewing && Boolean(person.photoUrl)}
          src={person.photoFullUrl || person.photoUrl}
          thumb={person.photoUrl}
          from={portraitRef.current?.querySelector('.fam-avatar')}
          title={displayName(person, { withPatronymic: true })}
          subtitle={[lifeYears(person), age !== null ? (person.isAlive ? t('family.panel.age', { count: age }) : t('family.panel.ageAtDeath', { count: age })) : null].filter(Boolean).join(' · ')}
          note={isMe ? t('family.me.thisIsYou') : relation}
          onClose={() => setViewing(false)}
        />
        <h2 className="fam-panel__name">{displayName(person, { withPatronymic: true })}</h2>
        {(isMe || relation) && <div className={`fam-panel__kin${isMe ? ' is-me' : ''}`}>{isMe ? t('family.me.thisIsYou') : relation}</div>}
        {person.maidenName && <div className="fam-panel__maiden">{t('family.panel.born', { name: person.maidenName })}</div>}
        <div className="fam-panel__life">
          {person.birthDate && <span>{date(person.birthDate)}</span>}
          {!person.isAlive && <span>— {person.deathDate ? date(person.deathDate) : '?'}</span>}
          {age !== null && <span className="fam-chip">{person.isAlive ? t('family.panel.age', { count: age }) : t('family.panel.ageAtDeath', { count: age })}</span>}
          {!person.isAlive && !age && <span className="fam-chip">{t('family.deceased')}</span>}
          {wouldBeNow(person) !== null && <span className="fam-panel__would">{t('family.panel.wouldBe', { count: wouldBeNow(person) })}</span>}
        </div>
        {!canEdit && extraActions && <div className="fam-panel__actions">{extraActions}</div>}
        {!canEdit && onSetMe && (
          <div className="fam-panel__actions">
            <Button icon={<UserOutlined />} onClick={() => onSetMe(isMe ? null : person.id)}>
              {isMe ? t('family.me.notMe') : t('family.me.isMe')}
            </Button>
          </div>
        )}
        {canEdit && (
          <div className="fam-panel__actions">
            <Button type="primary" icon={<EditOutlined />} onClick={() => onEdit(person)}>
              {t('common.edit')}
            </Button>
            <Dropdown menu={{ items: addItems, onClick: ({ key }) => onAdd(person.id, key) }} trigger={['click']}>
              <Button icon={<PlusOutlined />}>{t('family.panel.addRelative')}</Button>
            </Dropdown>
            <Dropdown
              menu={{
                items: [
                  ...linkItems.map((item) => ({ ...item, key: `link:${item.key}`, icon: <LinkOutlined /> })),
                  { type: 'divider' },
                  onSetMe && { key: 'me', icon: <UserOutlined />, label: isMe ? t('family.me.notMe') : t('family.me.isMe') },
                  canManage && { key: 'home', icon: <HomeOutlined />, label: homeId === person.id ? t('family.panel.isHome') : t('family.panel.setHome'), disabled: homeId === person.id },
                  { key: 'delete', icon: <DeleteOutlined />, label: t('family.panel.delete'), danger: true },
                ].filter(Boolean),
                onClick: ({ key }) => {
                  if (key.startsWith('link:')) onLink(person.id, key.slice(5));
                  else if (key === 'home') onSetHome(person.id);
                  else if (key === 'me') onSetMe(isMe ? null : person.id);
                  else if (key === 'delete') remove();
                },
              }}
              trigger={['click']}
            >
              <Button className="fam-panel__more" aria-label={t('common.moreActions')}>⋯</Button>
            </Dropdown>
          </div>
        )}
      </div>

      <div className="fam-panel__body">
        {maybeDeceased(person) && (
          <Alert
            type="warning"
            showIcon
            className="fam-panel__suggest"
            message={t('family.panel.maybeDeceased', { count: ageOf(person) })}
            action={
              canEdit && (
                <Button size="small" onClick={() => onEdit(person)}>
                  {t('common.edit')}
                </Button>
              )
            }
          />
        )}
        {suggestion && (
          <Alert
            type="info"
            showIcon
            className="fam-panel__suggest"
            message={t('family.panel.suggestParent', { parent: shortName(suggestion.parent), partner: shortName(suggestion.partner) })}
            action={
              <Button size="small" type="primary" onClick={() => run(() => familyApi.addParent(treeId, { childId: person.id, parentId: suggestion.partner.id }), t('family.panel.linked'))}>
                {t('family.panel.link')}
              </Button>
            }
          />
        )}

        {(person.birthPlace || person.deathPlace || person.occupation) && (
          <section className="fam-facts">
            {person.birthPlace && (
              <div>
                <EnvironmentOutlined /> <span className="fam-facts__label">{t('family.form.birthPlace')}</span> {person.birthPlace}
              </div>
            )}
            {!person.isAlive && person.deathPlace && (
              <div>
                <EnvironmentOutlined /> <span className="fam-facts__label">{t('family.form.deathPlace')}</span> {person.deathPlace}
              </div>
            )}
            {person.occupation && (
              <div>
                <ShopOutlined /> <span className="fam-facts__label">{t('family.form.occupation')}</span> {person.occupation}
              </div>
            )}
          </section>
        )}

        {contacts.length > 0 && (
          <section className="fam-contacts">
            {contacts.map(([key, value]) => {
              const href = contactHref(key, value);
              const icon = key === 'phone' ? <PhoneOutlined /> : key === 'email' ? <MailOutlined /> : <LinkOutlined />;
              return href ? (
                <a key={key} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="fam-contact">
                  {icon}
                  <span>{t(`family.contact.${key}`)}</span>
                  <b>{value}</b>
                </a>
              ) : (
                <span key={key} className="fam-contact">
                  {icon}
                  <span>{t(`family.contact.${key}`)}</span>
                  <b>{value}</b>
                </span>
              );
            })}
          </section>
        )}

        {person.bio && <p className="fam-bio">{person.bio}</p>}

        {families.length > 1 && (
          <section className="fam-kin fam-families">
            <h3>
              {t('family.families.title')} <span className="fam-count">{families.length}</span>
            </h3>
            {families.map((f, i) => {
              const partner = f.partner ? index.persons.get(f.partner) : null;
              return (
                <div key={f.partner ?? 0} className="fam-family">
                  <span className="fam-family__n">{i + 1}</span>
                  <span className="fam-family__text">
                    <b>{partner ? shortName(partner) : t(`family.ghost.${person.gender === 'male' ? 'mother' : person.gender === 'female' ? 'father' : 'parent'}`)}</b>
                    <span>{f.kids.map((k) => index.persons.get(k)?.firstName).filter(Boolean).join(', ') || t('family.families.noKids')}</span>
                  </span>
                  {canEdit && !filtered && (
                    <span className="fam-family__move">
                      <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => moveFamily(i, -1)} aria-label={t('family.families.up')} />
                      <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={i === families.length - 1} onClick={() => moveFamily(i, 1)} aria-label={t('family.families.down')} />
                    </span>
                  )}
                </div>
              );
            })}
            {canEdit && person.familyOrder?.length > 0 && (
              <Button type="link" size="small" onClick={() => saveOrder([])} className="fam-families__auto">
                {t('family.families.auto')}
              </Button>
            )}
            {canEdit && !filtered && !person.familyOrder?.length && <p className="fam-hint">{t('family.families.hint')}</p>}
          </section>
        )}

        {kin.parents.length > 0 && (
          <section className="fam-kin">
            <h3>{t('family.panel.parents')}</h3>
            {kin.parents.map(({ link, person: p }) => (
              <Relative
                key={link.id}
                person={p}
                note={roleOf(p, 'parent')}
                onOpen={onSelect}
                canEdit={canEdit}
                t={t}
                onUnlink={() => run(() => familyApi.removeParent(link.id), t('family.panel.unlinked'))}
              />
            ))}
          </section>
        )}

        {kin.partners.length > 0 && (
          <section className="fam-kin">
            <h3>{t('family.panel.partners')}</h3>
            {kin.partners.map(({ union, person: p }) => (
              <Relative
                key={union.id}
                person={p}
                onOpen={onSelect}
                canEdit={canEdit}
                t={t}
                onUnlink={() => run(() => familyApi.removeUnion(union.id), t('family.panel.unlinked'))}
              >
                {canEdit ? (
                  <Tooltip title={t('family.union.edit')}>
                    <button type="button" className="fam-rel__union" onClick={() => onUnion?.(union, `${shortName(person)} & ${shortName(p)}`)}>
                      <span>
                        {unionState(union, person, p) === 'widowed' && union.status !== 'widowed' ? t('family.union.byDeath') : t(`family.status.${union.status}`)}
                      </span>
                      {union.startDate && <b>{formatPartial(union.startDate, regional.dateFormat)}</b>}
                    </button>
                  </Tooltip>
                ) : (
                  <span className="fam-rel__note">
                    {unionState(union, person, p) === 'widowed' && union.status !== 'widowed' ? t('family.union.byDeath') : t(`family.status.${union.status}`)}
                    {union.startDate ? ` · ${formatPartial(union.startDate, regional.dateFormat)}` : ''}
                  </span>
                )}
              </Relative>
            ))}
          </section>
        )}

        {kin.children.length > 0 && (
          <section className="fam-kin">
            <h3>
              {t('family.panel.children')} <span className="fam-count">{kin.children.length}</span>
            </h3>
            {kin.children.map(({ link, person: p }) => (
              <Relative
                key={link.id}
                person={p}
                note={roleOf(p, 'child')}
                onOpen={onSelect}
                canEdit={canEdit}
                t={t}
                onUnlink={() => run(() => familyApi.removeParent(link.id), t('family.panel.unlinked'))}
              />
            ))}
          </section>
        )}

        {kin.siblings.length > 0 && (
          <section className="fam-kin">
            <h3>
              {t('family.panel.siblings')} <span className="fam-count">{kin.siblings.length}</span>
            </h3>
            {kin.siblings.map(({ person: p, half }) => (
              <Relative key={p.id} person={p} note={half ? t('family.panel.halfSibling') : roleOf(p, 'sibling')} onOpen={onSelect} t={t} />
            ))}
          </section>
        )}

        {!kin.parents.length && !kin.partners.length && !kin.children.length && !hiddenCount && (
          <div className="fam-empty-kin">{t('family.panel.noRelatives')}</div>
        )}
        {hiddenCount > 0 && (
          <div className="fam-hidden-kin">
            <FilterOutlined />
            <span>{t('family.panel.hiddenByView', { count: hiddenCount })}</span>
            {onShowAll && (
              <Button size="small" type="link" onClick={() => onShowAll(person.id)}>
                {t('family.panel.showInWhole')}
              </Button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
