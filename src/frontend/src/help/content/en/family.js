export default {
  id: "family",
  icon: "people",
  title: "Family tree",
  tagline: "Your family history as a living tree — laid out automatically.",
  summary: "Add people and say who is whose parent or partner: the tree arranges couples, children and generations by itself. Switch to the timeline to see lives along the years. Photos, stories and contacts live on each person’s card; share the tree with relatives or by a public link.",
  highlights: [
    {
      icon: "🌳",
      title: "Automatic layout",
      text: "A couple is joined by a horizontal line; their children hang from its middle, generation under generation.",
    },
    {
      icon: "📅",
      title: "Timeline",
      text: "Lifelines on one axis of years, grouped by couples in the order of the wedding or first child.",
    },
    {
      icon: "➕",
      title: "Quick adding",
      text: "Select a person and use the «+» buttons around the card: parent, child, partner, sibling.",
    },
    {
      icon: "🖼",
      title: "Photos and stories",
      text: "A photo, places, occupation, memories and contacts for everyone.",
    },
    {
      icon: "🔐",
      title: "Access",
      text: "View, edit or manage — per person, group or role, separately for each tree.",
    },
    {
      icon: "🎯",
      title: "Views",
      text: "Only father’s or mother’s side, ancestors or descendants — saved filters over one tree.",
    },
    {
      icon: "🔗",
      title: "Links that collect help",
      text: "Share a view: relatives add photos and details, you approve.",
    },
  ],
  tips: [
    "Start with yourself, then add parents upwards and children downwards.",
    "A year is enough for a date: type 1950, 03.1950 or 08.03.1950.",
    "Click a person to highlight their line of descent; Esc clears it.",
    "Wheel or pinch zooms at the cursor, «0» shows the whole tree.",
    "Set a wedding date on the couple — the timeline marks it exactly.",
    "A child linked to only one parent? The card suggests the partner in one click.",
  ],
  sections: [
    {
      id: "start",
      title: "Creating a tree",
      body: "Open **Family tree** and click **New tree**. Give it a name — e.g. the family name — and an optional description. One tree can hold several family lines; separate trees are handy when different people should see them.",
      steps: [
        "Click **New tree**.",
        "Enter a name and click **Create**.",
        "Click **Add the first person** and fill in the card.",
      ],
    },
    {
      id: "relatives",
      title: "Adding relatives",
      body: `Select a person on the tree. Round **+** buttons appear around the card:

- **above** — a parent (a second parent becomes the first parent’s partner automatically);
- **below** — a child (of the couple, if the person has one partner);
- **right** — a partner;
- **left** — a brother or sister (they get the same parents).

The same actions are in the side panel: **Add relative**. To link people who are already in the tree, use **⋯ → Link an existing parent / child / partner**.`,
      note: "A person can have at most two parents, and nobody can become their own ancestor — such links are refused.",
    },
    {
      id: "layout",
      title: "How the tree is drawn",
      body: `Positions are never stored: the tree is laid out from the links every time.

- partners stand side by side, joined by a horizontal line with a ring;
- their children hang from the middle of that line: down, along a common bar, down to each child;
- the children of a single parent hang from the bottom of the parent’s card;
- a dotted couple line means two people are parents of the same child but no union is recorded;
- a dashed line means the couple divorced or separated.

When both partners come from families in the tree, the couple stays with one of them, and a longer line leads to the other’s parents.

Where the second parent is not in the tree, a «Mother not known» / «Father not known» card stands beside the first one. To hide these cards and their couple lines (for example, many forefathers whose wives are unknown), turn off **⋯ → Name and settings… → Show unknown parents**.`,
    },
    {
      id: "timeline",
      title: "Timeline",
      body: `The **Timeline** switch shows the same family as lifelines: a bar from birth to death (or today) on a shared axis of years. Names on the left form an outline: a person, the partner right below, then that couple’s children, indented.

Couples go in the order of the wedding; when its date is unknown, of their first shared child. The couple mark (ring) stands at the wedding year or, dotted, at the first child’s birth. A child’s branch drops from the parent’s bar at the year the child was born, so you can see how old the parents were.

Unknown birth years are estimated from relatives (about a generation apart) and shown faded.`,
    },
    {
      id: "person",
      title: "A person’s card",
      body: `Click a person to open the panel: photo, dates and age, places, occupation, story, contacts and all relatives — click any of them to go to them. **Edit** opens the full form; a double click on the card does the same.

Photos are cropped to a square and downsized in the browser before upload, so a phone picture of several megabytes becomes about 100 KB.`,
    },
    {
      id: "me",
      title: "This is me",
      body: "Click **Who are you in this tree?** under the title (or open your card → **⋯ → This is me**). From then on every card shows how the person is related to you — «grandfather (mother’s side)», «cousin», «son-in-law» — and views are built around you by default.",
    },
    {
      id: "views",
      title: "Views: the part of the family you need",
      body: `One tree holds everyone; a **view** shows only a part of it. Open the **Whole tree ▾** button → **New view…** and choose:

- **Built around** — you or anyone else;
- **Side** — both, father’s or mother’s (the other parent stays beside, without their family);
- **Generations up / down**;
- **Side branches** — brothers and sisters, cousins and their children;
- **Husbands and wives**.

Ready-made starts: My family, Father’s side, Mother’s side, My ancestors, My descendants. The counter shows how many people get in. Save the view under a name — it appears in the menu and can be shared. Views are filters: changes in the tree show up in every view at once.`,
    },
    {
      id: "links",
      title: "Sharing a view and collecting help",
      body: `**Share** creates a link to the whole tree or a view. Choose what visitors may do:

- **View** — look only;
- **Suggest** — add a photo, correct details or add a relative; it waits in **Suggestions** until you accept it;
- **Edit** — changes to people of that view are saved at once (and logged in Suggestions).

Add a password and an end date if needed. Visitors introduce themselves once, so you see who sent what. Contacts are never shown by a link.`,
    },
    {
      id: "clone",
      title: "Copying into your own tree",
      body: "**⋯ → Copy to a new tree** makes an independent copy of the tree (or of the view on screen) with photos. A signed-in visitor of a link can do the same with **Save to my trees**, if the owner allowed it.",
    },
    {
      id: "sharing",
      title: "Access and public links",
      body: "**Access** gives view, edit or manage rights to people, groups or roles. **Share** creates read-only public links: anyone with the link sees the tree without signing in, contacts are hidden. A link can have a password and an end date, and can be revoked at any time.",
    },
    {
      id: "export",
      title: "Import and export",
      body: "**⋯ → Download JSON** saves everything in this app’s format; **Download GEDCOM** exports for other genealogy programs. **Import** adds people and links from a JSON export of this app or of the old family tree app (ftree); nothing in the tree is replaced.",
    },
  ],
};
