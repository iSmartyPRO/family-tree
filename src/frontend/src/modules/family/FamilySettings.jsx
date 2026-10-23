import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Form, InputNumber, Switch } from 'antd';
import SaveBar from '../../components/ui/SaveBar';
import LoadState from '../../components/ui/LoadState';
import { SettingRow, SettingsSection } from '../../components/ui/SettingsSection';
import { useAdminSettings } from '../../hooks/useAdminSettings';
import { useSettingsForm } from '../../hooks/useSettingsForm';
import { useLocale } from '../../context/LocaleContext';
import SettingsPageHeader from '../../pages/admin/settings/SettingsPageHeader';

function FamilyForm({ settings, save }) {
  const { t } = useLocale();
  const state = settings.modules?.family || { enabled: true, settings: {} };
  const initial = useMemo(() => ({ enabled: state.enabled, ...state.settings }), [state]);
  const { dirty, saving, submit, reset, formProps } = useSettingsForm(initial, ({ enabled, ...rest }) =>
    save({ modules: { family: { enabled, settings: rest } } })
  );

  return (
    <Form {...formProps}>
      <SettingsSection>
        <SettingRow label={t('modules.enabledLabel')} description={t('familySettings.enabledDesc')}>
          <Form.Item name="enabled" valuePropName="checked" noStyle>
            <Switch />
          </Form.Item>
        </SettingRow>
        <SettingRow label={t('familySettings.open')} description={t('familySettings.openDesc')}>
          <Link to="/app/family">{t('familySettings.openLink')} →</Link>
        </SettingRow>
        <SettingRow label={t('familySettings.maxPhoto')} description={t('familySettings.maxPhotoDesc')}>
          <Form.Item name="maxPhotoMb" noStyle>
            <InputNumber min={1} max={50} suffix={t('familySettings.mb')} />
          </Form.Item>
        </SettingRow>
      </SettingsSection>
      <SettingsSection title={t('familySettings.links')}>
        <SettingRow label={t('familySettings.publicLinks')} description={t('familySettings.publicLinksDesc')}>
          <Form.Item name="publicLinks" valuePropName="checked" noStyle>
            <Switch />
          </Form.Item>
        </SettingRow>
        <SettingRow label={t('familySettings.requirePassword')} description={t('familySettings.requirePasswordDesc')}>
          <Form.Item name="requireSharePassword" valuePropName="checked" noStyle>
            <Switch />
          </Form.Item>
        </SettingRow>
        <SettingRow label={t('familySettings.maxDays')} description={t('familySettings.maxDaysDesc')}>
          <Form.Item name="maxShareDays" noStyle>
            <InputNumber min={0} max={3650} suffix={t('settings.login.days')} />
          </Form.Item>
        </SettingRow>
      </SettingsSection>
      <SaveBar visible={dirty} saving={saving} onSave={submit} onReset={reset} />
    </Form>
  );
}

/** Settings → Modules → Family tree. */
export default function FamilySettings() {
  const { settings, ready, error, refresh, save } = useAdminSettings();
  return (
    <>
      <SettingsPageHeader id="family" />
      <LoadState ready={ready} error={error} onRetry={refresh}>
        {settings && <FamilyForm settings={settings} save={save} />}
      </LoadState>
    </>
  );
}
