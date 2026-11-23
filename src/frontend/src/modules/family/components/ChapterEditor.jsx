import { useEffect, useMemo, useState } from 'react';
import { App, AutoComplete, Button, Drawer, Form, Input, Select, Space, Tooltip } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useLocale } from '../../../context/LocaleContext';
import { errorMessage } from '../../../lib/errors';
import { familyApi } from '../api';
import { displayName, formatPartial, lifeYears, parsePartial, searchText, shortName } from '../format';
import { EVENT_ICONS, EVENT_TYPES } from '../story';
import { useTreeTime } from '../time';

const STATUSES = ['married', 'partners', 'engaged', 'divorced', 'separated', 'widowed'];

function PeoplePick({ options, value, onChange, placeholder, max }) {
  return (
    <Select
      mode="multiple"
      value={value || []}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      maxCount={max}
      showSearch
      filterOption={(input, option) => option.search.includes(input.toLowerCase())}
      className="fam-chapter__people"
    />
  );
}

/** One event of a chapter: what happens and to whom. */
function EventRow({ event, onChange, onRemove, people, unions, labels, t }) {
  const set = (patch) => onChange({ ...event, ...patch });
  return (
    <div className="fam-event-edit">
      <div className="fam-event-edit__head">
        <Select
          value={event.type}
          onChange={(type) => set({ type })}
          className="fam-event-edit__type"
          options={EVENT_TYPES.map((type) => ({ value: type, label: `${EVENT_ICONS[type]}  ${t(`family.story.event.${type}`)}` }))}
        />
        <Tooltip title={t('common.delete')}>
          <Button type="text" icon={<DeleteOutlined />} onClick={onRemove} aria-label={t('common.delete')} />
        </Tooltip>
      </div>
      {event.type === 'union' ? (
        <Space.Compact block>
          <Select
            value={event.unionId || undefined}
            onChange={(unionId) => set({ unionId })}
            options={unions}
            placeholder={t('family.story.pickCouple')}
            showSearch
            optionFilterProp="label"
            style={{ flex: 1 }}
          />
          <Select
            value={event.status || undefined}
            allowClear
            onChange={(status) => set({ status })}
            placeholder={t('family.story.statusKeep')}
            options={STATUSES.map((s) => ({ value: s, label: t(`family.status.${s}`) }))}
            style={{ width: 170 }}
          />
        </Space.Compact>
      ) : (
        <PeoplePick options={people} value={event.persons} onChange={(persons) => set({ persons })} placeholder={t('family.story.pickPeople')} max={40} />
      )}
      {event.type === 'side' && (
        <Select
          value={event.labelId || undefined}
          onChange={(labelId) => set({ labelId })}
          placeholder={t('family.story.pickLabel')}
          options={labels.map((l) => ({ value: l.id, label: `${l.emblem ? `${l.emblem} ` : ''}${l.name}${l.group ? ` · ${l.group}` : ''}` }))}
          notFoundContent={t('family.story.noLabels')}
          style={{ width: '100%' }}
        />
      )}
      <Input
        value={event.text || ''}
        onChange={(e) => set({ text: e.target.value })}
        maxLength={300}
        placeholder={t(`family.story.eventTextPlaceholder.${event.type}`)}
      />
    </div>
  );
}

/**
 * Adds or edits a chapter of a story. `draft`: { story, chapter?, afterId? }.
 */
