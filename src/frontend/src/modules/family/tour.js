export default {
  id: 'family',
  module: 'family',
  version: 1,
  route: '/app/family',
  title: 'tour.family.title',
  steps: [
    { id: 'intro', title: 'tour.family.intro.title', text: 'tour.family.intro.text' },
    { id: 'newTree', target: 'family.newTree', placement: 'bottom', title: 'tour.family.newTree.title', text: 'tour.family.newTree.text' },
    // Shown once the person has trees (the grid is not rendered otherwise).
    { id: 'trees', target: 'family.trees', placement: 'top', title: 'tour.family.trees.title', text: 'tour.family.trees.text' },
    { id: 'layout', title: 'tour.family.layout.title', text: 'tour.family.layout.text' },
    { id: 'relatives', title: 'tour.family.relatives.title', text: 'tour.family.relatives.text' },
    { id: 'sharing', title: 'tour.family.sharing.title', text: 'tour.family.sharing.text' },
  ],
};
