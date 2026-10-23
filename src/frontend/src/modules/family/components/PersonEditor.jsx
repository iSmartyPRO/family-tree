import { useEffect, useMemo, useState } from 'react';
import { App, Button, Collapse, Drawer, Form, Input, Segmented, Space, Switch, Upload } from 'antd';
import { CameraOutlined, DeleteOutlined, ManOutlined, QuestionOutlined, WomanOutlined } from '@ant-design/icons';
import { useLocale } from '../../../context/LocaleContext';
import { useRegional } from '../../../lib/datetime';
import { errorMessage } from '../../../lib/errors';
import { familyApi, prepareFull, preparePhoto } from '../api';
import { formatPartial, parsePartial, shortName } from '../format';
import { Avatar } from './TreeCanvas';
import DatePick from './DatePick';

const CONTACTS = ['phone', 'email', 'whatsapp', 'telegram', 'instagram', 'facebook', 'linkedin', 'vk', 'ok', 'website'];

/** A date known to the year, month or day; typed in the reader's order. */
export function PartialDate({ value, onChange, onBlur, placeholder, id }) {
  const regional = useRegional();
  const monthFirst = regional.dateFormat?.startsWith('MM');
  const [text, setText] = useState(typeof value === 'string' ? formatPartial(value, regional.dateFormat) : '');
  // Follow the form only when it holds a real date that differs from what is
  // typed — never wipe a date that is still being typed.
  useEffect(() => {
    // A reset form (another person, a new one) clears what was typed.
    if (value === undefined || value === null) {
      setText('');
      return;
    }
    if (typeof value !== 'string') return;
    setText((current) => (parsePartial(current, { monthFirst }) === value ? current : formatPartial(value, regional.dateFormat)));
  }, [value, regional.dateFormat, monthFirst]);
  return (
    <Input
      id={id}
      value={text}
      placeholder={placeholder}
      // «decimal» keeps a separator key on phone keypads («numeric» has none on iOS).
      suffix={
        <DatePick
          monthFirst={monthFirst}
          value={parsePartial(text, { monthFirst }) || undefined}
          onChange={(iso) => {
            setText(iso ? formatPartial(iso, regional.dateFormat) : '');
            onChange?.(iso);
          }}
        />
      }
      inputMode="decimal"
      autoComplete="off"
      onChange={(event) => {
        let next = event.target.value.replace(/,/g, '.');
        // Eight digits in a row: put the dots in right away.
        if (/^\d{8}$/.test(next)) next = `${next.slice(0, 2)}.${next.slice(2, 4)}.${next.slice(4)}`;
        setText(next);
        const parsed = parsePartial(next, { monthFirst });
        onChange?.(parsed === null ? { invalid: next } : parsed);
      }}
      onBlur={(event) => {
        const parsed = parsePartial(text, { monthFirst });
        if (parsed) setText(formatPartial(parsed, regional.dateFormat));
        onBlur?.(event);
      }}
    />
  );
}

export const dateRule = (t) => ({
  validator: (_rule, value) => (value && typeof value === 'object' && 'invalid' in value ? Promise.reject(new Error(t('family.form.badDate'))) : Promise.resolve()),
});

/**
 * Add or edit a person. `draft` = { person?, relation?, title?, defaults? }.
 * Saving a new person with a relation links them in the same request.
 */
