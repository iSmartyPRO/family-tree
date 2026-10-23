export default {
  id: "family",
  purpose: "Family trees: people with photos and stories, parents and couples, an automatic tree layout and a timeline of lives, access per tree and public read-only links.",
  audience: "Everyone who keeps a family history; each tree has its own owners and editors.",
  setup: [
    {
      title: "Photo size",
      text: "The hard limit per photo file in the [settings](/admin/settings/family); photos are also shrunk in the browser.",
    },
    {
      title: "Public links",
      text: "Allow them, require a password and limit their lifetime if needed.",
    },
  ],
  roles: {
    "family.admin": "Full access to every tree, regardless of its access list, and to the module settings.",
  },
  access: "The creator manages a tree; they give view, edit or manage rights to people, groups or roles.",
  scenarios: [
    {
      title: "A family archive",
      text: "One tree per family line, edited by two or three relatives, viewed by everyone.",
    },
    {
      title: "Moving from the old app",
      text: "Export from ftree as JSON and use Import in an empty tree.",
    },
  ],
  faq: [
    {
      q: "Can positions be adjusted by hand?",
      a: "No: the layout is computed from the links, so it stays tidy as the family grows.",
    },
    {
      q: "What do public visitors see?",
      a: "The tree, names, dates, places, photos and stories — not contacts.",
    },
  ],
};
