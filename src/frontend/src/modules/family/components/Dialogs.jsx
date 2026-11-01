import { useEffect, useMemo, useState } from 'react';
import { App, Button, Checkbox, DatePicker, Empty, Form, Input, List, Modal, Popconfirm, Segmented, Select, Space, Tag, Typography, Upload } from 'antd';
import { CopyOutlined, DeleteOutlined, EditOutlined, FilterOutlined, InboxOutlined, LinkOutlined, LockOutlined, RobotOutlined, SaveOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useLocale } from '../../../context/LocaleContext';
import { fmtDate, fmtDateTime } from '../../../lib/datetime';
import { errorMessage } from '../../../lib/errors';
import { familyApi } from '../api';
import { displayName, lifeYears, searchText, shortName } from '../format';
import { candidates } from '../kin';
import { PartialDate, dateRule } from './PersonEditor';
import { Avatar } from './TreeCanvas';

/** Create a tree or rename one. */
export function TreeDialog({ open, tree, onClose, onSaved }) {
  const { t } = useLocale();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) form.setFieldsValue({ name: tree?.name || '', description: tree?.description || '', showUnknownParents: tree?.showUnknownParents !== false });
  }, [open, tree, form]);
  const submit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (tree) await familyApi.updateTree(tree.id, values);
      const id = tree ? tree.id : (await familyApi.createTree(values)).data.id;
      onSaved?.(id);
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open={open}
      title={tree ? t('family.tree.renameTitle') : t('family.tree.newTitle')}
      onCancel={onClose}
      onOk={submit}
      okText={tree ? t('common.save') : t('family.tree.create')}
      cancelText={t('common.cancel')}
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={submit}>
        <Form.Item name="name" label={t('family.tree.name')} rules={[{ required: true, whitespace: true, message: t('family.tree.nameRequired') }]}>
          <Input maxLength={120} autoFocus placeholder={t('family.tree.namePlaceholder')} />
        </Form.Item>
        <Form.Item name="description" label={t('family.tree.description')}>
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} maxLength={2000} />
        </Form.Item>
        <Form.Item name="showUnknownParents" valuePropName="checked" extra={t('family.tree.showUnknownParentsHint')}>
          <Checkbox>{t('family.tree.showUnknownParents')}</Checkbox>
        </Form.Item>
        <button type="submit" hidden aria-hidden="true" />
      </Form>
    </Modal>
  );
}

const STATUSES = ['married', 'partners', 'engaged', 'divorced', 'separated', 'widowed'];

/** Link the person to someone already in the tree: as parent, child or partner. */
export function LinkDialog({ open, kind, personId, index, treeId, onClose, onDone }) {
  const { t } = useLocale();
  const { message } = App.useApp();
  const [target, setTarget] = useState(null);
  const [status, setStatus] = useState('married');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setTarget(null);
      setStatus('married');
    }
  }, [open]);
  const options = useMemo(
    () =>
      open && personId
        ? candidates(index, personId, kind)
            .sort((a, b) => displayName(a).localeCompare(displayName(b)))
            .map((p) => ({
              value: p.id,
              search: searchText(p),
              label: (
                <span className="fam-option">
                  <Avatar person={p} size={24} />
                  <span>{displayName(p)}</span>
                  <span className="fam-option__years">{lifeYears(p)}</span>
                </span>
              ),
            }))
        : [],
    [open, index, personId, kind]
  );
  const person = index.persons.get(personId);
  const submit = async () => {
    if (!target) return;
    setSaving(true);
    try {
      if (kind === 'parent') await familyApi.addParent(treeId, { childId: personId, parentId: target });
      else if (kind === 'child') await familyApi.addParent(treeId, { childId: target, parentId: personId });
      else await familyApi.addUnion(treeId, { partnerA: personId, partnerB: target, status });
      message.success(t('family.panel.linked'));
      onDone?.();
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open={open}
      title={t(`family.link.title.${kind || 'parent'}`, { name: person ? shortName(person) : '' })}
      onCancel={onClose}
      onOk={submit}
      okText={t('family.panel.link')}
      cancelText={t('common.cancel')}
      okButtonProps={{ disabled: !target }}
      confirmLoading={saving}
      destroyOnHidden
    >
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Select
          showSearch
          autoFocus
          style={{ width: '100%' }}
          placeholder={t('family.link.pick')}
          value={target}
          onChange={setTarget}
          options={options}
          filterOption={(input, option) => option.search.includes(input.toLowerCase())}
          notFoundContent={<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('family.link.none')} />}
        />
        {kind === 'partner' && (
          <Select value={status} onChange={setStatus} style={{ width: '100%' }} options={STATUSES.map((s) => ({ value: s, label: t(`family.status.${s}`) }))} />
        )}
      </Space>
    </Modal>
  );
}