export default function ChapterEditor({ open, draft, data, onClose, onSaved }) {
  const { t } = useLocale();
  const { message } = App.useApp();
  const { era } = useTreeTime();
  const [form] = Form.useForm();
  const [events, setEvents] = useState([]);
  const [saving, setSaving] = useState(false);
  const chapter = draft?.chapter || null;
  const story = draft?.story || null;

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      part: chapter?.part ?? story?.chapters?.[story.chapters.length - 1]?.part ?? '',
      label: chapter?.label || '',
      title: chapter?.title || '',
      when: chapter?.when || '',
      year: chapter?.year ? formatPartial(chapter.year) : '',
      teaser: chapter?.teaser || '',
      body: chapter?.body || '',
      focus: chapter?.focus || [],
    });
    setEvents(chapter?.events ? chapter.events.map((e) => ({ ...e })) : []);
  }, [open, chapter, story, form]);

  const people = useMemo(
    () =>
      (data?.persons || [])
        .slice()
        .sort((a, b) => displayName(a).localeCompare(displayName(b)))
        .map((p) => ({ value: p.id, label: [displayName(p), lifeYears(p)].filter(Boolean).join(' · '), search: searchText(p) })),
    [data]
  );
  const byId = useMemo(() => new Map((data?.persons || []).map((p) => [p.id, p])), [data]);
  const unions = useMemo(
    () =>
      (data?.unions || []).map((u) => ({
        value: u.id,
        label: `${shortName(byId.get(u.partnerA))} & ${shortName(byId.get(u.partnerB))}`,
      })),
    [data, byId]
  );
  const parts = useMemo(() => [...new Set((story?.chapters || []).map((c) => c.part).filter(Boolean))].map((value) => ({ value })), [story]);
  const labels = data?.tree?.labels || [];

  const submit = async () => {
    const values = await form.validateFields();
    const year = parsePartial(values.year, { shortYears: Boolean(era) });
    if (year === null) {
      form.setFields([{ name: 'year', errors: [t('family.story.yearInvalid')] }]);
      return;
    }
    setSaving(true);
    try {
      const payload = { ...values, year: year || null, events: events.filter((e) => e.type) };
      const res = chapter ? await familyApi.updateChapter(chapter.id, payload) : await familyApi.createChapter(story.id, { ...payload, afterId: draft?.afterId || null });
      onSaved?.(res.data.chapter);
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
      title={chapter ? t('family.story.editChapter') : t('family.story.newChapter')}
      width={640}
      destroyOnHidden
      extra={
        <Space>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="primary" loading={saving} onClick={submit}>
            {t('common.save')}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={submit} className="fam-chapter-form">
        <div className="fam-chapter-form__row">
          <Form.Item name="part" label={t('family.story.part')} className="fam-chapter-form__grow">
            <AutoComplete options={parts} placeholder={t('family.story.partPlaceholder')} maxLength={80} />
          </Form.Item>
          <Form.Item name="label" label={t('family.story.label')}>
            <Input maxLength={40} placeholder={t('family.story.labelPlaceholder')} />
          </Form.Item>
        </div>
        <Form.Item name="title" label={t('family.story.chapterTitle')} rules={[{ required: true, whitespace: true, message: t('family.story.titleRequired') }]}>
          <Input maxLength={160} autoFocus />
        </Form.Item>
        <div className="fam-chapter-form__row">
          <Form.Item name="when" label={t('family.story.when')} className="fam-chapter-form__grow">
            <Input maxLength={80} placeholder={t('family.story.whenPlaceholder')} />
          </Form.Item>
          <Form.Item name="year" label={t('family.story.year')} tooltip={t('family.story.yearHint')}>
            <Input maxLength={10} placeholder={era ? '129' : '1941'} />
          </Form.Item>
        </div>
        <Form.Item name="teaser" label={t('family.story.teaser')} extra={t('family.story.teaserHint')}>
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={400} />
        </Form.Item>
        <Form.Item name="body" label={t('family.story.body')} extra={t('family.story.bodyHint')}>
          <Input.TextArea autoSize={{ minRows: 6, maxRows: 18 }} maxLength={20000} />
        </Form.Item>
        <Form.Item name="focus" label={t('family.story.focus')} extra={t('family.story.focusHint')}>
          <PeoplePick options={people} placeholder={t('family.story.pickPeople')} max={12} />
        </Form.Item>
        <div className="fam-chapter-form__events">
          <div className="fam-chapter-form__label">{t('family.story.events')}</div>
          <p className="fam-hint">{t('family.story.eventsHint')}</p>
          {events.map((event, i) => (
            <EventRow
              key={i}
              event={event}
              people={people}
              unions={unions}
              labels={labels}
              t={t}
              onChange={(next) => setEvents((list) => list.map((e, k) => (k === i ? next : e)))}
              onRemove={() => setEvents((list) => list.filter((_, k) => k !== i))}
            />
          ))}
          <Button icon={<PlusOutlined />} onClick={() => setEvents((list) => [...list, { type: 'appear', persons: [] }])}>
            {t('family.story.addEvent')}
          </Button>
        </div>
        <button type="submit" hidden aria-hidden="true" />
      </Form>
    </Drawer>
  );
}
