import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, Button, Grid, Tooltip } from 'antd';
import { CloseOutlined, HistoryOutlined, LeftOutlined, RightOutlined, UserOutlined } from '@ant-design/icons';
import { useLocale } from '../../../context/LocaleContext';
import { ageOf, lifeYears, shortName } from '../format';
import { buildFamilies } from '../layout';
import { kinLabel, kinship } from '../kinship';
import { EVENT_ICONS, chapterPeople, chapterTag, personArc, storyFacts, treeAt } from '../story';
import { TreeTimeContext, treeTime, useTreeTime } from '../time';
import TreeCanvas, { Avatar } from './TreeCanvas';
import { LabelChips } from './StoryParts';

/** A story text: paragraphs split by empty lines, line breaks kept. */
export function StoryText({ text, className = '' }) {
  const paragraphs = String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!paragraphs.length) return null;
  return (
    <div className={`fam-prose ${className}`}>
      {paragraphs.map((p, i) => (
        <p key={i}>
          {p.split('\n').map((line, k) => (
            <span key={k}>
              {k > 0 && <br />}
              {line}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

function PersonChip({ person, onPeek, fallen = false, compact = false }) {
  if (!person) return null;
  if (compact) {
    return (
      <Tooltip title={shortName(person)}>
        <button type="button" className={`fam-pface${fallen ? ' is-fallen' : ''}`} onClick={() => onPeek(person.id)} aria-label={shortName(person)}>
          <Avatar person={person} size={24} />
        </button>
      </Tooltip>
    );
  }
  return (
    <button type="button" className={`fam-pchip${fallen ? ' is-fallen' : ''}`} onClick={() => onPeek(person.id)} title={shortName(person)}>
      <Avatar person={person} size={22} />
      <span>{person.firstName || shortName(person)}</span>
    </button>
  );
}

/** One line of «what happens» in a chapter. */
function Beat({ event, byId, labels, onPeek, t }) {
  const people = (event.persons || []).map((id) => byId.get(id)).filter(Boolean);
  if (!people.length && !event.text) return null;
  const label = event.type === 'side' ? labels?.get(event.labelId) : null;
  // Secrets and moments are told by their text; their people are just faces.
  const told = (event.type === 'secret' || event.type === 'moment') && event.text;
  return (
    <li className={`fam-pbeat fam-pbeat--${event.type}`}>
      <span className="fam-pbeat__icon" aria-hidden="true">
        {EVENT_ICONS[event.type]}
      </span>
      <div className="fam-pbeat__body">
        <span className="fam-pbeat__kind">
          {event.type === 'union' && event.status ? t(`family.status.${event.status}`) : t(`family.story.event.${event.type}`)}
        </span>
        {told && <span className="fam-pbeat__text is-lead">{event.text}</span>}
        <span className={`fam-pbeat__people${told ? ' is-faces' : ''}`}>
          {people.map((p, i) => (
            <span key={p.id} className="fam-pbeat__person">
              {event.type === 'union' && i > 0 && <span className="fam-pbeat__amp">&</span>}
              <PersonChip person={p} onPeek={onPeek} fallen={event.type === 'death'} compact={Boolean(told)} />
            </span>
          ))}
          {label && (
            <span className="fam-pbeat__arrow">
              → <LabelChips ids={[label.id]} labels={labels} />
            </span>
          )}
        </span>
        {event.text && !told && <span className="fam-pbeat__text">{event.text}</span>}
      </div>
    </li>
  );
}

/** A person as known at this point of the story: who they are and their arc so far. */
function Peek({ person, relation, story, index, labels, onJump, onOpen, onClose, t }) {
  const { now, era } = useTreeTime();
  const arc = useMemo(() => personArc(story, person.id, index), [story, person.id, index]);
  const age = ageOf(person, now);
  const years = lifeYears(person);
  return (
    <aside className="fam-peek" aria-label={shortName(person)}>
      <button type="button" className="fam-peek__close" onClick={onClose} aria-label={t('common.close')}>
        <CloseOutlined />
      </button>
      <div className="fam-peek__head">
        <Avatar person={person} size={56} />
        <div>
          <div className="fam-peek__name">{shortName(person)}</div>
          <div className="fam-peek__life">
            {years && `${years}${era ? ` ${era}` : ''}`}
            {age !== null && ` · ${person.isAlive ? t('family.panel.age', { count: age }) : t('family.panel.ageAtDeath', { count: age })}`}
          </div>
          {relation && <div className="fam-peek__kin">{relation}</div>}
        </div>
      </div>
      <LabelChips ids={person.labels} labels={labels} />
      {person.occupation && <div className="fam-peek__role">{person.occupation}</div>}
      {person.bio && <StoryText text={person.bio} className="fam-peek__bio" />}
      {arc.length > 0 && (
        <div className="fam-peek__arc">
          <div className="fam-peek__arc-title">{t('family.story.arcSoFar')}</div>
          <div className="fam-peek__arc-list">
            {arc.map(({ chapter, index: at, roles }) => (
              <button key={chapter.id} type="button" className={`fam-arcchip${at === index ? ' is-current' : ''}`} onClick={() => onJump(at)} title={chapter.title}>
                <b>{chapterTag(chapter, at)}</b>
                {roles
                  .filter((r) => r !== 'focus' && r !== 'appear')
                  .map((r) => (
                    <span key={r} aria-label={t(`family.story.event.${r}`)}>
                      {EVENT_ICONS[r]}
                    </span>
                  ))}
              </button>
            ))}
          </div>
        </div>
      )}
      {onOpen && (
        <Button block icon={<UserOutlined />} onClick={() => onOpen(person.id)}>
          {t('family.story.openCard')}
        </Button>
      )}
    </aside>
  );
}

/**
 * The story player: chapter by chapter, the tree grows as the story goes —
 * people appear when they come in, die when they die, couples form; the
 * chapter's people are lit and framed. Keyboard: ← →, Home / End, Esc.
 */
export default function StoryPlayer({ data, story, start = 0, guardUpto = null, onReached, onClose, onPerson }) {
  const { t } = useLocale();
  const { modal } = App.useApp();
  const phone = Grid.useBreakpoint().md === false;
  const total = story.chapters.length;
  const [index, setIndex] = useState(Math.min(Math.max(start, 0), total - 1));
  // How far the reader may go without being asked (a spoiler guard).
  const [limit, setLimit] = useState(guardUpto === null ? Infinity : Math.max(guardUpto, start));
  const [peek, setPeek] = useState(null);
  const [recap, setRecap] = useState(false);
  const canvas = useRef(null);
  const page = useRef(null);
  const closeRef = useRef(null);
  const chapter = story.chapters[index];

  const state = useMemo(() => treeAt(data, story, index), [data, story, index]);
  const facts = useMemo(() => storyFacts(story), [story]);
  const byId = useMemo(() => new Map(state.persons.map((p) => [p.id, p])), [state]);
  const labels = useMemo(() => new Map((data.tree?.labels || []).map((l) => [l.id, l])), [data]);
  const spotlight = useMemo(() => {
    const ids = new Set([...chapterPeople(chapter)].filter((id) => byId.has(id)));
    const fresh = new Set([...ids].filter((id) => facts.firstSeen.get(id) === index));
    const fallen = new Set(chapter.events.filter((e) => e.type === 'death').flatMap((e) => e.persons || []));
    return { ids, fresh, fallen };
  }, [chapter, byId, facts, index]);
  const time = treeTime(data.tree, state.now);

  // Kinship of a person to the chapter's first focus person.
  const graph = useMemo(() => ({ ...buildFamilies(state.persons, state.parents, state.unions), byId }), [state, byId]);
  const anchor = (chapter.focus || []).find((id) => byId.has(id)) || null;
  const relationOf = useCallback(
    (id) => {
      if (!anchor || id === anchor) return null;
      const label = kinLabel(t, kinship(graph, graph.byId, anchor, id));
      return label ? t('family.story.relationTo', { relation: label, name: shortName(byId.get(anchor)) }) : null;
    },
    [anchor, graph, byId, t]
  );

  const go = useCallback(
    (next) => {
      if (next < 0 || next >= total || next === index) return;
      const move = () => {
        setIndex(next);
        setLimit((l) => Math.max(l, next));
        setPeek(null);
      };
      // Jumping past the next chapter of a guarded story: ask first.
      if (next > limit + 1) {
        modal.confirm({
          title: t('family.spoiler.unlockTitle', { tag: chapterTag(story.chapters[next], next) }),
          content: t('family.spoiler.unlockText'),
          okText: t('family.spoiler.unlockOk'),
          cancelText: t('common.cancel'),
          onOk: move,
        });
      } else move();
    },
    [index, total, limit, modal, story, t]
  );

  useEffect(() => {
    onReached?.(index);
    page.current?.scrollTo?.({ top: 0 });
    setRecap(false);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  // Frame the chapter's people once the tree of this chapter is drawn.
  useEffect(() => {
    // A phone shows the chapter's main person up close; a wide screen frames everyone in it.
    const main = (chapter.focus || []).find((id) => spotlight.ids.has(id));
    const ids = [...spotlight.ids];
    const timer = setTimeout(() => {
      if (phone && main) canvas.current?.centerOn(main, { zoom: 0.8 });
      else canvas.current?.frame(ids.length ? ids : state.persons.map((p) => p.id), { maxZoom: 1.05, inset: { right: 64 } });
    }, 80);
    return () => clearTimeout(timer);
  }, [index, phone]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus goes to the player once, when it opens — not on every chapter.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest?.('input, textarea, .ant-modal')) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown') go(index + 1);
      else if (event.key === 'ArrowLeft' || event.key === 'PageUp') go(index - 1);
      else if (event.key === 'Home') go(0);
      else if (event.key === 'End') go(total - 1);
      else if (event.key === 'Escape') {
        if (peek) setPeek(null);
        else onClose();
      } else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index, total, peek, onClose]);

  // No page scroll behind the player.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Swipes on the text: left — next chapter, right — previous.
  const touch = useRef(null);
  const onTouchStart = (e) => {
    const p = e.touches[0];
    touch.current = { x: p.clientX, y: p.clientY };
  };
  const onTouchEnd = (e) => {
    const start0 = touch.current;
    touch.current = null;
    if (!start0) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - start0.x;
    const dy = p.clientY - start0.y;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 50) go(index + (dx < 0 ? 1 : -1));
  };

  const previous = story.chapters.slice(0, index).map((c, i) => ({ c, i })).reverse();
  const focusPeople = (chapter.focus || []).map((id) => byId.get(id)).filter(Boolean);
  const peekPerson = peek ? byId.get(peek) : null;
  const next = index < total - 1 ? story.chapters[index + 1] : null;

  return (
    <div className={`fam-player fam-tag--${story.color}`} role="dialog" aria-modal="true" aria-label={story.title}>
      <header className="fam-player__bar">
        <Tooltip title={`${t('common.close')} (Esc)`}>
          <Button ref={closeRef} type="text" icon={<CloseOutlined />} onClick={onClose} aria-label={t('common.close')} className="fam-player__close" />
        </Tooltip>
        <div className="fam-player__story">
          <span className="fam-player__name">{story.title}</span>
          {chapter.part && <span className="fam-player__part">{chapter.part}</span>}
        </div>
        <div className="fam-player__segments" role="tablist" aria-label={t('family.story.chaptersNav')}>
          {story.chapters.map((c, i) => (
            <Tooltip key={c.id} title={i > limit + 1 ? `${chapterTag(c, i)} · ${t('family.spoiler.lockedShort')}` : `${chapterTag(c, i)} · ${c.title}`}>
              <button
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`${chapterTag(c, i)}: ${c.title}`}
                className={`fam-seg${i < index ? ' is-done' : ''}${i === index ? ' is-current' : ''}${i > limit + 1 ? ' is-locked' : ''}${i > 0 && c.part !== story.chapters[i - 1].part ? ' is-part' : ''}`}
                onClick={() => go(i)}
              />
            </Tooltip>
          ))}
        </div>
        <span className="fam-player__count">
          {index + 1} / {total}
        </span>
      </header>

      <div className="fam-player__main">
        <section className="fam-player__panel" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="fam-player__page" ref={page}>
            {index > 0 && (
              <div className={`fam-recap${recap ? ' is-open' : ''}`}>
                <button type="button" className="fam-recap__toggle" onClick={() => setRecap((v) => !v)} aria-expanded={recap}>
                  <HistoryOutlined /> {t('family.story.previously')}
                </button>
                {recap && (
                  <ol className="fam-recap__list">
                    {previous.map(({ c, i }) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => go(i)}>
                          <b>{chapterTag(c, i)}</b> {c.teaser || c.title}
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
            <div className="fam-player__meta">
              <span className="fam-player__tag">{chapterTag(chapter, index)}</span>
              {chapter.when && <span>{chapter.when}</span>}
            </div>
            <h1 className="fam-player__title" key={chapter.id}>
              {chapter.title}
            </h1>
            {chapter.teaser && <p className="fam-player__teaser">{chapter.teaser}</p>}
            <StoryText text={chapter.body} className="fam-player__body" />
            {chapter.events.length > 0 && (
              <section className="fam-player__changes">
                <div className="fam-player__cast-title">{t('family.story.changes')}</div>
                <ul className="fam-player__beats" aria-label={t('family.story.changes')}>
                  {chapter.events.map((e, i) => (
                    <Beat key={i} event={e} byId={byId} labels={labels} onPeek={setPeek} t={t} />
                  ))}
                </ul>
              </section>
            )}
            {focusPeople.length > 0 && (
              <div className="fam-player__cast">
                <div className="fam-player__cast-title">{t('family.story.inChapter')}</div>
                <div className="fam-player__cast-list">
                  {focusPeople.map((p) => (
                    <PersonChip key={p.id} person={p} onPeek={setPeek} />
                  ))}
                </div>
              </div>
            )}
          </div>
          <footer className="fam-player__nav">
            <Button size="large" icon={<LeftOutlined />} onClick={() => go(index - 1)} disabled={index === 0} aria-label={t('family.story.prev')}>
              {!phone && t('family.story.prev')}
            </Button>
            {next ? (
              <Button size="large" type="primary" onClick={() => go(index + 1)} className="fam-player__next">
                <span className="fam-player__next-label">
                  <small>{t('family.story.next')}</small>
                  {chapterTag(next, index + 1)}
                </span>
                <RightOutlined />
              </Button>
            ) : (
              <Button size="large" type="primary" onClick={onClose}>
                {t('family.story.finish')}
              </Button>
            )}
          </footer>
        </section>

        <section className="fam-player__tree" aria-label={t('family.view.tree')}>
          <TreeTimeContext.Provider value={time}>
            <TreeCanvas ref={canvas} data={state} selectedId={peek} onSelect={setPeek} canEdit={false} spotlight={spotlight} compact />
            {peekPerson && (
              <Peek
                person={peekPerson}
                relation={relationOf(peekPerson.id)}
                story={story}
                index={index}
                labels={labels}
                t={t}
                onClose={() => setPeek(null)}
                onJump={(at) => go(at)}
                onOpen={onPerson}
              />
            )}
          </TreeTimeContext.Provider>
        </section>
      </div>
      <div className="fam-sr" aria-live="polite">
        {chapterTag(chapter, index)}: {chapter.title}
      </div>
    </div>
  );
}
