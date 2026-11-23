import { useEffect, useMemo, useState } from 'react';
import { App, AutoComplete, Button, Checkbox, Form, Input, Modal, Popover, Segmented, Select, Tooltip } from 'antd';
import { DeleteOutlined, EyeInvisibleOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { useLocale } from '../../../context/LocaleContext';
import { errorMessage } from '../../../lib/errors';
import { familyApi } from '../api';
import { chapterParts, chapterTag } from '../story';

export const LABEL_COLORS = ['red', 'orange', 'gold', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink', 'gray', 'black'];

/** Chips of a person's labels, with names. */
export function LabelChips({ ids, labels }) {
  const list = (ids || []).map((id) => labels?.get(id)).filter(Boolean);
  if (!list.length) return null;
  return (
    <span className="fam-labels">
      {list.map((l) => (
        <span key={l.id} className={`fam-label fam-tag--${l.color}`}>
          {l.emblem && <span className="fam-label__emblem">{l.emblem}</span>}
          {l.name}
        </span>
      ))}
    </span>
  );
}

/** The colour picker of a label: the palette as swatches. */
function ColorPick({ value, onChange, t }) {
  return (
    <Select
      value={value}
      onChange={onChange}
      className="fam-colorpick"
      popupMatchSelectWidth={false}
      aria-label={t('family.labels.color')}
      options={LABEL_COLORS.map((c) => ({
        value: c,
        label: (
          <span className="fam-colorpick__item">
            <span className={`fam-dot fam-tag--${c}`} />
            {t(`family.labels.colors.${c}`)}
          </span>
        ),
      }))}
    />
  );
}

/** Editor of a tree's labels: emblem, name, group and colour of each. */
export function LabelsEditor({ value = [], onChange }) {
  const { t } = useLocale();
  const groups = useMemo(() => [...new Set(value.map((l) => l.group).filter(Boolean))].map((g) => ({ value: g })), [value]);
  const set = (i, patch) => onChange(value.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  return (
    <div className="fam-labeled">
      {value.map((label, i) => (
        <div key={label.id || `new-${i}`} className="fam-labeled__row">
          <Input
            className="fam-labeled__emblem"
            value={label.emblem}
            maxLength={4}
            placeholder="✦"
            aria-label={t('family.labels.emblem')}
            onChange={(e) => set(i, { emblem: e.target.value })}
          />
          <Input value={label.name} maxLength={40} placeholder={t('family.labels.namePlaceholder')} aria-label={t('family.labels.name')} onChange={(e) => set(i, { name: e.target.value })} />
          <AutoComplete
            className="fam-labeled__group"
            value={label.group}
            options={groups}
            placeholder={t('family.labels.groupPlaceholder')}
            aria-label={t('family.labels.group')}
            onChange={(group) => set(i, { group })}
          />
          <ColorPick value={label.color || 'gray'} onChange={(color) => set(i, { color })} t={t} />
          <Tooltip title={t('common.delete')}>
            <Button type="text" icon={<DeleteOutlined />} aria-label={t('common.delete')} onClick={() => onChange(value.filter((_, k) => k !== i))} />
          </Tooltip>
        </div>
      ))}
      <Button icon={<PlusOutlined />} onClick={() => onChange([...value, { id: '', name: '', group: value[value.length - 1]?.group || '', color: LABEL_COLORS[value.length % LABEL_COLORS.length], emblem: '' }])}>
        {t('family.labels.add')}
      </Button>
    </div>
  );
}

/** Options of a chapter select, grouped by parts. */
export function chapterOptions(story) {
  const parts = chapterParts(story);
  const item = ({ chapter, index }) => ({ value: index, label: `${chapterTag(chapter, index)} · ${chapter.title}` });
  if (parts.length === 1 && !parts[0].part) return parts[0].items.map(item);
  return parts.map((p, i) => ({ label: p.part || '—', title: p.part || `part-${i}`, options: p.items.map(item) }));
}

/**
 * Where the reader is in a story with spoilers: everything, or up to a
 * chapter. The tree, timeline and list show what is known by then.
 */
export function SpoilerControl({ guard, compact = false }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const { story, upto, setUpto } = guard;
  if (!story || !guard.guarded) return null;
  const all = upto === null;
  const chapter = all ? null : story.chapters[upto];
  const label = all ? t('family.spoiler.all') : t('family.spoiler.upto', { tag: chapterTag(chapter, upto) });
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomLeft"
      title={t('family.spoiler.title', { story: story.title })}
      content={
        <div className="fam-spoiler">
          <Segmented
            block
            value={all ? 'all' : 'upto'}
            onChange={(next) => setUpto(next === 'all' ? null : (upto ?? story.chapters.length - 1))}
            options={[
              { value: 'upto', icon: <EyeInvisibleOutlined />, label: t('family.spoiler.guard') },
              { value: 'all', icon: <EyeOutlined />, label: t('family.spoiler.showAll') },
            ]}
          />
          {!all && (
            <>
              <div className="fam-spoiler__label">{t('family.spoiler.where')}</div>
              <Select className="fam-spoiler__select" value={upto} onChange={(v) => setUpto(v)} options={chapterOptions(story)} showSearch optionFilterProp="label" />
            </>
          )}
          <p className="fam-hint">{all ? t('family.spoiler.allHint') : t('family.spoiler.guardHint')}</p>
        </div>
      }
    >
      <Button className={`fam-spoilerbtn${all ? '' : ' is-guarded'}`} icon={all ? <EyeOutlined /> : <EyeInvisibleOutlined />} aria-label={label}>
        {!compact && <span className="fam-spoilerbtn__label">{label}</span>}
      </Button>
    </Popover>
  );
}

/** First visit to a tree whose story has spoilers: where is the reader? */
export function SpoilerWelcome({ guard, onPlay }) {
  const { t } = useLocale();
  const [choice, setChoice] = useState(null);
  const { story } = guard;
  if (!story || !guard.needsChoice) return null;
  return (
    <Modal open footer={null} closable={false} centered width={520} className="fam-welcome" title={null} destroyOnHidden>
      <div className={`fam-welcome__cover fam-tag--${story.color}`}>
        <div className="fam-welcome__kicker">{t('family.spoiler.welcomeKicker')}</div>
        <h2>{story.title}</h2>
        {story.subtitle && <p>{story.subtitle}</p>}
      </div>
      <p className="fam-welcome__text">{t('family.spoiler.welcomeText', { count: story.chapters.length })}</p>
      <div className="fam-welcome__choices">
        <Button
          type="primary"
          size="large"
          block
          onClick={() => {
            guard.setUpto(0);
            onPlay?.(story.id, 0);
          }}
        >
          {t('family.spoiler.fromStart')}
        </Button>
        {choice === null ? (
          <Button size="large" block onClick={() => setChoice(0)}>
            {t('family.spoiler.iAmAt')}
          </Button>
        ) : (
          <div className="fam-welcome__pick">
            <Select autoFocus value={choice} onChange={setChoice} options={chapterOptions(story)} showSearch optionFilterProp="label" className="fam-spoiler__select" />
            <Button type="primary" onClick={() => guard.setUpto(choice)}>
              {t('family.spoiler.apply')}
            </Button>
          </div>
        )}
        <Button size="large" type="text" block onClick={() => guard.setUpto(null)}>
          {t('family.spoiler.knowAll')}
        </Button>
      </div>
    </Modal>
  );
}

/** Create or edit a story: title, subtitle, about, colour, spoiler guard. */
export function StoryDialog({ open, treeId, story, onClose, onSaved }) {
  const { t } = useLocale();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) form.setFieldsValue({ title: story?.title || '', subtitle: story?.subtitle || '', description: story?.description || '', color: story?.color || 'indigo', spoilers: Boolean(story?.spoilers) });
  }, [open, story, form]);
  const submit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const res = story ? await familyApi.updateStory(story.id, values) : await familyApi.createStory(treeId, values);
      onSaved?.(res.data.story);
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open={open}
      title={story ? t('family.story.editTitle') : t('family.story.newTitle')}
      onCancel={onClose}
      onOk={submit}
      okText={story ? t('common.save') : t('family.story.create')}
      cancelText={t('common.cancel')}
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={submit}>
        <Form.Item name="title" label={t('family.story.title')} rules={[{ required: true, whitespace: true, message: t('family.story.titleRequired') }]}>
          <Input maxLength={120} autoFocus placeholder={t('family.story.titlePlaceholder')} />
        </Form.Item>
        <Form.Item name="subtitle" label={t('family.story.subtitle')}>
          <Input maxLength={200} placeholder={t('family.story.subtitlePlaceholder')} />
        </Form.Item>
        <Form.Item name="description" label={t('family.story.description')}>
          <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} maxLength={4000} />
        </Form.Item>
        <Form.Item name="color" label={t('family.story.color')}>
          <ColorPick t={t} />
        </Form.Item>
        <Form.Item name="spoilers" valuePropName="checked" extra={t('family.story.spoilersHint')}>
          <Checkbox>{t('family.story.spoilers')}</Checkbox>
        </Form.Item>
        <button type="submit" hidden aria-hidden="true" />
      </Form>
    </Modal>
  );
}