const ACCESS = ['view', 'suggest', 'edit'];

function AccessPicker({ value, onChange }) {
  const { t } = useLocale();
  return (
    <div className="fam-access" role="radiogroup">
      {ACCESS.map((a) => (
        <button key={a} type="button" role="radio" aria-checked={value === a} className={`fam-access__opt${value === a ? ' is-active' : ''}`} onClick={() => onChange?.(a)}>
          <b>{t(`family.share.level.${a}`)}</b>
          <span>{t(`family.share.level.${a}Text`)}</span>
        </button>
      ))}
    </div>
  );
}

/** Public links to the tree or one of its views: create, copy, protect, revoke. */
export function ShareDialog({ open, tree, views = [], activeViewId = null, config, onClose }) {
  const { t } = useLocale();
  const { message } = App.useApp();
  const [shares, setShares] = useState(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null); // the link being edited, or null for a new one
  const theme = Form.useWatch('theme', form);
  const askPhone = Form.useWatch('askPhone', form);

  const blank = () => ({ viewId: activeViewId || 0, access: 'view', allowClone: true, askName: false, askPhone: 'off', theme: 'system', themeLocked: false, assistant: true, title: '', password: '', removePassword: false, expiresAt: null });
  const startEdit = (share) => {
    setEditing(share);
    form.setFieldsValue({
      ...blank(),
      viewId: share.viewId || 0,
      access: share.access,
      allowClone: share.allowClone,
      askName: share.askName,
      askPhone: share.askPhone,
      theme: share.theme,
      themeLocked: share.themeLocked,
      assistant: share.assistant,
      title: share.title,
      expiresAt: share.expiresAt ? dayjs(share.expiresAt) : null,
    });
  };
  const stopEdit = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue(blank());
  };

  const load = async () => {
    try {
      setShares((await familyApi.shares(tree.id)).data.shares);
    } catch (err) {
      message.error(errorMessage(err));
    }
  };
  useEffect(() => {
    if (open && tree) {
      setShares(null);
      setEditing(null);
      form.resetFields();
      form.setFieldsValue(blank());
      load();
    }
  }, [open, tree]); // eslint-disable-line react-hooks/exhaustive-deps

  const absolute = (url) => `${window.location.origin}${url}`;
  const copy = async (url) => {
    try {
      await navigator.clipboard.writeText(absolute(url));
      message.success(t('family.share.copied'));
    } catch {
      message.info(absolute(url));
    }
  };
  const create = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const payload = {
        title: values.title || '',
        viewId: values.viewId || null,
        access: values.access,
        allowClone: values.allowClone,
        askName: values.askName,
        askPhone: values.askPhone,
        theme: values.theme,
        themeLocked: values.themeLocked,
        assistant: values.assistant,
        expiresAt: values.expiresAt ? values.expiresAt.endOf('day').toISOString() : null,
      };
      // Editing: an empty password field keeps the old one; «remove» clears it.
      if (!editing || values.password || values.removePassword) payload.password = values.removePassword ? '' : values.password || '';
      if (editing) {
        await familyApi.updateShare(editing.id, payload);
        message.success(t('family.share.updated'));
        stopEdit();
        await load();
        return;
      }
      const { share } = (await familyApi.createShare(tree.id, payload)).data;
      form.resetFields(['password', 'expiresAt', 'title']);
      await load();
      copy(share.url);
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const maxDays = config?.maxShareDays || 0;

  return (
    <Modal open={open} title={t('family.share.title')} onCancel={onClose} footer={null} width={660} forceRender>
      {!config?.publicLinks ? (
        <Typography.Paragraph type="secondary">{t('family.share.disabled')}</Typography.Paragraph>
      ) : (
        <>
          <Typography.Paragraph type="secondary">{t('family.share.lead')}</Typography.Paragraph>
          <Form form={form} layout="vertical" requiredMark={false} className="fam-share-form">
            <div className="fam-form__row">
              <Form.Item name="viewId" label={t('family.share.what')}>
                <Select
                  options={[
                    { value: 0, label: t('family.views.whole') },
                    ...views.map((v) => ({ value: v.id, label: v.name })),
                  ]}
                />
              </Form.Item>
              <Form.Item name="title" label={t('family.share.titleField')}>
                <Input maxLength={120} placeholder={t('family.share.titlePlaceholder')} />
              </Form.Item>
            </div>
            <Form.Item name="access" label={t('family.share.access')}>
              <AccessPicker />
            </Form.Item>
            <div className="fam-form__row">
              <Form.Item
                name="password"
                label={t('family.share.password')}
                rules={[
                  // Editing a protected link: empty keeps its password.
                  { required: Boolean(config?.requireSharePassword) && !editing?.hasPassword, message: t('family.share.passwordRequired') },
                  { min: 8, message: t('family.share.passwordShort') },
                ]}
              >
                <Input.Password
                  autoComplete="new-password"
                  placeholder={editing?.hasPassword ? t('family.share.passwordKeep') : config?.requireSharePassword ? '' : t('family.share.passwordOptional')}
                />
              </Form.Item>
              <Form.Item name="expiresAt" label={t('family.share.expires')} extra={maxDays ? t('family.share.maxDays', { count: maxDays }) : null}>
                <DatePicker
                  style={{ width: '100%' }}
                  disabledDate={(d) => d.isBefore(dayjs(), 'day') || (maxDays && d.isAfter(dayjs().add(maxDays, 'day')))}
                  placeholder={t('family.share.never')}
                />
              </Form.Item>
            </div>
            <div className="fam-share-who">
              <div className="fam-share-who__title">{t('family.share.whoTitle')}</div>
              {askPhone && askPhone !== 'off' ? (
                // Asking for a phone always asks for the name.
                <div className="fam-share-who__item">
                  <Checkbox checked disabled>
                    {t('family.share.askName')}
                  </Checkbox>
                </div>
              ) : (
                <Form.Item name="askName" valuePropName="checked" className="fam-share-who__item">
                  <Checkbox>{t('family.share.askName')}</Checkbox>
                </Form.Item>
              )}
              <Form.Item name="askPhone" label={t('family.share.askPhone')} className="fam-share-who__item">
                <Segmented block className="fam-share-seg" options={['off', 'optional', 'required'].map((v) => ({ value: v, label: t(`family.share.phone.${v}`) }))} />
              </Form.Item>
              <p className="fam-hint">{t('family.share.whoHint')}</p>
            </div>
            {editing?.hasPassword && (
              <Form.Item name="removePassword" valuePropName="checked" className="fam-share-clone">
                <Checkbox>{t('family.share.removePassword')}</Checkbox>
              </Form.Item>
            )}
            <div className="fam-share-who">
              <div className="fam-share-who__title">{t('family.share.lookTitle')}</div>
              <Form.Item name="theme" label={t('family.share.theme')} className="fam-share-who__item">
                <Segmented block className="fam-share-seg" options={['system', 'light', 'dark'].map((v) => ({ value: v, label: t(`family.share.themes.${v}`) }))} />
              </Form.Item>
              <Form.Item name="themeLocked" valuePropName="checked" className="fam-share-who__item">
                <Checkbox disabled={theme === 'system'}>{t('family.share.themeLocked')}</Checkbox>
              </Form.Item>
              <Form.Item name="assistant" valuePropName="checked" className="fam-share-who__item">
                <Checkbox>{t('family.share.assistant')}</Checkbox>
              </Form.Item>
            </div>
            <Form.Item name="allowClone" valuePropName="checked" className="fam-share-clone">
              <Checkbox>{t('family.share.allowClone')}</Checkbox>
            </Form.Item>
            <Space className="fam-share-submit" wrap>
              <Button type="primary" icon={editing ? <SaveOutlined /> : <LinkOutlined />} onClick={create} loading={saving}>
                {editing ? t('family.share.save') : t('family.share.create')}
              </Button>
              {editing && <Button onClick={stopEdit}>{t('common.cancel')}</Button>}
            </Space>
          </Form>
          <List
            className="fam-share-list"
            loading={!shares}
            dataSource={shares || []}
            locale={{ emptyText: t('family.share.empty') }}
            renderItem={(share) => (
              <List.Item
                className={editing?.id === share.id ? 'is-editing' : ''}
                actions={[
                  <Button key="edit" type="text" icon={<EditOutlined />} onClick={() => startEdit(share)} aria-label={t('family.share.edit')} />,
                  <Button key="copy" type="text" icon={<CopyOutlined />} onClick={() => copy(share.url)} aria-label={t('family.share.copy')} />,
                  <Popconfirm
                    key="del"
                    title={t('family.share.revokeConfirm')}
                    okText={t('family.share.revoke')}
                    cancelText={t('common.cancel')}
                    okButtonProps={{ danger: true }}
                    onConfirm={async () => {
                      try {
                        await familyApi.deleteShare(share.id);
                        load();
                      } catch (err) {
                        message.error(errorMessage(err));
                      }
                    }}
                  >
                    <Button type="text" danger icon={<DeleteOutlined />} aria-label={t('family.share.revoke')} />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <span className="fam-share-title">
                      <b>{share.title || share.viewName || t('family.views.whole')}</b>
                      <a href={share.url} target="_blank" rel="noreferrer">
                        {absolute(share.url)}
                      </a>
                    </span>
                  }
                  description={
                    <Space size={6} wrap>
                      <Tag color={share.access === 'edit' ? 'orange' : share.access === 'suggest' ? 'green' : 'default'}>{t(`family.share.level.${share.access}`)}</Tag>
                      {share.viewName && <Tag icon={<FilterOutlined />}>{share.viewName}</Tag>}
                      {share.theme !== 'system' && <Tag>{t(`family.share.themes.${share.theme}`)}{share.themeLocked ? ' 🔒' : ''}</Tag>}
                      {share.assistant && <Tag icon={<RobotOutlined />}>{t('family.share.assistantTag')}</Tag>}
                      {(share.askName || (share.askPhone && share.askPhone !== 'off')) && <Tag icon={<UserOutlined />}>{share.askPhone === 'required' ? t('family.share.tagNamePhone') : t('family.share.tagName')}</Tag>}
                      {share.hasPassword && (
                        <Tag icon={<LockOutlined />} color="blue">
                          {t('family.share.protected')}
                        </Tag>
                      )}
                      <Tag>{share.expiresAt ? t('family.share.until', { date: fmtDate(share.expiresAt) }) : t('family.share.forever')}</Tag>
                      <span>{t('family.share.views', { count: share.viewCount })}</span>
                      {share.lastViewedAt && <span>· {fmtDateTime(share.lastViewedAt)}</span>}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </>
      )}
    </Modal>
  );
}

/** Copy the tree (or the view on screen) into a new tree of one's own. */
export function CloneDialog({ open, defaultName, onClose, onClone, title }) {
  const { t } = useLocale();
  const { message } = App.useApp();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setName(defaultName ? t('family.clone.nameCopy', { name: defaultName }) : '');
  }, [open, defaultName, t]);
  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onClone(name.trim());
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      title={title || t('family.clone.title')}
      onCancel={onClose}
      onOk={submit}
      okText={t('family.clone.ok')}
      cancelText={t('common.cancel')}
      confirmLoading={busy}
      okButtonProps={{ disabled: !name.trim() }}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary">{t('family.clone.lead')}</Typography.Paragraph>
      <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} onPressEnter={submit} autoFocus />
    </Modal>
  );
}

