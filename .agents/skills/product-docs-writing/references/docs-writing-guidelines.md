# Docs writing guidelines

This guide captures the product documentation house style. Its patterns
come from a corpus of 41 pages sampled in September 2026 from a benchmark
product's user documentation — start guides, feature pages, settings
pages, integrations, security, API, and concept pages — plus its developer
site. The corpus established the shape; this guide states it as the style
to write in.

Treat the sample examples in this guide as evidence of the style, not as
content to copy. Do not carry their product names, screenshots, settings
paths, or feature claims into the product being documented. Replace their
substance with the verified behavior of the product being documented.

This is a user-documentation guide, and it is project-agnostic: the
project's own mechanics — MDX components, frontmatter contract, navigation
configuration, link validation, product terminology — are discovered from
the repository being documented, following the project adaptation rules at
the end of this guide. Developer documentation follows the
developer-docs-writing skill, release notes and announcements follow the
product-changelog-writing skill, and formal policies follow the
product-policy-writing skill. Architecture and maintainer procedures
belong wherever the project keeps its internal documentation, not in user
docs.

## Contents

- The docs style
- Voice and person
- Title and lede formulas
- Page anatomy
- Formatting conventions
- Cross-linking
- Page-type templates
- Information architecture and organization
- Project adaptation rules
- Review checklist

## The docs style

Document one feature per page, ordered from "what is this" to "how do I do
each task with it" to "what goes wrong". Across the corpus, recurring
characteristics include:

