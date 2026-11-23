import { createContext, useContext } from 'react';

/*
 * «Now» of the tree being shown. Real families live in today's date
 * (`now` undefined). A tree in its own calendar (a saga, a chronicle) has a
 * year suffix (`era`) and its own «now»: the tree's present year, or the
 * year of the story chapter being read; null when it is not known.
 */
export const TreeTimeContext = createContext({ now: undefined, era: '' });

export const useTreeTime = () => useContext(TreeTimeContext);

/** The time of a tree: its calendar and the «now» a story view asks for. */
export function treeTime(tree, storyNow) {
  const era = tree?.era || '';
  if (!era) return { now: undefined, era: '' };
  return { now: storyNow || tree.eraNow || null, era };
}