/** Imports people from a family-tree export or an old ftree export (JSON). */
export function ImportDialog({ open, tree, onClose, onDone }) {
  const { t } = useLocale();
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const read = async (file) => {
    setBusy(true);
    try {
      const data = JSON.parse(await file.text());
      const result = (await familyApi.importInto(tree.id, data)).data;
      message.success(t('family.import.done', { persons: result.persons, links: result.links }));
      onDone?.();
    } catch (err) {
      message.error(err instanceof SyntaxError ? t('family.import.badFile') : errorMessage(err));
    } finally {
      setBusy(false);
    }
    return false;
  };
  return (
    <Modal open={open} title={t('family.import.title')} onCancel={onClose} footer={null} destroyOnHidden>
      <Typography.Paragraph type="secondary">{t('family.import.lead')}</Typography.Paragraph>
      <Upload.Dragger accept=".json,application/json" showUploadList={false} beforeUpload={read} disabled={busy}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">{busy ? t('family.import.working') : t('family.import.drop')}</p>
      </Upload.Dragger>
    </Modal>
  );
}

const ACTIVE_STATUSES = ['married', 'partners', 'engaged'];
const ENDED_STATUSES = ['divorced', 'separated', 'widowed'];

/** A couple: whether it lasts, how it ended, and the dates (all optional). */
export function UnionDialog({ open, union, names, onClose, onDone }) {
  const { t } = useLocale();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const status = Form.useWatch('status', form);
  useEffect(() => {
    if (open && union) form.setFieldsValue({ status: union.status, startDate: union.startDate || '', endDate: union.endDate || '' });
  }, [open, union, form]);
  const submit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await familyApi.updateUnion(union.id, { status: values.status, startDate: values.startDate || '', endDate: values.endDate || '' });
      message.success(t('family.form.saved'));
      onDone?.();
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const ended = ['divorced', 'separated', 'widowed'].includes(status);
  return (
    <Modal
      open={open}
      title={t('family.union.title', { names })}
      onCancel={onClose}
      onOk={submit}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      confirmLoading={saving}
      forceRender
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item label={t('family.union.state')}>
          <Segmented
            block
            value={ACTIVE_STATUSES.includes(status) ? 'active' : 'ended'}
            onChange={(v) => form.setFieldValue('status', v === 'active' ? 'married' : 'divorced')}
            options={[
              { value: 'active', label: t('family.union.active') },
              { value: 'ended', label: t('family.union.ended') },
            ]}
          />
        </Form.Item>
        <Form.Item name="status" label={t('family.union.status')}>
          <Select
            options={(ACTIVE_STATUSES.includes(status) ? ACTIVE_STATUSES : ENDED_STATUSES).map((s) => ({ value: s, label: t(`family.status.${s}`) }))}
          />
        </Form.Item>
        <div className="fam-form__row">
          <Form.Item name="startDate" label={t('family.union.start')} rules={[dateRule(t)]} validateTrigger="onBlur" extra={t('family.union.startHint')}>
            <PartialDate placeholder={t('family.form.datePlaceholder')} />
          </Form.Item>
          {ended && (
            <Form.Item name="endDate" label={t('family.union.end')} rules={[dateRule(t)]} validateTrigger="onBlur" extra={t('family.union.endHint')}>
              <PartialDate placeholder={t('family.form.datePlaceholder')} />
            </Form.Item>
          )}
        </div>
      </Form>
    </Modal>
  );
}