- A short title of one to three words: a feature noun ("Cycles", "Search",
  "Favorites", "Insights") or a verb phrase ("Create issues", "Invite
  members", "Edit issues").
- A one-sentence lede directly under the title that states what the feature
  does for the user, before any image or heading.
- A screenshot of the feature immediately after the lede, on almost every
  page.
- A fixed section skeleton in this order, using only the parts that apply:
  `## Overview`, `## Configure`, `## Basics` (or feature-specific task
  sections), `## FAQ`.
- Task sections with verb-first headings ("Open views", "Create views",
  "Edit views", "Share views", "Add favorites", "Remove favorite"), ordered
  from open/create through edit/share to niche tasks.
- A reader voice that uses "you", and a maker voice that uses the product
  name or "we" for what the system does.
- Present tense, short declarative sentences, everyday words, contractions.
- Explanations of why a behavior exists, not just what it does.
- Honest statements of limits and irreversibility, stated plainly and early
  enough to act on.
- Notes for caveats, limits, and availability, set off from body text.
- Collapsible FAQ blocks holding real user questions, edge cases, and
  troubleshooting.
- Cross-links on first meaningful mention plus a "Read more on [topic]"
  sentence at the end of concept sections.
- Numbered steps for sequential procedures, bullets for options and
  enumerations, tables for parameters and comparisons, fenced code only for
  literal commands and configuration.

Page lengths run from roughly 250 to 1,500 words. Small features get short
pages; the start guide and integrations run longest. Do not pad a small
feature to a fixed length.

## Voice and person

Write as the product talking to one user. Rules, with corpus examples:

- Use "you" for the reader and their actions. Use the product name or "we"
  for what the system does. Never "the user" in body text.
  - "You can always edit cycle configurations in the future."
  - "The app automatically creates upcoming cycles for your team."
- Prefer the system as the actor for automatic behavior: "The app stores
  the key encrypted and does not send it to the browser."
- Use "You can…" to introduce a capability list, then bullets.
- State why, in the same breath as what:
  - "The goal of cycles having repeated intervals is to help you avoid the
    busywork associated with optimizing cycle timing and instead focus on
    shipping."
- State limits and irreversibility plainly, without apology or hedging:
  - "There is no way to keep unfinished issues in a closed cycle."
  - "This setting isn't self-serve to change later."
  - "Past cycle dates cannot be changed."
- Prefer "must" for requirements ("You must be a workspace admin to
  complete this step") and "can" for capabilities. Avoid "should" for
  system rules.
- No marketing voice. The strongest promotional move the corpus makes is a
  concrete benefit in the lede. Ban "powerful", "seamless", "simply",
  "easily", "revolutionary", and exclamation marks.
- Contractions are welcome ("you'll", "doesn't", "can't"). Em dashes appear
  in enumerations ("You can favorite many items — including issues,
  projects, views, and documents — to keep them easy to access from the
  sidebar").
- Define a term in the lede or Overview the first time a page uses it, in
  one sentence, then use that term unchanged.

## Title and lede formulas

The lede is one sentence, no heading, before the first image. Corpus
patterns, strongest first:

- Noun definition with benefit: "Cycles are a practice to keep up your
  team's momentum, similar to commonly used agile-flavored sprints."
- Imperative benefit: "Automate SLAs for issues that should be completed
  within a certain amount of time."
- "You can" enumeration: "You can favorite many items — including issues,
  projects, views, and documents — to keep them easy to access from the
  sidebar."
- Capability summary: "Quickly find issues, projects and documents with
  Search."
- Scale statement for core actions: "Creating issues is the most common
  action taken in the app."

Pick one pattern; never stack two. If the project's frontmatter carries a
page description, put the same sentence or a tightened version of it there.

## Page anatomy

The canonical skeleton, in order. Omit sections that do not apply; do not
invent new top-level sections when a task heading fits inside Basics.

```markdown
# Feature name

One-sentence lede.

![Descriptive alt text](screenshot)

## Overview

One to three short paragraphs: what the feature is, what it is for, and
when to use it. Optionally a "You can:" bullet list of capabilities.
Links to settings and related pages on first mention.

## Configure

Where the setting lives and who can change it. Numbered steps for
multi-step setup. Permission or prerequisite statements.

## Basics

### Verb-first task

Steps or a short explanation.

## FAQ

One block per real question.
```

Add whatever frontmatter the project's docs pipeline requires; the
adaptation rules cover finding that contract. If the pipeline wraps
sections in components or requires stable section identifiers for anchors,
apply them to every H2 topic.

Rules per section:

- **Overview** answers "what is this and when do I use it". It never
  contains steps. It may contain a "might represent:" or "is typically used
  to:" bullet list of concrete situations, in the user's vocabulary.
- **Configure** is the first place a settings path appears. Open with the
  path and the primary toggle in one sentence: "Configure cycles under
  **Team Settings > Cycles**. Turn on the toggle for **Enable cycles**."
  State permission needs ("You must be a workspace admin…") and
  prerequisites before the steps.
- **Basics** holds one H3 per task. Order tasks: open/create, then edit,
  then share, then niche. Headings start with a verb and name the object:
  "Add a proxy key", "Open a saved item on your TV", "Remove a
  connection".
- **FAQ** holds real questions in the user's words. Direct answer in the
  first sentence, then context and the fix. Include the questions support
  actually receives: error messages, limits, "why don't X and Y match",
  troubleshooting a broken setup.

### Interaction-mode subsections

When a task has keyboard, pointer, and menu paths, give each its own
H3 under Basics and list them as parallel shortcuts:

```markdown
### Keyboard

`/` to search all items in the workspace by title, description, comments

### Mouse

* Select the magnifying-glass button next to the _New Item_ button

### Command menu

`open item` to launch quick item search
```

Apply this to surfaces that have more than one input path (for example TV
remote versus phone versus browser). Skip it where only one path exists.

## Formatting conventions

- **Settings paths in bold with `>` separators**, linked to the real route:
  `Open [**Settings > Proxy**](/settings/proxy)`. Capitalize as the app's
  navigation renders it. Never write a settings path in prose without bold.
- **Buttons, toggles, and menu items in bold** on first use:
  **Add integration**, **Enable cycles**. Deep menu items may be
  italic with an ellipsis as the UI shows: _Edit view…_, _Make recurring…_.
- **Keyboard shortcuts in backticks**, platform-prefixed:
  `Cmd/Ctrl` + `K`, `Option/Alt` + `C`, `O` then `F`.
- **Notes** for caveats, limits, and availability — one to three sentences,
  set off from body text through the project's note or callout component.
  Typical uses:
  - a limit with a number: "Drafts are stored for 6 months before being
    deleted automatically."
  - irreversibility: "Once you change the start date you cannot revert this
    change."
  - a behavior that looks like a bug but is intended, with the reason.
  - a pointer to the feature that covers an adjacent need.
- **Numbered steps**: each step starts with a verb, one action per step,
  parallel structure, and names the exact UI element to act on. Settings
  navigation folds into one step when trivial ("Navigate to **Settings >
  General** and enable the toggle.") and expands when the flow has
  decisions.
- **Bullets** for options and enumerations; keep each bullet to one line or
  two. Bullet lists may be lowercase fragments when they complete a lead-in
  sentence ("A team can define:").
- **Tables** for parameters, permissions, and comparisons. Give every
  column a short header.
- **Code** only for literal commands, file contents, and HTTP exchanges, in
  the project's labeled code figure if it has one. Never use code
  formatting for emphasis or UI labels.
- **Images**: every page that describes visible UI gets a screenshot of
  that UI. Alt text describes what the screenshot shows, including state:
  "Settings > Proxy showing a saved provider key and the per-server usage
  toggle." Where the screenshot needs interpretation, add an italic caption
  line under it: "*At-risk projects*". Annotate screenshots sparingly;
  prefer a crop that needs no annotation.
- **Videos**: embed a short clip only when a flow is hard to follow from
  stills, and keep the surrounding text self-sufficient.

## Cross-linking

- Link the first meaningful mention of any feature or settings page, using
  its real route. Many docs pipelines validate internal links and anchors
  at build time; verify every link either way.
- End concept sections with a "Read more on [topic](url)." sentence.
- Link out to external documentation when the user must act there; never
  duplicate their full instructions.
- When two pages could answer a question, pick one home for the answer and
  link from the other. Do not maintain two copies.

## Page-type templates

### Feature how-to page

The canonical skeleton above. This is the default for user surfaces:
creating and managing the core object, settings pages, playback or viewing
flows, companion-device features. Include screenshots for every Configure
and Basics step that involves visible UI.

### Concept page

For "what is X" pages. Pattern from the corpus's Concepts page: definition
paragraph, then one H2 per concept with a short definition, a "can:" or
"might:" bullet list of concrete situations, and "Read more on [page]" at
the end. Close multi-concept pages with a "How these fit together" section
of one-line summaries:

```markdown
- Saved items hold the URLs you choose
- Connectors resolve them into playable entries
- players receive the link you select
```

### Integration or setup page

For connecting something external: third-party services, self-hosted
companions, generated projects. Pattern from the corpus's integration
pages: lede states the pairing's benefit, brand or architecture image,
Overview with a capability table or bullets, Configure with permissions and
numbered steps, then one H2 per capability the connection gives you, then
FAQ. State trust and data-flow facts explicitly (where credentials live,
what the connected service can and cannot reach).

### Start guide

One page that takes a new user from zero to a working flow: what the
product is for in two sentences, the recommended path as numbered steps,
links into the feature pages for depth, and a short FAQ. Do not duplicate
feature-page detail here.

## Information architecture and organization

Organize documentation as surfaces sharing one layout shell and one sidebar
footer. The corpus uses three:

- **User docs** — one page per product feature for people using the
  product.
- **Developer docs** — organized by the thing you build with: the API,
  authentication, agents, SDKs, and guides.
- **Learn** — a course library ("Intro", "Daily workflows"), not reference
  material.

The sidebar footer cross-links all surfaces plus Contact support from
every page, so a reader can hop between using, building, and learning
without a global nav.

### User docs sidebar organization

The corpus's user docs sidebar is grouped and ordered as: Getting started,
Account, AI, Your sidebar, Teams, Issues, Issue properties, Projects,
Initiatives, Cycles, Views, Find and filter, Asks, Integrations, Analytics,
Administration, Importers. The ordering encodes a reader journey, not an
architecture diagram:

1. Onboarding first (start guide, concepts, download).
2. Personal setup (account, personal navigation).
3. Core work objects in increasing scope (issues → projects →
   initiatives), each with its properties and variations as adjacent
   groups.
4. Navigation and power use (views, find and filter).
5. Incoming work from outside (requests).
6. Connections to other tools (integrations).
7. Analysis, then administration, then migration last.

Group rules:

- Groups are short noun phrases naming the object or area ("Issues",
  "Views", "Analytics"), occasionally a terse verb phrase ("Find and
  filter").
- A group that names a product object leads with a same-named overview page
  ("Teams" group → "Teams" page), followed by sub-topics, then adjacent
  pages.
- A page may appear in multiple groups where readers would reach it from
  different directions: an automation page can sit under both AI and
  Integrations; a triage page under both Teams and Views. Cross-listing is
  a deliberate discovery aid, not duplication — there is still one page.
- Landing pages are curated, not exhaustive: a one-line site description,
  a "Popular" card row, and a "Basics" card row, each card carrying a
  title and a one-sentence description.
- Breadcrumbs above the page title name the group ("Issues → Create
  issues"), and prev/next pagination follows the sidebar order.

### Developer docs organization

Developer pages keep the same voice but organize by the thing you build
with, not by the Overview → Configure → Basics skeleton. Their page style
follows the developer-docs-writing skill; when planning a product's
sections, only the split itself is decided here — user docs hold
everything a person using the product needs, and the developer section
holds what an implementer needs.

### Planning a product's sections

Derive the structure from the product's surfaces with the same recipe:

1. Split user docs from developer docs. User docs hold everything a person
   using the product needs, including the user-facing how-to for connecting
   a developer artifact ("add your self-hosted server in Settings"); the
   developer section holds only what an implementer needs, grouped by the
   thing they build with.
2. Order user groups as a reader journey: getting started (start guide,
   concepts, install), personal setup, the core object and its lifecycle,
   surrounding objects in increasing scope, power navigation, incoming or
   external work, connections and integrations, analysis, administration,
   migration last.
3. Name groups as short noun phrases after the object or area; lead each
   object group with a same-named overview page.
4. Give both sections one shell and one sidebar footer with cross-links.
5. Curate the landing page: description sentence plus card rows of title
   and one-line description.

## Project adaptation rules

The patterns above are rendering-agnostic. Before writing, learn the
target project's mechanics and map every pattern onto them.

### Discover the docs pipeline

Find and read, in the repository being documented:

- The docs directory and its pages, plus the navigation or sidebar
  configuration (a catalog module, meta JSON, or frontmatter-driven nav)
  that defines groups, ordering, and prev/next.
- The MDX or Markdown pipeline in the build configuration: which plugins
  run, which frontmatter fields are required or validated, and how raw
  markdown is exported if the project supports it.
- The docs component set: section wrappers and anchor helpers, note or
  callout components, code figure components, and how links, tables, and
  headings are customized. Docs component tests usually demonstrate usage.
- The link and anchor validation the project runs, and when it runs
  (build-time module load, a docs test, or CI).

Follow the project's existing conventions exactly; do not introduce new
components or frontmatter fields without flagging it.

### Map the corpus patterns

- `> [!NOTE]` callouts become the project's note component with the same
  content rules. If the project has no note component, use its closest
  equivalent and flag the gap.
- Collapsible FAQ blocks: use the project's collapsible or details
  component if it has one; otherwise render each FAQ as a bold question
  line followed by the answer paragraph, and flag that a collapsible
  component is part of the target style.
- Section wrappers and stable section identifiers: apply the project's
  component and id conventions to every H2 topic; cross-page anchor links
  must match them.
- Code, terminal output, and HTTP exchanges go in the project's labeled
  code figure; never bare fences if a figure component exists.

### Use the project's language

- Use the project's product terms exactly as its glossary or agent
  instructions define them. Do not invent synonyms and do not generalize a
  term when a specific one exists.
- Settings paths use the app's real navigation labels and routes, verified
  against the running app or source. A renamed setting with an old path is
  a broken doc.

### Honor the project's invariants

- Navigation: place the page in the navigation configuration as the
  project requires. Some catalogs enforce that a page appears exactly once;
  others allow cross-listing one page in several groups. Where
  once-only is enforced, achieve cross-listing's discoverability with a
  "Read more on" link from the related group's pages, and raise
  cross-listing with the maintainer when a page genuinely serves two
  audiences.
- Coverage: walk the project's agent-instruction entry-point list if one
  exists; otherwise derive the surface list from the primary workflows.
  Reverse states (retry, refresh, reconnect, reopen, remove, cancel, sign
  out) get a step or an FAQ entry on the page that owns the forward state.
- Screenshots: use the project's image pipeline. If the pipeline has no
  image support, flag that adding screenshots requires pipeline work rather
  than silently omitting them.

## Review checklist

- Title is one to three words and follows a corpus formula.
- Lede is one sentence and states the benefit; the page description field,
  if any, matches it.
- A screenshot follows the lede, and every step with visible UI has one.
- Sections follow Overview → Configure → Basics → FAQ; task headings are
  verb-first and ordered open/create → edit → share → niche.
- Every settings path is bolded, linked, and verified against the app.
- Every limit, number, and irreversible behavior is stated in a note or the
  relevant step, not discovered later.
- FAQ questions are real user questions with direct first sentences.
- Every cross-link resolves under the project's validation; the page is
  placed in the navigation configuration as the project requires.
- Product terms match the project's glossary; no corpus terminology leaked
  in.
- The project's components, frontmatter, and formatting conventions are
  followed; gaps are flagged, not improvised.
- No marketing voice, no hedging, no stacked lede patterns.
