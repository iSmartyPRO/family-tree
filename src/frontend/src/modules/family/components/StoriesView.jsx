import { useMemo, useState } from 'react';
import { App, Button, Dropdown, Progress } from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BookOutlined,
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  MoreOutlined,
  PlayCircleFilled,
  PlusOutlined,
} from '@ant-design/icons';
import { useLocale } from '../../../context/LocaleContext';
import { errorMessage } from '../../../lib/errors';
import { familyApi } from '../api';
import { shortName } from '../format';
import { EVENT_ICONS, chapterParts, chapterPeople, chapterTag } from '../story';
import { Avatar } from './TreeCanvas';
import ChapterEditor from './ChapterEditor';
import { SpoilerControl, StoryDialog } from './StoryParts';

/** The people a story speaks about most, among those the reader may see. */
function castOf(story, visible, byId, upto) {
  const score = new Map();
  story.chapters.forEach((chapter, index) => {
    if (upto !== null && index > upto) return;
    for (const id of chapter.focus || []) score.set(id, (score.get(id) || 0) + 3);
    for (const id of chapterPeople(chapter)) score.set(id, (score.get(id) || 0) + 1);
  });
  return [...score.entries()]
    .filter(([id]) => visible.has(id) && byId.has(id))
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => byId.get(id));
}

/** Icons of what happens in a chapter, with counts: ✝ 2 · ⚭ 1. */
function Beats({ chapter, t }) {
  const counts = new Map();
  for (const e of chapter.events || []) {
    if (e.type === 'appear') continue;
    counts.set(e.type, (counts.get(e.type) || 0) + Math.max(1, e.type === 'union' ? 1 : (e.persons || []).length));
  }
  if (!counts.size) return null;
  return (
    <span className="fam-beats">
      {[...counts].map(([type, n]) => (
        <span key={type} className={`fam-beat fam-beat--${type}`} title={t(`family.story.event.${type}`)}>
          {EVENT_ICONS[type]}
          {n > 1 && <small>{n}</small>}
        </span>
      ))}
    </span>
  );
}

function ChapterRow({ chapter, index, locked, current, byId, canEdit, first, last, onPlay, onUnlock, onEdit, onInsert, onMove, onDelete, t }) {
  const faces = (chapter.focus || []).map((id) => byId.get(id)).filter(Boolean).slice(0, 4);
  return (
    <li className={`fam-chapterrow${locked ? ' is-locked' : ''}${current ? ' is-current' : ''}`}>
      <button type="button" className="fam-chapterrow__main" onClick={() => (locked ? onUnlock(index) : onPlay(index))}>
        <span className="fam-chapterrow__tag">{chapterTag(chapter, index)}</span>
        <span className="fam-chapterrow__text">
          <span className="fam-chapterrow__title">
            {chapter.title}
            {current && <span className="fam-chapterrow__here">{t('family.story.youAreHere')}</span>}
          </span>
          {chapter.when && <span className="fam-chapterrow__when">{chapter.when}</span>}
          {locked ? (
            <span className="fam-chapterrow__teaser is-locked">
              <LockOutlined /> {t('family.spoiler.locked')}
            </span>
          ) : (
            chapter.teaser && <span className="fam-chapterrow__teaser">{chapter.teaser}</span>
          )}
        </span>
        {!locked && (
          <span className="fam-chapterrow__side">
            <span className="fam-chapterrow__faces" aria-hidden="true">
              {faces.map((p) => (
                <Avatar key={p.id} person={p} size={28} />
              ))}
            </span>
            <Beats chapter={chapter} t={t} />
          </span>
        )}
      </button>
      {canEdit && (
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              { key: 'edit', icon: <EditOutlined />, label: t('family.story.editChapter') },
              { key: 'insert', icon: <PlusOutlined />, label: t('family.story.insertAfter') },
              !first && { key: 'up', icon: <ArrowUpOutlined />, label: t('family.families.up') },
              !last && { key: 'down', icon: <ArrowDownOutlined />, label: t('family.families.down') },
              { type: 'divider' },
              { key: 'delete', icon: <DeleteOutlined />, danger: true, label: t('family.story.deleteChapter') },
            ].filter(Boolean),
            onClick: ({ key }) => {
              if (key === 'edit') onEdit(chapter);
              else if (key === 'insert') onInsert(chapter);
              else if (key === 'up') onMove(index, -1);
              else if (key === 'down') onMove(index, 1);
              else if (key === 'delete') onDelete(chapter);
            },
          }}
        >
          <Button type="text" className="fam-chapterrow__more" icon={<MoreOutlined />} aria-label={t('common.moreActions')} />
        </Dropdown>
      )}
    </li>
  );
}

