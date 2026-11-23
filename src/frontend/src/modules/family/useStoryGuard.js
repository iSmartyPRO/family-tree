import { useCallback, useMemo, useState } from 'react';
import { readProgress, treeAt, writeProgress } from './story';

/**
 * The story a tree is read through and how far the reader is in it.
 *
 * `scope` names the place progress is kept (`t12` for a tree, `s<token>` for a
 * link). A story with spoilers asks a new reader where they are; until then
 * (and when they choose «everything») the whole tree is shown.
 *
 * Returns the stories, the guarded story, `upto` (0-based chapter or null),
 * `shown` — the data as of that chapter — and setters.
 */
export function useStoryGuard(data, scope) {
  const stories = useMemo(() => (data?.stories || []).filter((s) => s.chapters?.length), [data]);
  const [storyId, setStoryId] = useState(null);
  const story = useMemo(() => {
    if (!stories.length) return null;
    return stories.find((s) => s.id === storyId) || stories.find((s) => s.spoilers) || stories[0];
  }, [stories, storyId]);
  const [version, setVersion] = useState(0);
  const progress = useMemo(
    () => (story && scope ? readProgress(scope, story.id) : undefined),
    [story, scope, version] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const guarded = Boolean(story?.spoilers);
  const last = (story?.chapters.length || 1) - 1;
  const needsChoice = guarded && progress === undefined;
  // A new reader sees the tree as of the first chapter until they choose;
  // a stored chapter past the end (chapters were removed) means the end.
  const upto = !guarded ? null : needsChoice ? 0 : typeof progress?.upto === 'number' ? Math.min(Math.max(progress.upto, 0), last) : null;

  const setUpto = useCallback(
    (value) => {
      if (!story || !scope) return;
      writeProgress(scope, story.id, { upto: value === null ? null : Math.max(0, Math.min(Number(value), story.chapters.length - 1)) });
      setVersion((v) => v + 1);
    },
    [story, scope]
  );

  /** Reading a chapter in the player moves the reader forward, never back. */
  const reached = useCallback(
    (index) => {
      if (!guarded || upto === null || index <= upto) return;
      setUpto(index);
    },
    [guarded, upto, setUpto]
  );

  const shown = useMemo(() => (story ? treeAt(data, story, upto) : data), [data, story, upto]);

  return { stories, story, setStoryId, guarded, upto, needsChoice, setUpto, reached, shown };
}
