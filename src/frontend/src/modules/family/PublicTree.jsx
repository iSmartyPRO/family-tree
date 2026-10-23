import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { App, Button, Dropdown, Grid, Input, Modal, Segmented, Spin, Upload } from 'antd';
import {
  ApartmentOutlined,
  BarsOutlined,
  CameraOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  EditOutlined,
  LockOutlined,
  StopOutlined,
  CloseOutlined,
  UnorderedListOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { prepareFull, preparePhoto } from './api';
import { shortName } from './format';
import PersonEditor from './components/PersonEditor';
import TimelineView from './components/TimelineView';
import PeopleList from './components/PeopleList';
import { CloneDialog } from './components/Dialogs';
import PublicGuide from './components/PublicGuide';
import { useThemeMode } from '../../context/ThemeContext';
import { familyApi } from './api';
import BrandMark from '../../components/BrandMark';
import LanguageSwitch from '../../components/LanguageSwitch';
import ThemeSwitch from '../../components/ThemeSwitch';
import { useLocale } from '../../context/LocaleContext';
import { useSettings } from '../../context/SettingsContext';
import { errorMessage } from '../../lib/errors';
import { publicFamilyApi } from './api';
import { indexTree } from './kin';
import TreeCanvas from './components/TreeCanvas';
import PersonPanel from './components/PersonPanel';
import './family.css';

const storageKey = (token) => `family_share_${token}`;
const VISITOR_KEY = 'family_visitor';
const readVisitor = () => {
  try {
    return JSON.parse(localStorage.getItem(VISITOR_KEY) || 'null');
  } catch {
    return null;
  }
};
const visitorKey = (token) => `family_visitor_token_${token}`;
const readVisitorToken = (token) => {
  try {
    return localStorage.getItem(visitorKey(token)) || '';
  } catch {
    return '';
  }
};
const readUnlock = (token) => {
  try {
    return sessionStorage.getItem(storageKey(token)) || '';
  } catch {
    return '';
  }
};

/** /t/:token — a family tree shared by a link: read-only, maybe behind a password. */
export default function PublicTree() {
  const { t } = useLocale();
  const { settings } = useSettings();
  const { token } = useParams();
  const [state, setState] = useState({ loading: true });
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState('tree');
  const phone = Grid.useBreakpoint().sm === false;
  const [bannerHidden, setBannerHidden] = useState(false);
  const [editor, setEditor] = useState(null);
  const [visitor, setVisitor] = useState(readVisitor);
  const [askName, setAskName] = useState(null);
  const [cloning, setCloning] = useState(false);
  const canvas = useRef(null);
  const { message } = App.useApp();
  const { preference: themePref, setPersonalPreview, clearPersonalPreview } = useThemeMode();
  const { user } = useAuth() || {};
  const navigate = useNavigate();

  // Tokens sent with every request: the password unlock and «who is visiting».
  const who = useCallback(() => ({ unlock: readUnlock(token), visitor: readVisitorToken(token) }), [token]);

  const load = useCallback(async () => {
    const unlock = readUnlock(token);
    try {
      const { data } = await publicFamilyApi.tree(token, who());
      // Protected links: photos need the unlock token too.
      if (unlock)
        for (const p of data.persons) {
          if (p.photoUrl) p.photoUrl += `&t=${encodeURIComponent(unlock)}`;
          if (p.photoFullUrl) p.photoFullUrl += `&t=${encodeURIComponent(unlock)}`;
        }
      setState({ data });
    } catch (err) {
      setState({ error: err?.response?.data?.code || 'ERROR', message: errorMessage(err), identity: err?.response?.data?.info || null });
    }
  }, [token, who]);

  /** Introduce oneself to this link; remembered in this browser for the next visit. */
  const introduce = async ({ name, phone, note }) => {
    const { data } = await publicFamilyApi.hello(token, who(), { name, phone });
    try {
      localStorage.setItem(visitorKey(token), data.token);
      localStorage.setItem(VISITOR_KEY, JSON.stringify({ name, phone, note }));
    } catch {
      /* private mode: asked again next time */
    }
    setVisitor({ name, phone, note });
    return data;
  };
  useEffect(() => {
    load();
  }, [load]);

  const index = useMemo(() => indexTree(state.data), [state.data]);

  // The link's look: a default colour scheme (applied once, the visitor may
  // switch) or a forced one (applied always, the switch is hidden).
  const look = state.data?.share || state.identity || null;
  const lockedTheme = look?.themeLocked && look.theme !== 'system' ? look.theme : null;
  // Applied as a temporary preview: the visitor's own saved choice is never overwritten.
  const chosenKey = `family_theme_${token}`;
  const prefAtApply = useRef(null);
  useEffect(() => {
    if (!look?.theme || look.theme === 'system') return undefined;
    if (!look.themeLocked) {
      try {
        // The visitor already switched the scheme on this link: theirs wins.
        if (localStorage.getItem(chosenKey) === 'own') return undefined;
      } catch {
        /* private mode */
      }
    }
    prefAtApply.current = themePref;
    setPersonalPreview({ theme: look.theme });
    return () => {
      prefAtApply.current = null;
      clearPersonalPreview();
    };
  }, [look?.theme, look?.themeLocked, chosenKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // A default (not forced) scheme gives way as soon as the visitor switches.
  useEffect(() => {
    if (lockedTheme || prefAtApply.current === null || themePref === prefAtApply.current) return;
    prefAtApply.current = null;
    try {
      localStorage.setItem(chosenKey, 'own');
    } catch {
      /* private mode */
    }
    clearPersonalPreview();
  }, [themePref]); // eslint-disable-line react-hooks/exhaustive-deps
  const access = state.data?.share?.access || 'view';
  // A link that does not require it still asks the phone when proposing, as optional.
  const askPhone = state.data?.share?.askPhone && state.data.share.askPhone !== 'off' ? state.data.share.askPhone : 'optional';
  const canPropose = access === 'suggest' || access === 'edit';
  const draftName = visitor?.draftName ?? visitor?.name ?? '';
  const draftPhone = visitor?.draftPhone ?? visitor?.phone ?? '';

  // Visitors introduce themselves once; the owner sees who proposed what.
  const withVisitor = (action, onCancel) => {
    if (readVisitorToken(token)) action(visitor || {});
    else setAskName(() => ({ action, onCancel }));
  };
  // The stored introduction expired or no longer fits the link: ask again.
  const identityLost = (err) => {
    if (err?.response?.data?.code !== 'IDENTITY_REQUIRED') return false;
    try {
      localStorage.removeItem(visitorKey(token));
    } catch {
      /* private mode */
    }
    return true;
  };
  const done = async (res) => {
    if (res.data.applied) {
      message.success(t('family.public.applied'));
      await load();
    } else message.success(t('family.public.sent'));
  };
  const sendPhoto = (person) => async (file) => {
    const attempt = (retry) =>
      withVisitor(async (whoami) => {
        try {
          const [blob, full] = await Promise.all([preparePhoto(file), prepareFull(file)]);
          await done(await publicFamilyApi.suggestPhoto(token, who(), person.id, blob, whoami, full));
        } catch (err) {
          if (retry && identityLost(err)) attempt(false);
          else message.error(errorMessage(err));
        }
      });
    attempt(true);
    return false;
  };
  const relativeDraft = (person, type) => ({
    title: t(`family.add.title.${type}`, { name: shortName(person) }),
    relation: { type, personId: person.id, ...(type === 'sibling' ? { parentName: t('family.add.fatherPlaceholder') } : {}) },
    defaults: {},
  });
  const submitProposal = async ({ payload, photo, full, draft }) =>
    new Promise((resolve, reject) => {
      const attempt = (retry) =>
        withVisitor(async (whoami) => {
        try {
          const { contacts, ...data } = payload;
          const body = draft?.person
            ? { kind: 'update', personId: draft.person.id, data, note: whoami.note }
            : { kind: 'relative', personId: draft.relation.personId, relation: draft.relation, data, note: whoami.note };
          const res = await publicFamilyApi.suggest(token, who(), body);
          if (photo && draft?.person) await publicFamilyApi.suggestPhoto(token, who(), draft.person.id, photo, whoami, full);
          setEditor(null);
          await done(res);
          resolve();
        } catch (err) {
          if (retry && identityLost(err)) attempt(false);
          else reject(err);
        }
      }, resolve);
      attempt(true);
    });

  const unlock = async () => {
    setBusy(true);
    try {
      const { data } = await publicFamilyApi.unlock(token, password);
      try {
        sessionStorage.setItem(storageKey(token), data.token || '');
      } catch {
        /* private mode */
      }
      setPassword('');
      await load();
    } catch (err) {
      setState({ error: 'PASSWORD_REQUIRED', wrong: true, message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  let content;
  if (state.loading) {
    content = (
      <div className="page-fallback">
        <Spin size="large" />
      </div>
    );
  } else if (state.error === 'IDENTITY_REQUIRED') {
    content = <IdentityGate rule={state.identity || {}} initial={readVisitor() || {}} t={t} onSubmit={async (values) => {
      await introduce(values);
      await load();
    }} />;
  } else if (state.error === 'PASSWORD_REQUIRED') {
    content = (
      <div className="fam-notice">
        <LockOutlined className="fam-notice__icon" />
        <h1>{t('family.public.locked')}</h1>
        <p>{t('family.public.lockedText')}</p>
        <div className="fam-notice__form">
          <Input.Password value={password} onChange={(e) => setPassword(e.target.value)} onPressEnter={unlock} status={state.wrong ? 'error' : ''} autoFocus />
          <Button type="primary" loading={busy} onClick={unlock} disabled={!password}>
            {t('family.public.open')}
          </Button>
        </div>
        {state.wrong && <div className="fam-notice__error">{t('family.public.wrong')}</div>}
      </div>
    );
  } else if (state.error) {
    content = (
      <div className="fam-notice">
        {state.error === 'EXPIRED' ? <ClockCircleOutlined className="fam-notice__icon" /> : <StopOutlined className="fam-notice__icon" />}
        <h1>{state.error === 'EXPIRED' ? t('family.public.expired') : t('family.public.missing')}</h1>
        <p>{state.error === 'EXPIRED' ? t('family.public.expiredText') : t('family.public.missingText')}</p>
      </div>
    );
  } else {
    const { data } = state;
    content = (
      <div className="fam-view fam-view--public">
        <div className="fam-public-head">
          <span className="fam-public-head__icon">
            <ApartmentOutlined />
          </span>
          <div className="fam-public-head__title">
            <h1>{data.tree.name}</h1>
            {data.tree.description && <p>{data.tree.description}</p>}
            <div className="fam-public-head__chips">
              <span className="fam-chip">{t('family.peopleCount', { count: data.persons.length })}</span>
              {canPropose && <span className="fam-chip fam-chip--accent">{t(`family.share.level.${access}`)}</span>}
            </div>
          </div>
          <div className="fam-public-head__tools">
            <Segmented
              block={phone}
              className="fam-modes"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'tree', icon: <ApartmentOutlined />, label: t('family.view.tree') },
                { value: 'timeline', icon: <BarsOutlined />, label: t('family.view.timeline') },
                { value: 'list', icon: <UnorderedListOutlined />, label: t('family.view.list') },
              ]}
            />
            {data.share?.allowClone && (
              <Button
                icon={<CopyOutlined />}
                aria-label={t('family.public.saveToMine')}
                title={phone ? t('family.public.saveToMine') : undefined}
                onClick={() => (user ? setCloning(true) : navigate(`/login?next=${encodeURIComponent(`/t/${token}`)}`))}
              >
                {!phone && t('family.public.saveToMine')}
              </Button>
            )}
          </div>
        </div>
        {canPropose && !bannerHidden && (
          <div className="fam-public-banner">
            <span>{t(`family.public.banner.${access}`)}</span>
            <button type="button" className="fam-public-banner__close" onClick={() => setBannerHidden(true)} aria-label={t('common.close')}>
              <CloseOutlined />
            </button>
          </div>
        )}
        <div className={`fam-body${selectedId ? ' has-panel' : ''}`}>
          {mode === 'list' ? (
            <PeopleList data={data} selectedId={selectedId} onSelect={setSelectedId} />
          ) : mode === 'timeline' ? (
            <TimelineView data={data} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            <TreeCanvas ref={canvas} data={data} selectedId={selectedId} onSelect={setSelectedId} canEdit={false} homeId={data.tree.homePersonId} />
          )}
          {selectedId && index.persons.has(selectedId) && (
            <PersonPanel
              index={index}
              personId={selectedId}
              canEdit={false}
              onClose={() => setSelectedId(null)}
              extraActions={
                canPropose && (
                  <>
                    <Button type="primary" icon={<EditOutlined />} onClick={() => setEditor({ person: index.persons.get(selectedId) })}>
                      {t('family.public.complete')}
                    </Button>
                    <Upload accept="image/jpeg,image/png,image/webp" showUploadList={false} beforeUpload={sendPhoto(index.persons.get(selectedId))}>
                      <Button icon={<CameraOutlined />}>{t('family.public.photo')}</Button>
                    </Upload>
                    <Dropdown
                      trigger={['click']}
                      menu={{
                        items: ['parent', 'child', 'partner', 'sibling'].map((type) => ({ key: type, label: t(`family.add.${type}`) })),
                        onClick: ({ key }) => setEditor(relativeDraft(index.persons.get(selectedId), key)),
                      }}
                    >
                      <Button icon={<UserAddOutlined />}>{t('family.panel.addRelative')}</Button>
                    </Dropdown>
                  </>
                )
              }
              onSelect={(id) => {
                setSelectedId(id);
                requestAnimationFrame(() => canvas.current?.centerOn(id));
              }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fam-public">
      <header className="fam-public__bar">
        <span className="fam-public__brand">
          <BrandMark />
          <span>{settings?.appName}</span>
        </span>
        <span className="fam-public__tools">
          <LanguageSwitch />
          {!lockedTheme && <ThemeSwitch />}
        </span>
      </header>
      {content}
      {state.data?.share?.assistant && (
        <PublicGuide
          token={token}
          access={access}
          canPropose={canPropose}
          person={selectedId && index.persons.get(selectedId) ? shortName(index.persons.get(selectedId)) : null}
        />
      )}
      <PersonEditor
        open={Boolean(editor)}
        draft={editor}
        hideContacts
        publicMode
        submitLabel={access === 'edit' ? t('common.save') : t('family.public.send')}
        onClose={() => setEditor(null)}
        onSubmitOverride={submitProposal}
      />
      <Modal
        open={Boolean(askName)}
        title={t('family.public.whoTitle')}
        okText={t('family.public.continue')}
        cancelText={t('common.cancel')}
        onCancel={() => {
          const pending = askName;
          setAskName(null);
          pending?.onCancel?.();
        }}
        okButtonProps={{ disabled: !draftName.trim() || (askPhone === 'required' && !draftPhone.trim()) }}
        onOk={async () => {
          const me = { name: draftName.trim(), phone: draftPhone.trim(), note: visitor?.draftNote || '' };
          try {
            await introduce(me);
          } catch (err) {
            message.error(errorMessage(err));
            return;
          }
          const next = askName;
          setAskName(null);
          next?.action?.(me);
        }}
        destroyOnHidden
      >
        <p className="fam-hint">{t('family.public.whoText')}</p>
        <Input
          autoFocus
          placeholder={t('family.public.whoName')}
          value={visitor?.draftName ?? visitor?.name ?? ''}
          onChange={(e) => setVisitor((v) => ({ ...(v || {}), draftName: e.target.value }))}
          maxLength={120}
        />
        {askPhone !== 'off' && (
          <Input
            style={{ marginTop: 8 }}
            type="tel"
            placeholder={askPhone === 'required' ? t('family.public.whoPhone') : t('family.public.whoPhoneOptional')}
            value={visitor?.draftPhone ?? visitor?.phone ?? ''}
            onChange={(e) => setVisitor((v) => ({ ...(v || {}), draftPhone: e.target.value }))}
            maxLength={40}
          />
        )}
        <Input.TextArea
          style={{ marginTop: 8 }}
          placeholder={t('family.public.whoNote')}
          value={visitor?.draftNote || ''}
          onChange={(e) => setVisitor((v) => ({ ...(v || {}), draftNote: e.target.value }))}
          autoSize={{ minRows: 2, maxRows: 4 }}
          maxLength={500}
        />
      </Modal>
      <CloneDialog
        open={cloning}
        defaultName={state.data?.tree?.name}
        onClose={() => setCloning(false)}
        onClone={async (name) => {
          const res = await familyApi.cloneLink({ token, unlock: readUnlock(token), name });
          message.success(t('family.clone.done', { count: res.data.persons }));
          navigate(`/app/family/t/${res.data.id}`);
        }}
      />
    </div>
  );
}

/** The link wants to know who is visiting: name (and phone) before the tree opens. */
function IdentityGate({ rule, initial, t, onSubmit }) {
  const [name, setName] = useState(initial.name || '');
  const [phone, setPhone] = useState(initial.phone || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const needPhone = rule.askPhone === 'required';
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await onSubmit({ name: name.trim(), phone: phone.trim() });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fam-notice">
      <UserAddOutlined className="fam-notice__icon" />
      <h1>{t('family.public.gateTitle')}</h1>
      <p>{t(needPhone ? 'family.public.gateTextPhone' : 'family.public.gateText')}</p>
      <div className="fam-notice__stack">
        <Input size="large" autoFocus placeholder={t('family.public.whoName')} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} onPressEnter={submit} />
        {rule.askPhone && rule.askPhone !== 'off' && (
          <Input
            size="large"
            type="tel"
            placeholder={needPhone ? t('family.public.whoPhone') : t('family.public.whoPhoneOptional')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={40}
            onPressEnter={submit}
          />
        )}
        <Button type="primary" size="large" loading={busy} onClick={submit} disabled={name.trim().length < 2 || (needPhone && !phone.trim())}>
          {t('family.public.open')}
        </Button>
        {error && <div className="fam-notice__error">{error}</div>}
      </div>
      <p className="fam-hint">{t('family.public.gatePrivacy')}</p>
    </div>
  );
}
