import { useEffect, useMemo, useRef, useState } from 'react';
import { App, Button, Drawer, Input, Popconfirm, Segmented, Select, Slider, Switch } from 'antd';
import { DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import { useLocale } from '../../../context/LocaleContext';
import { errorMessage } from '../../../lib/errors';
import { familyApi } from '../api';
import { displayName, lifeYears, searchText } from '../format';
import { Avatar } from './TreeCanvas';

export const MAX_DEPTH = 12;
export const DEFAULT_FILTER = { focus: null, side: 'both', ancestors: MAX_DEPTH, descendants: MAX_DEPTH, collateral: 1, partners: true };

/** Ready-made views, built around «me» (or the chosen person). */
const PRESETS = [
  { key: 'family', icon: '🏡', filter: { side: 'both', ancestors: 1, descendants: 2, collateral: 1, partners: true } },
  { key: 'father', icon: '👨', filter: { side: 'father', ancestors: MAX_DEPTH, descendants: 1, collateral: 2, partners: true } },
  { key: 'mother', icon: '👩', filter: { side: 'mother', ancestors: MAX_DEPTH, descendants: 1, collateral: 2, partners: true } },
  { key: 'ancestors', icon: '🌳', filter: { side: 'both', ancestors: MAX_DEPTH, descendants: 0, collateral: 0, partners: true } },
  { key: 'descendants', icon: '🌱', filter: { side: 'both', ancestors: 0, descendants: MAX_DEPTH, collateral: 0, partners: true } },
  { key: 'everyone', icon: '✨', filter: { side: 'both', ancestors: MAX_DEPTH, descendants: MAX_DEPTH, collateral: 3, partners: true } },
];

function SideCard({ value, active, onClick, title, text }) {
  return (
    <button type="button" className={`fam-side fam-side--${value}${active ? ' is-active' : ''}`} onClick={onClick}>
      <span className="fam-side__art" aria-hidden="true">
        <i className="fam-side__dot fam-side__dot--m" />
        <i className="fam-side__dot fam-side__dot--f" />
        <i className="fam-side__dot fam-side__dot--c" />
      </span>
      <b>{title}</b>
      <span>{text}</span>
    </button>
  );
}

/**
 * Builds a view (a filter over the tree) with a live preview, applies it to
 * the screen or saves it under a name to reuse and share.
 */
export default function ViewBuilder({ open, treeId, data, meId, view, filter: initial, canEdit, onApply, onSaved, onDeleted, onClose }) {
  const { t } = useLocale();
  const { message } = App.useApp();
  const [filter, setFilter] = useState(DEFAULT_FILTER);
  const [name, setName] = useState('');
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const timer = useRef(0);

  useEffect(() => {
    if (!open) return;
    setFilter({ ...DEFAULT_FILTER, focus: meId || data.persons[0]?.id || null, ...(view?.filter || initial || {}) });
    setName(view?.name || '');
  }, [open, view, initial, meId, data.persons]);

  // Live preview: who the filter shows (debounced).
  useEffect(() => {
    if (!open || !filter.focus) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        setPreview((await familyApi.select(treeId, filter)).data.ids);
      } catch {
        setPreview(null);
      }
    }, 180);
    return () => clearTimeout(timer.current);
  }, [open, treeId, filter]);

  const set = (patch) => setFilter((f) => ({ ...f, ...patch }));
  const byId = useMemo(() => new Map(data.persons.map((p) => [p.id, p])), [data.persons]);
  const focus = byId.get(filter.focus);
  const people = useMemo(
    () =>
      [...data.persons]
        .sort((a, b) => displayName(a).localeCompare(displayName(b)))
        .map((p) => ({
          value: p.id,
          search: searchText(p),
          label: (
            <span className="fam-option">
              <Avatar person={p} size={22} />
              <span>
                {displayName(p)}
                {p.id === meId ? ` · ${t('family.me.you')}` : ''}
              </span>
              <span className="fam-option__years">{lifeYears(p)}</span>
            </span>
          ),
        })),
    [data.persons, meId, t]
  );
  const marks = { 0: '0', 1: '1', 2: '2', 3: '3', 5: '5', [MAX_DEPTH]: t('family.views.all') };
  const depthLabel = (n) => (n >= MAX_DEPTH ? t('family.views.all') : n);
  const sample = (preview || []).slice(0, 14).map((id) => byId.get(id)).filter(Boolean);

  const save = async (asNew) => {
    if (!name.trim()) {
      message.warning(t('family.views.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      const payload = { name: name.trim(), filter };
      const saved = view && !asNew ? (await familyApi.updateView(view.id, payload)).data.view : (await familyApi.createView(treeId, payload)).data.view;
      message.success(t('family.views.saved', { name: saved.name }));
      onSaved?.(saved);
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={480}
      title={view ? t('family.views.editTitle', { name: view.name }) : t('family.views.newTitle')}
      className="fam-builder"
      forceRender
      footer={
        <div className="fam-builder__footer">
          <div className="fam-builder__count">
            {preview ? t('family.views.willShow', { count: preview.length, total: data.persons.length }) : '…'}
          </div>
          <div className="fam-builder__buttons">
            {view && canEdit && (
              <>
                <Popconfirm
                  title={t('family.views.deleteConfirm')}
                  okText={t('common.delete')}
                  cancelText={t('common.cancel')}
                  okButtonProps={{ danger: true }}
                  onConfirm={async () => {
                    try {
                      await familyApi.deleteView(view.id);
                      onDeleted?.(view);
                    } catch (err) {
                      message.error(errorMessage(err));
                    }
                  }}
                >
                  <Button danger type="text" icon={<DeleteOutlined />} aria-label={t('common.delete')} />
                </Popconfirm>
                <Button onClick={() => save(true)} loading={saving}>
                  {t('family.views.saveCopy')}
                </Button>
                <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => save(false)}>
                  {t('family.views.saveChanges')}
                </Button>
              </>
            )}
            {!view && (
              <Button onClick={() => onApply?.(filter, preview)} disabled={!preview}>
                {t('family.views.apply')}
              </Button>
            )}
          </div>
        </div>
      }
    >
      {view && canEdit && (
        <section className="fam-builder__section">
          <h4>{t('family.views.name')}</h4>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} size="large" />
        </section>
      )}
      <section className="fam-builder__section">
        <h4>{t('family.views.presets')}</h4>
        <div className="fam-presets">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" className="fam-preset" onClick={() => set(p.filter)}>
              <span className="fam-preset__icon">{p.icon}</span>
              <b>{t(`family.views.preset.${p.key}`)}</b>
            </button>
          ))}
        </div>
      </section>

      <section className="fam-builder__section">
        <h4>{t('family.views.focus')}</h4>
        <Select
          showSearch
          style={{ width: '100%' }}
          value={filter.focus}
          onChange={(focusId) => set({ focus: focusId })}
          options={people}
          filterOption={(input, option) => option.search.includes(input.toLowerCase())}
        />
        {focus && filter.focus !== meId && meId && (
          <Button type="link" size="small" onClick={() => set({ focus: meId })} className="fam-builder__me">
            {t('family.views.fromMe')}
          </Button>
        )}
      </section>

      <section className="fam-builder__section">
        <h4>{t('family.views.side')}</h4>
        <div className="fam-sides">
          {['both', 'father', 'mother'].map((side) => (
            <SideCard
              key={side}
              value={side}
              active={filter.side === side}
              onClick={() => set({ side })}
              title={t(`family.views.sides.${side}`)}
              text={t(`family.views.sides.${side}Text`)}
            />
          ))}
        </div>
      </section>

      <section className="fam-builder__section">
        <h4>
          {t('family.views.ancestors')} <span className="fam-chip">{depthLabel(filter.ancestors)}</span>
        </h4>
        <Slider min={0} max={MAX_DEPTH} marks={marks} value={filter.ancestors} onChange={(ancestors) => set({ ancestors })} tooltip={{ formatter: depthLabel }} />
        <h4>
          {t('family.views.descendants')} <span className="fam-chip">{depthLabel(filter.descendants)}</span>
        </h4>
        <Slider min={0} max={MAX_DEPTH} marks={marks} value={filter.descendants} onChange={(descendants) => set({ descendants })} tooltip={{ formatter: depthLabel }} />
      </section>

      <section className="fam-builder__section">
        <h4>{t('family.views.collateral')}</h4>
        <Segmented
          block
          value={filter.collateral}
          onChange={(collateral) => set({ collateral })}
          options={[0, 1, 2, 3].map((n) => ({ value: n, label: t(`family.views.coll.${n}`) }))}
        />
        <p className="fam-hint">{t(`family.views.coll.${filter.collateral}Text`)}</p>
        <div className="fam-builder__row">
          <span>
            <b>{t('family.views.partners')}</b>
            <small>{t('family.views.partnersText')}</small>
          </span>
          <Switch checked={filter.partners} onChange={(partners) => set({ partners })} />
        </div>
      </section>

      {sample.length > 0 && (
        <section className="fam-builder__section">
          <h4>{t('family.views.preview')}</h4>
          <div className="fam-faces-row">
            {sample.map((p) => (
              <Avatar key={p.id} person={p} size={32} />
            ))}
            {preview.length > sample.length && <span className="fam-chip">+{preview.length - sample.length}</span>}
          </div>
        </section>
      )}

      {canEdit && !view && (
        <section className="fam-builder__section fam-builder__save">
          <h4>{t('family.views.saveTitle')}</h4>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder={t('family.views.namePlaceholder')} onPressEnter={() => save(false)} />
          <div className="fam-builder__buttons">
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => save(false)}>
              {view ? t('family.views.update') : t('family.views.save')}
            </Button>
            {view && (
              <Button onClick={() => save(true)} loading={saving}>
                {t('family.views.saveCopy')}
              </Button>
            )}
            {view && (
              <Popconfirm
                title={t('family.views.deleteConfirm')}
                okText={t('common.delete')}
                cancelText={t('common.cancel')}
                okButtonProps={{ danger: true }}
                onConfirm={async () => {
                  try {
                    await familyApi.deleteView(view.id);
                    onDeleted?.(view);
                  } catch (err) {
                    message.error(errorMessage(err));
                  }
                }}
              >
                <Button danger type="text" icon={<DeleteOutlined />}>
                  {t('common.delete')}
                </Button>
              </Popconfirm>
            )}
          </div>
        </section>
      )}
    </Drawer>
  );
}