/**
 * Stories of a tree: a cover per story and its chapters by parts. With a
 * spoiler guard, chapters past the reader's place stay closed.
 */
export default function StoriesView({ data, shown, guard, canEdit, treeId, onPlay, onChanged }) {
  const { t } = useLocale();
  const { message, modal } = App.useApp();
  const [storyEdit, setStoryEdit] = useState(null);
  const [chapterEdit, setChapterEdit] = useState(null);
  const byId = useMemo(() => new Map(data.persons.map((p) => [p.id, p])), [data]);
  const visible = useMemo(() => new Set(shown.persons.map((p) => p.id)), [shown]);
  const stories = data.stories || [];

  const run = async (fn, ok) => {
    try {
      await fn();
      if (ok) message.success(ok);
      await onChanged?.();
    } catch (err) {
      message.error(errorMessage(err));
    }
  };
  const move = (story, index, delta) => {
    const ids = story.chapters.map((c) => c.id);
    const [item] = ids.splice(index, 1);
    ids.splice(index + delta, 0, item);
    run(() => familyApi.orderChapters(story.id, ids));
  };
  const removeChapter = (chapter) =>
    modal.confirm({
      title: t('family.story.deleteChapterTitle', { title: chapter.title }),
      okText: t('common.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      onOk: () => run(() => familyApi.deleteChapter(chapter.id), t('family.story.chapterDeleted')),
    });
  const removeStory = (story) =>
    modal.confirm({
      title: t('family.story.deleteTitle', { title: story.title }),
      content: t('family.story.deleteText', { count: story.chapters.length }),
      okText: t('common.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      onOk: () => run(() => familyApi.deleteStory(story.id), t('family.story.deleted')),
    });
  const unlock = (story, index) =>
    modal.confirm({
      title: t('family.spoiler.unlockTitle', { tag: chapterTag(story.chapters[index], index) }),
      content: t('family.spoiler.unlockText'),
      okText: t('family.spoiler.unlockOk'),
      cancelText: t('common.cancel'),
      onOk: () => {
        guard.setUpto(index);
        onPlay(story.id, index);
      },
    });

  const editors = (
    <>
      <StoryDialog
        open={Boolean(storyEdit)}
        treeId={treeId}
        story={storyEdit?.story || null}
        onClose={() => setStoryEdit(null)}
        onSaved={async () => {
          setStoryEdit(null);
          await onChanged?.();
        }}
      />
      <ChapterEditor
        open={Boolean(chapterEdit)}
        draft={chapterEdit}
        data={data}
        onClose={() => setChapterEdit(null)}
        onSaved={async () => {
          setChapterEdit(null);
          await onChanged?.();
        }}
      />
    </>
  );

  if (!stories.length) {
    return (
      <div className="fam-stories fam-stories--empty">
        <div className="fam-stories__intro">
          <span className="fam-stories__icon" aria-hidden="true">
            <BookOutlined />
          </span>
          <h2>{t('family.story.emptyTitle')}</h2>
          <p>{t('family.story.emptyText')}</p>
          <ul className="fam-stories__ideas">
            <li>{t('family.story.idea1')}</li>
            <li>{t('family.story.idea2')}</li>
            <li>{t('family.story.idea3')}</li>
          </ul>
          {canEdit && (
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setStoryEdit({ story: null })}>
              {t('family.story.new')}
            </Button>
          )}
        </div>
        {editors}
      </div>
    );
  }

  return (
    <div className="fam-stories">
      {stories.map((story, storyIndex) => {
        const isGuarded = guard.story?.id === story.id && guard.guarded;
        const upto = isGuarded ? guard.upto : null;
        const parts = chapterParts(story);
        const cast = castOf(story, visible, byId, upto);
        const total = story.chapters.length;
        const resume = isGuarded && upto !== null && upto > 0;
        return (
          <article key={story.id} className="fam-story">
            <header className={`fam-story__cover fam-tag--${story.color}`}>
              <div className="fam-story__kicker">
                {t('family.story.chapters', { count: total })}
                {parts.length > 1 && ` · ${t('family.story.parts', { count: parts.length })}`}
                {story.spoilers && ` · ${t('family.story.guarded')}`}
              </div>
              <h2 className="fam-story__title">{story.title}</h2>
              {story.subtitle && <p className="fam-story__subtitle">{story.subtitle}</p>}
              {story.description && <p className="fam-story__about">{story.description}</p>}
              {cast.length > 0 && (
                <div className="fam-story__cast" aria-label={t('family.story.cast')}>
                  {cast.slice(0, 9).map((p) => (
                    <span key={p.id} className="fam-story__face" title={shortName(p)}>
                      <Avatar person={p} size={34} />
                    </span>
                  ))}
                  {cast.length > 9 && <span className="fam-story__more">+{cast.length - 9}</span>}
                </div>
              )}
              <div className="fam-story__actions">
                {total > 0 && (
                  <Button type="primary" size="large" icon={<PlayCircleFilled />} className="fam-story__play" onClick={() => onPlay(story.id, resume ? upto : 0)}>
                    {resume ? t('family.story.continue', { tag: chapterTag(story.chapters[upto], upto) }) : t('family.story.play')}
                  </Button>
                )}
                {isGuarded && <SpoilerControl guard={guard} />}
                {canEdit && (
                  <Dropdown
                    trigger={['click']}
                    menu={{
                      items: [
                        { key: 'chapter', icon: <PlusOutlined />, label: t('family.story.newChapter') },
                        { key: 'edit', icon: <EditOutlined />, label: t('family.story.editTitle') },
                        storyIndex > 0 && { key: 'up', icon: <ArrowUpOutlined />, label: t('family.families.up') },
                        { type: 'divider' },
                        { key: 'delete', icon: <DeleteOutlined />, danger: true, label: t('family.story.delete') },
                      ].filter(Boolean),
                      onClick: ({ key }) => {
                        if (key === 'chapter') setChapterEdit({ story });
                        else if (key === 'edit') setStoryEdit({ story });
                        else if (key === 'delete') removeStory(story);
                        else if (key === 'up') {
                          const ids = stories.map((s) => s.id);
                          ids.splice(storyIndex, 1);
                          ids.splice(storyIndex - 1, 0, story.id);
                          run(() => familyApi.orderStories(treeId, ids));
                        }
                      },
                    }}
                  >
                    <Button size="large" className="fam-story__ghost" icon={<EditOutlined />}>
                      {t('family.story.manage')}
                    </Button>
                  </Dropdown>
                )}
              </div>
              {isGuarded && upto !== null && (
                <div className="fam-story__progress">
                  <Progress percent={Math.round(((upto + 1) / total) * 100)} showInfo={false} size="small" />
                  <span>{t('family.story.progress', { n: upto + 1, total })}</span>
                </div>
              )}
            </header>
            {total === 0 ? (
              <div className="fam-story__none">
                <p>{t('family.story.noChapters')}</p>
                {canEdit && (
                  <Button icon={<PlusOutlined />} onClick={() => setChapterEdit({ story })}>
                    {t('family.story.newChapter')}
                  </Button>
                )}
              </div>
            ) : (
              <div className="fam-story__chapters">
                {parts.map((part, i) => (
                  <section key={`${part.part}-${i}`} className="fam-part">
                    {part.part && <h3 className="fam-part__title">{part.part}</h3>}
                    <ol className="fam-chapters">
                      {part.items.map(({ chapter, index }) => (
                        <ChapterRow
                          key={chapter.id}
                          chapter={chapter}
                          index={index}
                          t={t}
                          byId={byId}
                          locked={upto !== null && index > upto}
                          current={upto !== null && index === upto}
                          canEdit={canEdit}
                          first={index === 0}
                          last={index === total - 1}
                          onPlay={(at) => onPlay(story.id, at)}
                          onUnlock={(at) => unlock(story, at)}
                          onEdit={(c) => setChapterEdit({ story, chapter: c })}
                          onInsert={(c) => setChapterEdit({ story, afterId: c.id })}
                          onMove={(at, delta) => move(story, at, delta)}
                          onDelete={removeChapter}
                        />
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            )}
          </article>
        );
      })}
      {canEdit && (
        <div className="fam-stories__add">
          <Button icon={<PlusOutlined />} onClick={() => setStoryEdit({ story: null })}>
            {t('family.story.new')}
          </Button>
        </div>
      )}
      {editors}
    </div>
  );
}
