import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { App, AutoComplete, Badge, Button, Dropdown, Grid, Input, Popover, Result, Segmented, Select, Spin, Tooltip } from 'antd';
import {
  ApartmentOutlined,
  CalendarOutlined,
  CopyOutlined,
  HistoryOutlined,
  DownOutlined,
  FilterOutlined,
  InboxOutlined,
  PlusOutlined,
  SettingOutlined,
  UserOutlined,
  BarsOutlined,
  UnorderedListOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ImportOutlined,
  LinkOutlined,
  SearchOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import ModuleHeader from '../../shared/ModuleHeader';
import AccessDialog from '../../shared/AccessDialog';
import { useLocale } from '../../../context/LocaleContext';
import { errorMessage } from '../../../lib/errors';
import { familyApi } from '../api';
import { displayName, lifeYears, searchText, shortName } from '../format';
import { indexTree, kinOf } from '../kin';
import { useFamily } from '../FamilyContext';
import TreeCanvas, { Avatar } from '../components/TreeCanvas';
import CalendarView from '../components/CalendarView';
import TimelineView from '../components/TimelineView';
import PeopleList from '../components/PeopleList';
import ViewBuilder from '../components/ViewBuilder';
import SuggestionsInbox from '../components/SuggestionsInbox';
import LogDrawer from '../components/LogDrawer';
import { buildFamilies } from '../layout';
import { kinLabel, kinship } from '../kinship';
import PersonPanel from '../components/PersonPanel';
import PersonEditor from '../components/PersonEditor';
import { CloneDialog, ImportDialog, LinkDialog, ShareDialog, TreeDialog, UnionDialog } from '../components/Dialogs';

const LEVELS = { none: 0, view: 1, edit: 2, manage: 3 };

/** Draft for the editor when adding a relative of `anchor`. */
function relativeDraft(kind, anchor, index, t) {
  const kin = kinOf(index, anchor.id);
  const name = shortName(anchor);
  const defaults = {};
  if (kind === 'parent') {
    const other = kin.parents[0]?.person;
    if (other?.gender === 'male') defaults.gender = 'female';
    else if (other?.gender === 'female') {
      defaults.gender = 'male';
    }
    if (defaults.gender === 'male' || (!other && anchor.lastName)) defaults.lastName = anchor.lastName;
  }
  if (kind === 'sibling') defaults.lastName = anchor.lastName;
  if (kind === 'child') {
    const father = anchor.gender === 'male' ? anchor : kin.partners.find((p) => p.person.gender === 'male')?.person;
    if (father?.lastName) defaults.lastName = father.lastName;
  }
  if (kind === 'partner') {
    if (anchor.gender === 'male') defaults.gender = 'female';
    if (anchor.gender === 'female') defaults.gender = 'male';
  }
  const relation = { type: kind, personId: anchor.id };
  // A child of someone in a couple belongs to both partners by default.
  if (kind === 'child' && kin.partners.length === 1) relation.otherParentId = kin.partners[0].person.id;
  // No parents yet: the server adds a father to link the two through.
  if (kind === 'sibling' && !kin.parents.length) relation.parentName = t('family.add.fatherPlaceholder');
  return { relation, defaults, title: t(`family.add.title.${kind}`, { name }) };
}

export default function TreeView() {
  const { t } = useLocale();
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const treeId = Number(id);
  const [params, setParams] = useSearchParams();
  const { config, reload: reloadHome } = useFamily();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [editor, setEditor] = useState(null);
  const [linker, setLinker] = useState(null);
  const [unionEdit, setUnionEdit] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [query, setQuery] = useState('');
  const [builder, setBuilder] = useState(null);
  const [inbox, setInbox] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [customFilter, setCustomFilter] = useState(null);
  const [viewIds, setViewIds] = useState(null);
  const [mePicker, setMePicker] = useState(false);
  const canvas = useRef(null);

  const selectedId = Number(params.get('p')) || null;
  const view = ['timeline', 'list', 'calendar'].includes(params.get('v')) ? params.get('v') : 'tree';
  const viewParam = params.get('view');
  const activeViewId = viewParam === 'custom' ? 'custom' : Number(viewParam) || null;
  const setParam = useCallback(
    (key, value) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, String(value));
          else next.delete(key);
          return next;
        },
        { replace: true }
      ),
    [setParams]
  );
  const select = useCallback(
    (personId) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (personId) next.set('p', String(personId));
          else next.delete('p');
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  const load = useCallback(async () => {
    try {
      setData((await familyApi.tree(treeId)).data);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, [treeId]);
  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const index = useMemo(() => indexTree(data), [data]);
  const activeView = typeof activeViewId === 'number' ? data?.views?.find((v) => v.id === activeViewId) || null : null;

  // The people of the active view: asked from the server (the same rules
  // that public links use), the rest of the screen just filters by them.
  useEffect(() => {
    if (!data) return undefined;
    const filter = activeView ? activeView.filter : activeViewId === 'custom' ? customFilter : null;
    if (!filter) {
      setViewIds(null);
      return undefined;
    }
    let live = true;
    familyApi
      .select(treeId, filter)
      .then((res) => live && setViewIds(new Set(res.data.ids)))
      .catch(() => live && setViewIds(null));
    return () => {
      live = false;
    };
  }, [data, activeView, activeViewId, customFilter, treeId]);

  const shown = useMemo(() => {
    if (!data || !viewIds) return data;
    return {
      ...data,
      persons: data.persons.filter((p) => viewIds.has(p.id)),
      parents: data.parents.filter((l) => viewIds.has(l.childId) && viewIds.has(l.parentId)),
      unions: data.unions.filter((u) => viewIds.has(u.partnerA) && viewIds.has(u.partnerB)),
    };
  }, [data, viewIds]);

  // The panel of a filtered view shows only the view's people.
  const shownIndex = useMemo(() => (viewIds && shown ? indexTree(shown) : index), [viewIds, shown, index]);

  // Kinship to «me» for the panel.
  const kinGraph = useMemo(() => (data ? { ...buildFamilies(data.persons, data.parents, data.unions), byId: index.persons } : null), [data, index]);
  const relationTo = useCallback(
    (personId) => (data?.meId && kinGraph && personId !== data.meId ? kinLabel(t, kinship(kinGraph, kinGraph.byId, data.meId, personId)) : null),
    [data, kinGraph, t]
  );
  const setMe = async (personId) => {
    try {
      await familyApi.setMe(treeId, personId);
      message.success(personId ? t('family.me.set') : t('family.me.cleared'));
      setMePicker(false);
      load();
    } catch (err) {
      message.error(errorMessage(err));
    }
  };
  const level = LEVELS[data?.tree?.level] || 0;
  const canEdit = level >= LEVELS.edit;
  const canManage = level >= LEVELS.manage;
  // Phones: share and access go into «more», the title keeps its room.
  const phone = Grid.useBreakpoint().sm === false;

  // Selecting someone from the panel or search brings them into view.
  const focus = useCallback(
    (personId) => {
      select(personId);
      requestAnimationFrame(() => canvas.current?.centerOn?.(personId));
    },
    [select]
  );

  const quickAdd = useCallback(
    (personId, kind) => {
      const anchor = index.persons.get(personId);
      if (anchor) setEditor(relativeDraft(kind, anchor, index, t));
    },
    [index, t]
  );

  const saved = async (person) => {
    setEditor(null);
    await load();
    if (person?.id) focus(person.id);
  };

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !data) return [];
    return data.persons
      .filter((p) => searchText(p).includes(q))
      .slice(0, 12)
      .map((p) => ({
        value: String(p.id),
        label: (
          <span className="fam-option">
            <Avatar person={p} size={24} />
            <span>{displayName(p)}</span>
            <span className="fam-option__years">{lifeYears(p)}</span>
          </span>
        ),
      }));
  }, [query, data]);

  if (error) {
    const status = error?.response?.status;
    return (
      <Result
        status={status === 404 ? '404' : 'warning'}
        title={status === 404 ? t('family.notFound') : errorMessage(error)}
        extra={<Button onClick={() => navigate('/app/family')}>{t('family.backToTrees')}</Button>}
      />
    );
  }
  if (!data) {
    return (
      <div className="page-fallback">
        <Spin />
      </div>
    );
  }

  const tree = data.tree;
  const exportFile = (format) => {
    window.location.href = familyApi.exportUrl(treeId, format);
  };
  const removeTree = () =>
    modal.confirm({
      title: t('family.tree.deleteTitle', { name: tree.name }),
      content: t('family.tree.deleteText', { count: data.persons.length }),
      okText: t('common.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await familyApi.deleteTree(treeId);
          reloadHome();
          navigate('/app/family');
        } catch (err) {
          message.error(errorMessage(err));
        }
      },
    });

  return (
    <div className="fam-view">
      <ModuleHeader
        className="fam-head"
        crumbs={[
          { key: 'root', label: t('apps.family.name'), to: '/app/family' },
          { key: 'cur', label: tree.name },
        ]}
        icon={<ApartmentOutlined />}
        title={tree.name}
        status={phone ? null : viewIds ? t('family.views.shown', { count: shown.persons.length, total: data.persons.length }) : t('family.peopleCount', { count: data.persons.length })}
        meta={
          data.persons.length > 0 && (
            <div className="fam-meta">
              {phone && <span className="fam-meta__count">{viewIds ? t('family.views.shown', { count: shown.persons.length, total: data.persons.length }) : t('family.peopleCount', { count: data.persons.length })}</span>}
              {data.meId && index.persons.has(data.meId) ? (
                <button type="button" className="fam-me" onClick={() => focus(data.meId)}>
                  <Avatar person={index.persons.get(data.meId)} size={22} />
                  <span>{t('family.me.chip', { name: shortName(index.persons.get(data.meId)) })}</span>
                </button>
              ) : (
                <Popover
                  open={mePicker}
                  onOpenChange={setMePicker}
                  trigger="click"
                  title={t('family.me.pickTitle')}
                  content={
                    <Select
                      showSearch
                      autoFocus
                      style={{ width: 300 }}
                      placeholder={t('family.me.pick')}
                      options={data.persons.map((p) => ({ value: p.id, label: displayName(p), search: searchText(p) }))}
                      filterOption={(input, option) => option.search.includes(input.toLowerCase())}
                      onChange={setMe}
                    />
                  }
                >
                  <button type="button" className="fam-me fam-me--empty">
                    <UserOutlined />
                    <span>{t('family.me.whoAmI')}</span>
                  </button>
                </Popover>
              )}
            </div>
          )
        }
        dock={false}
        actions={[
          canEdit && { key: 'add', primary: true, icon: <UserAddOutlined />, label: t('family.addPerson'), onClick: () => setEditor({}), tour: 'family.add' },
          canManage && !phone && { key: 'share', icon: <LinkOutlined />, label: t('family.share.button'), onClick: () => setDialog('share'), tour: 'family.share' },
          canManage && !phone && { key: 'access', icon: <TeamOutlined />, label: t('family.access'), onClick: () => setDialog('access') },
          canEdit &&
            data.pendingSuggestions > 0 && {
              key: 'inbox',
              icon: (
                <Badge count={data.pendingSuggestions} size="small" offset={[4, -2]}>
                  <InboxOutlined />
                </Badge>
              ),
              label: t('family.inbox.button'),
              onClick: () => setInbox(true),
            },
        ]}
        more={[
          canManage && phone && { key: 'share', icon: <LinkOutlined />, label: t('family.share.button'), onClick: () => setDialog('share') },
          canManage && phone && { key: 'access', icon: <TeamOutlined />, label: t('family.access'), onClick: () => setDialog('access') },
          canManage && phone && { type: 'divider' },
          canManage && { key: 'rename', icon: <EditOutlined />, label: t('family.tree.rename'), onClick: () => setDialog('rename') },
          canEdit && { key: 'import', icon: <ImportOutlined />, label: t('family.import.title'), onClick: () => setDialog('import') },
          canEdit && { key: 'inbox', icon: <InboxOutlined />, label: t('family.inbox.title'), onClick: () => setInbox(true) },
          canManage && { key: 'log', icon: <HistoryOutlined />, label: t('family.log.title'), onClick: () => setLogOpen(true) },
          { key: 'clone', icon: <CopyOutlined />, label: activeView ? t('family.clone.view') : t('family.clone.tree'), onClick: () => setDialog('clone') },
          { key: 'json', icon: <DownloadOutlined />, label: t('family.export.json'), onClick: () => exportFile('') },
          { key: 'gedcom', icon: <DownloadOutlined />, label: t('family.export.gedcom'), onClick: () => exportFile('gedcom') },
          canManage && { type: 'divider' },
          canManage && { key: 'delete', icon: <DeleteOutlined />, danger: true, label: t('family.tree.delete'), onClick: removeTree },
        ].filter(Boolean)}
        tools={
          data.persons.length > 0 && (
            <Segmented
              block={phone}
              className="fam-modes"
              value={view}
              data-tour="family.view"
              onChange={(next) =>
                setParams(
                  (prev) => {
                    const p = new URLSearchParams(prev);
                    if (next === 'tree') p.delete('v');
                    else p.set('v', next);
                    return p;
                  },
                  { replace: true }
                )
              }
              options={[
                { value: 'tree', icon: <ApartmentOutlined />, label: t('family.view.tree') },
                { value: 'timeline', icon: <BarsOutlined />, label: t('family.view.timeline') },
                { value: 'list', icon: <UnorderedListOutlined />, label: t('family.view.list') },
                { value: 'calendar', icon: <CalendarOutlined />, label: t('family.view.calendar') },
              ]}
            />
          )
        }
        filters={
          data.persons.length > 0 && (
            <div className="fam-filters">
              <Dropdown
                trigger={['click']}
                menu={{
                  selectedKeys: [String(activeViewId || 'all')],
                  items: [
                    { key: 'all', icon: <ApartmentOutlined />, label: t('family.views.whole') },
                    ...(data.views.length ? [{ type: 'divider' }] : []),
                    ...data.views.map((v) => ({ key: String(v.id), icon: <FilterOutlined />, label: v.name })),
                    ...(activeViewId === 'custom' ? [{ key: 'custom', icon: <FilterOutlined />, label: t('family.views.custom') }] : []),
                    { type: 'divider' },
                    { key: 'new', icon: <PlusOutlined />, label: t('family.views.new') },
                    activeView && { key: 'edit', icon: <SettingOutlined />, label: t('family.views.edit') },
                  ].filter(Boolean),
                  onClick: ({ key }) => {
                    if (key === 'all') setParam('view', null);
                    else if (key === 'new') setBuilder({ view: null });
                    else if (key === 'edit') setBuilder({ view: activeView });
                    else setParam('view', key);
                  },
                }}
              >
                <Button className={`fam-viewbtn${activeViewId ? ' is-active' : ''}`} icon={<FilterOutlined />} data-tour="family.views">
                  <span className="fam-viewbtn__label">{activeView ? activeView.name : activeViewId === 'custom' ? t('family.views.custom') : t('family.views.whole')}</span>
                  <DownOutlined />
                </Button>
              </Dropdown>
              {activeView && canEdit && (
                <Tooltip title={t('family.views.edit')}>
                  <Button icon={<SettingOutlined />} onClick={() => setBuilder({ view: activeView })} aria-label={t('family.views.edit')} />
                </Tooltip>
              )}
              {activeViewId === 'custom' && (
                <Tooltip title={t('family.views.edit')}>
                  <Button icon={<SettingOutlined />} onClick={() => setBuilder({ view: null })} aria-label={t('family.views.edit')} />
                </Tooltip>
              )}
              {!['list', 'calendar'].includes(view) && (
            <AutoComplete
              className="fam-search"
              options={options}
              value={query}
              onChange={setQuery}
              onSelect={(value) => {
                setQuery('');
                focus(Number(value));
              }}
              popupMatchSelectWidth={320}
            >
              <Input prefix={<SearchOutlined />} placeholder={t('family.searchPlaceholder')} allowClear data-tour="family.search" />
            </AutoComplete>
              )}
            </div>
          )
        }
      />

      <div className={`fam-body${selectedId ? ' has-panel' : ''}`}>
        {data.persons.length && view === 'calendar' ? (
          <CalendarView data={shown} selectedId={selectedId} onSelect={select} relationTo={relationTo} title={activeView ? activeView.name : tree.name} />
        ) : data.persons.length && view === 'list' ? (
          <PeopleList data={shown} selectedId={selectedId} onSelect={select} onOpen={(personId) => canEdit && setEditor({ person: index.persons.get(personId) })} />
        ) : data.persons.length && view === 'timeline' ? (
          <TimelineView data={shown} selectedId={selectedId} onSelect={select} onOpen={(personId) => canEdit && setEditor({ person: index.persons.get(personId) })} />
        ) : data.persons.length ? (
          <TreeCanvas
            key={activeViewId || 'all'}
            ref={canvas}
            data={shown}
            selectedId={selectedId}
            onSelect={select}
            onOpen={(personId) => canEdit && setEditor({ person: index.persons.get(personId) })}
            onQuickAdd={quickAdd}
            onUnion={(shown) => {
              const union = data.unions.find((u) => u.id === shown?.id);
              if (!union) return;
              const a = index.persons.get(union.partnerA);
              const b = index.persons.get(union.partnerB);
              setUnionEdit({ union, names: `${a ? shortName(a) : '?'} & ${b ? shortName(b) : '?'}` });
            }}
            onPlaceholder={(node) => {
              const parent = index.persons.get(node.of);
              if (!parent) return;
              if (!canEdit) {
                select(parent.id);
                return;
              }
              // Children of this parent with no second parent: the new person becomes it.
              const counts = new Map();
              for (const l of data.parents) counts.set(l.childId, (counts.get(l.childId) || 0) + 1);
              const childIds = data.parents.filter((l) => l.parentId === parent.id && counts.get(l.childId) === 1).map((l) => l.childId);
              setEditor({
                title: t('family.ghost.addTitle', { name: shortName(parent) }),
                relation: { type: 'coparent', personId: parent.id, childIds },
                defaults: { gender: node.person.gender },
              });
            }}
            canEdit={canEdit}
            homeId={activeView?.filter.focus || data.meId || tree.homePersonId}
          />
        ) : (
          <div className="fam-empty">
            <div className="fam-empty__art" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <h2>{t('family.empty.title')}</h2>
            <p>{t('family.empty.text')}</p>
            {canEdit && (
              <Button type="primary" size="large" icon={<UserAddOutlined />} onClick={() => setEditor({})}>
                {t('family.empty.cta')}
              </Button>
            )}
          </div>
        )}
        {selectedId && index.persons.has(selectedId) && (
          <PersonPanel
            index={shownIndex}
            fullIndex={index}
            onShowAll={(personId) => {
              setParam('view', null);
              setTimeout(() => canvas.current?.centerOn?.(personId), 400);
            }}
            personId={selectedId}
            treeId={treeId}
            canEdit={canEdit}
            canManage={canManage}
            homeId={tree.homePersonId}
            onClose={() => select(null)}
            onSelect={focus}
            onEdit={(person) => setEditor({ person })}
            onAdd={quickAdd}
            onLink={(personId, kind) => setLinker({ personId, kind })}
            onUnion={(union, names) => setUnionEdit({ union, names })}
            onChanged={load}
            relation={relationTo(selectedId)}
            isMe={data.meId === selectedId}
            onSetMe={(personId) => setMe(personId)}
            onSetHome={async (personId) => {
              try {
                await familyApi.updateTree(treeId, { homePersonId: personId });
                message.success(t('family.panel.homeSet'));
                load();
              } catch (err) {
                message.error(errorMessage(err));
              }
            }}
          />
        )}
      </div>

      <ViewBuilder
        open={Boolean(builder)}
        treeId={treeId}
        data={data}
        meId={data.meId}
        view={builder?.view || null}
        filter={activeViewId === 'custom' ? customFilter : null}
        canEdit={canEdit}
        onClose={() => setBuilder(null)}
        onApply={(filter) => {
          setCustomFilter(filter);
          setParam('view', 'custom');
          setBuilder(null);
        }}
        onSaved={async (saved) => {
          setBuilder(null);
          await load();
          setParam('view', saved.id);
        }}
        onDeleted={async () => {
          setBuilder(null);
          setParam('view', null);
          await load();
        }}
      />
      <LogDrawer
        open={logOpen}
        treeId={treeId}
        onClose={() => setLogOpen(false)}
        onPerson={(personId) => {
          if (!index.persons.has(personId)) return;
          setLogOpen(false);
          focus(personId);
        }}
      />
      <SuggestionsInbox open={inbox} treeId={treeId} persons={index.persons} onClose={() => setInbox(false)} onChanged={load} />
      <CloneDialog
        open={dialog === 'clone'}
        defaultName={activeView ? activeView.name : tree.name}
        onClose={() => setDialog(null)}
        onClone={async (name) => {
          const res = await familyApi.cloneTree(treeId, { name, viewId: activeView?.id });
          message.success(t('family.clone.done', { count: res.data.persons }));
          setDialog(null);
          reloadHome();
          navigate(`/app/family/t/${res.data.id}`);
        }}
      />
      <PersonEditor open={Boolean(editor)} treeId={treeId} draft={editor} onClose={() => setEditor(null)} onSaved={saved} />
      <LinkDialog
        open={Boolean(linker)}
        kind={linker?.kind}
        personId={linker?.personId}
        index={index}
        treeId={treeId}
        onClose={() => setLinker(null)}
        onDone={() => {
          setLinker(null);
          load();
        }}
      />
      <UnionDialog
        open={Boolean(unionEdit)}
        union={unionEdit?.union}
        names={unionEdit?.names}
        onClose={() => setUnionEdit(null)}
        onDone={() => {
          setUnionEdit(null);
          load();
        }}
      />
      <TreeDialog
        open={dialog === 'rename'}
        tree={tree}
        onClose={() => setDialog(null)}
        onSaved={() => {
          setDialog(null);
          load();
          reloadHome();
        }}
      />
      <ShareDialog open={dialog === 'share'} tree={tree} views={data.views} activeViewId={activeView?.id || null} config={config} onClose={() => setDialog(null)} />
      <ImportDialog
        open={dialog === 'import'}
        tree={tree}
        onClose={() => setDialog(null)}
        onDone={() => {
          setDialog(null);
          load();
        }}
      />
      {dialog === 'access' && (
        <AccessDialog
          open
          title={t('family.accessTitle', { name: tree.name })}
          load={async () => (await familyApi.access(treeId)).data}
          loadSubjects={async () => (await familyApi.subjects()).data}
          save={(entries) => familyApi.saveAccess(treeId, entries)}
          levelKey="family.level"
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