export default function PersonEditor({ open, treeId, draft, onClose, onSaved, onSubmitOverride, submitLabel, hideContacts = false, publicMode = false }) {
  const { t } = useLocale();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState(null); // { blob, url } waiting to be sent
  const [removePhoto, setRemovePhoto] = useState(false);
  const person = draft?.person || null;
  const isAlive = Form.useWatch('isAlive', form);
  const gender = Form.useWatch('gender', form);
  const maiden = Form.useWatch('maidenName', form);

  useEffect(() => {
    if (!open) return;
    setPhoto(null);
    setRemovePhoto(false);
    form.resetFields();
    form.setFieldsValue({
      gender: 'unknown',
      isAlive: true,
      ...(draft?.defaults || {}),
      ...(person
        ? {
            firstName: person.firstName,
            lastName: person.lastName,
            patronymic: person.patronymic,
            maidenName: person.maidenName,
            gender: person.gender,
            birthDate: person.birthDate || '',
            birthPlace: person.birthPlace,
            isAlive: person.isAlive,
            deathDate: person.deathDate || '',
            deathPlace: person.deathPlace,
            occupation: person.occupation,
            bio: person.bio,
            contacts: person.contacts || {},
          }
        : {}),
    });
  }, [open, draft, person, form]);

  useEffect(() => () => photo?.url && URL.revokeObjectURL(photo.url), [photo]);

  const preview = useMemo(() => {
    if (photo) return { ...person, photoUrl: photo.url, gender };
    if (removePhoto) return { ...person, photoUrl: null, gender };
    return { ...(person || {}), firstName: form.getFieldValue('firstName'), lastName: form.getFieldValue('lastName'), gender };
  }, [photo, removePhoto, person, gender, form]);

  const pick = async (file) => {
    try {
      const [blob, full] = await Promise.all([preparePhoto(file), prepareFull(file)]);
      setPhoto({ blob, full, url: URL.createObjectURL(blob) });
      setRemovePhoto(false);
    } catch {
      message.error(t('family.form.photoBroken'));
    }
    return false;
  };

  const submit = async () => {
    const values = await form.validateFields();
    const payload = {
      ...values,
      birthDate: values.birthDate || '',
      deathDate: values.isAlive ? '' : values.deathDate || '',
      contacts: values.contacts || {},
    };
    setSaving(true);
    if (onSubmitOverride) {
      // Public links: the form becomes a proposal (or a direct edit) sent through the link.
      try {
        await onSubmitOverride({ payload, photo: photo?.blob || null, full: photo?.full || null, draft });
      } catch (err) {
        message.error(errorMessage(err));
      } finally {
        setSaving(false);
      }
      return;
    }
    try {
      let saved;
      if (person) saved = (await familyApi.updatePerson(person.id, payload)).data.person;
      else saved = (await familyApi.createPerson(treeId, { ...payload, relation: draft?.relation })).data.person;
      if (photo) saved = (await familyApi.uploadPhoto(saved.id, photo.blob, photo.full)).data.person;
      else if (removePhoto && person?.photoUrl) saved = (await familyApi.deletePhoto(saved.id)).data.person;
      message.success(person ? t('family.form.saved') : t('family.form.added', { name: shortName(saved) }));
      onSaved?.(saved);
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const datePlaceholder = t('family.form.datePlaceholder');

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={460}
      forceRender
      title={draft?.title || (person ? t('family.form.editTitle') : t('family.form.newTitle'))}
      className="fam-editor"
      footer={
        <div className="fam-editor__footer">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="primary" loading={saving} onClick={submit}>
            {submitLabel || (person ? t('common.save') : t('family.form.add'))}
          </Button>
        </div>
      }
    >
      {!(publicMode && !person) && (
      <div className="fam-editor__photo">
        <Avatar person={preview} size={96} />
        <Space direction="vertical" size={6}>
          <Upload accept="image/jpeg,image/png,image/webp" showUploadList={false} beforeUpload={pick}>
            <Button icon={<CameraOutlined />}>{preview.photoUrl ? t('family.form.changePhoto') : t('family.form.addPhoto')}</Button>
          </Upload>
          {preview.photoUrl && !publicMode && (
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                setPhoto(null);
                setRemovePhoto(true);
              }}
            >
              {t('family.form.removePhoto')}
            </Button>
          )}
          <span className="fam-hint">{t('family.form.photoHint')}</span>
        </Space>
      </div>
      )}

      <Form form={form} layout="vertical" requiredMark={false} onFinish={submit} className="fam-form">
        <Form.Item name="gender" label={t('family.form.gender')}>
          <Segmented
            block
            options={[
              { value: 'male', label: t('family.gender.male'), icon: <ManOutlined /> },
              { value: 'female', label: t('family.gender.female'), icon: <WomanOutlined /> },
              { value: 'unknown', label: t('family.gender.unknown'), icon: <QuestionOutlined /> },
            ]}
          />
        </Form.Item>
        <div className="fam-form__row">
          <Form.Item name="lastName" label={t('family.form.lastName')}>
            <Input autoComplete="off" maxLength={80} />
          </Form.Item>
          <Form.Item
            name="firstName"
            label={t('family.form.firstName')}
            rules={[
              ({ getFieldValue }) => ({
                validator: (_r, value) =>
                  value?.trim() || getFieldValue('lastName')?.trim() ? Promise.resolve() : Promise.reject(new Error(t('family.form.nameRequired'))),
              }),
            ]}
          >
            <Input autoComplete="off" maxLength={80} autoFocus={!person} />
          </Form.Item>
        </div>
        <div className="fam-form__row">
          <Form.Item name="patronymic" label={t('family.form.patronymic')}>
            <Input autoComplete="off" maxLength={80} />
          </Form.Item>
          {(gender === 'female' || maiden) && (
            <Form.Item name="maidenName" label={t('family.form.maidenName')}>
              <Input autoComplete="off" maxLength={80} />
            </Form.Item>
          )}
        </div>
        <div className="fam-form__row">
          <Form.Item name="birthDate" label={t('family.form.birthDate')} rules={[dateRule(t)]} validateTrigger="onBlur" extra={t('family.form.dateHint')}>
            <PartialDate placeholder={datePlaceholder} />
          </Form.Item>
          <Form.Item name="birthPlace" label={t('family.form.birthPlace')}>
            <Input maxLength={160} />
          </Form.Item>
        </div>
        <Form.Item name="isAlive" label={t('family.form.isAlive')} valuePropName="checked">
          <Switch checkedChildren={t('family.form.alive')} unCheckedChildren={t('family.form.dead')} />
        </Form.Item>
        {isAlive === false && (
          <div className="fam-form__row">
            <Form.Item name="deathDate" label={t('family.form.deathDate')} rules={[dateRule(t)]} validateTrigger="onBlur">
              <PartialDate placeholder={datePlaceholder} />
            </Form.Item>
            <Form.Item name="deathPlace" label={t('family.form.deathPlace')}>
              <Input maxLength={160} />
            </Form.Item>
          </div>
        )}
        <Form.Item name="occupation" label={t('family.form.occupation')}>
          <Input maxLength={160} />
        </Form.Item>
        <Form.Item name="bio" label={t('family.form.bio')}>
          <Input.TextArea autoSize={{ minRows: 3, maxRows: 10 }} maxLength={20000} placeholder={t('family.form.bioPlaceholder')} />
        </Form.Item>
        {!hideContacts && (
        <Collapse
          ghost
          size="small"
          items={[
            {
              key: 'contacts',
              label: t('family.form.contacts'),
              children: (
                <div className="fam-form__contacts">
                  {CONTACTS.map((key) => (
                    <Form.Item key={key} name={['contacts', key]} label={t(`family.contact.${key}`)}>
                      <Input maxLength={200} />
                    </Form.Item>
                  ))}
                </div>
              ),
            },
          ]}
        />
        )}
        <button type="submit" hidden aria-hidden="true" />
      </Form>
    </Drawer>
  );
}
