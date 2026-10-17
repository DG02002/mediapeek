# Changelog writing guidelines

This guide captures the changelog and announcement house style. Its
patterns come from full-body reads of four sources in September and
October 2026: twenty-five entries from an issue tracker's changelog
read through its full-text archive, nineteen entries from a deployment
platform's changelog, nine posts from an operating system vendor's
developer news page, and six posts from an AI company's newsroom. The
sources established the shape; this guide states it as the style to
write in.

Treat the sample examples in this guide as evidence of the style, not as
content to copy. Do not carry their product names, plans, or feature
claims into the product being documented. Replace their substance with
the verified, shipped behavior of the product being documented.

This is a changelog guide, and it is project-agnostic: the project's own
mechanics — where entries live, frontmatter, publishing, product
terminology — are discovered from the repository being documented,
following the project adaptation rules at the end of this guide.
Product documentation follows the product-docs-writing skill, developer
reference pages follow the developer-docs-writing skill, and formal
policies follow the product-policy-writing skill.

## Contents

- The changelog style
- Choosing the register
- Titles
- Entry anatomy
- Fix lists
- Availability, plans, and rollout
- Deprecations, renames, and breaking changes
- Developer notification posts
- Voice and tone
- Media
- Index and feed conventions
- Project adaptation rules
- Review checklist

## The changelog style

Announce changes as accomplished facts. Recurring characteristics:

- "Now" is the signal word. The first sentence states the change and its
  availability in one breath: "Volumes are now available in public
  beta on Free, Pro, and Enterprise."
- Every sentence carries a behavior, not an adjective. Numbers do the
  celebrating: "cutting costs by up to 85% for high-concurrency
  workloads."
- Length scales with stakes; adjectives never do. A rename can be six
  words. A flagship launch gets sections.
- No marketing CTA. Entries close on availability or a docs pointer.
- Fixes and features are described by their user-visible outcome, never
  their engineering cause.

## Choosing the register

Pick the shape by the weight of the news:

- **Fix or quality-of-life item** — a fix-list bullet, or a 30–90 word
  entry.
- **Small or medium feature** — a flat entry: capability sentence,
  definition if the concept is new, use cases, availability, docs
  pointer. 90–200 words.
- **Major launch** — a narrative entry: problem sentence, named feature,
  benefit sections, availability. 200–450 words.
- **Flagship** — a launch post (or blog-length entry) of roughly 700
  words with the full arc below.
- **Developer notification** — deprecation, rename, deadline, removal,
  pricing change: the terse notification post described below,
  regardless of size.

## Titles

- Default: a declarative sentence stating the change as accomplished
  fact, sentence case. "Search now available on Business plans." /
  "Runtime logs now show cache reasons." / "Request logs are now
  called Network logs."
- A plain noun phrase names the feature for quiet changes: "Priority
  inbox", "Team initiatives", "Search trace spans from the CLI".
- "Introducing X" or a benefit clause is reserved for flagship launches:
  "Introducing the coding agent", "Passkeys: A fast and secure way to
  log in".
- Numbers belong in titles when they are the news: "Deployment step now
  10% faster".
- Four to twelve words, sentence case, no colon subtitles, no emoji, no
  trailing periods.

## Entry anatomy

### The flat entry

1. First sentence: the change plus availability. "You can now create as
   many stores as you need. The previous limits of 100 stores on Free
   and 500 on Pro no longer apply."
2. A definition sentence for a new concept: "A Volume is persistent
   storage that you mount as a directory in a sandbox."
3. Use cases, imperative-led: "Use volumes to preserve an agent's
   workspace, or to reuse datasets and dependency trees."
4. Close with a docs pointer or the availability formula: "Learn more
   in the volumes documentation."

### The launch entry

1. Open with one concrete problem sentence, not a market claim:
   "Customer feedback is often scattered across support tickets, chat
   messages, and calls – outside the product team's workflow and
   sometimes entirely out of reach."
2. Name the feature and define it in one sentence: "Loops are a new way
   for the agent to take on recurring work for your team."
3. Benefit-named sections, each a capability paragraph or bullets:
   "Adaptive routing", "Automate the first pass", "Availability and
   pricing".
4. The exact way to start: "Type `/callout` to get started." A real UI
   path, not "check out our docs".
5. One honest limitation: "AI is powerful and at times can be
   unpredictable. If you're not getting the results you expect, try
   rephrasing your query."
6. Availability and pricing, then the docs pointer. Flagship entries
   may close by linking a longer artifact: "Read the blog post to learn
   more."

### The flagship post

For launches that need adoption effort:

- A bolded thesis sentence, then the one-sentence product introduction:
  name plus lineage plus differentiator. "We're introducing **Turbo**,
  an upgrade to the standard model that nearly matches the top tier's
  intelligence at one-fifth of the price."
- Benefit-named sections, each grounded in a concrete anecdote: "A bug
  appears in the team chat, and the agent immediately starts
  investigating."
- Quantified claims with a methodology footnote, and one stated
  limitation: "Agents can still make mistakes, so always review
  consequential work."
- "Pricing and availability" as the final section, then one
  forward-looking sentence.

## Fix lists

- Subjectless, past-tense, verb-first outcome bullets:
  - "Fixed the cycle capacity calculation."
  - "Stopped retrying permanent webhook delivery errors."
  - "Renamed canonical issue duplicate relation labels from 'Duplicated
    by' to 'Duplicates'."
- Improvements may flip to capability framing: "You can now download
  any comment attachment as a file."
- Group bullets by surface label (iOS, Desktop, Editor, Chat), then an
  ungrouped tail.
- No media, no contractions, no elaboration. The bullet is the outcome.

## Availability, plans, and rollout

- Plans are named exactly, in the first sentence: "available on Business
  and Enterprise plans", "on every plan, including Basic and Free", "GA
  for Pro teams".
- Stage ladder: private beta → public beta or alpha or preview →
  generally available. Promotions are announced as their own entries:
  "Batch editing is now generally available."
- Rollout tense is graded honestly: "rolling out today" / "over the
  coming weeks" / "coming this fall". Say what a reader without the
  feature should expect: "If you don't see a Teams page yet, stay tuned
  as we roll it out to everyone over the next few weeks."
- Negative availability is stated explicitly: "The model is not yet
  available in the desktop app."
- Pricing is concrete, with units and free allowances: "storage costs
  $0.05 per GB-month; the Free plan includes 15 GB per month at no
  additional cost."
- Version and deadline gating: "Starting April 28, 2026, apps uploaded
  need to meet the following minimum requirements" / "requires CLI 44.5.1
  or later".

## Deprecations, renames, and breaking changes

A fixed skeleton, whether a section or its own entry:

1. The title states the new state, not the loss: "Request logs are now
   called Network logs."
2. Immediately quantify what does not change: "A naming change only:
   pricing, limits, and how usage is measured are unchanged."
3. The reason, in one sentence.
4. The exact migration step: "update your endpoint from
   https://mcp.example.com/sse to https://mcp.example.com/mcp".
5. A hard date, deadline-first: "Existing apps will have until April 1,
   2026 to migrate."
6. The observable trace for behavior changes: "Requests received after
   that are logged with the reason `vary_key_denied`."
7. Required action or its absence: "No action is required for projects
   using Node.js 20 or later."
8. Situation-split actions, including the no-op case: "If you've already
   migrated: No further action is required."
9. Corrections and additions are appended with a bolded "Update:"
   prefix, never rewritten silently.

## Developer notification posts

For deprecations, deadlines, submission windows, and program changes —
the terse register:

- Availability-first first sentence: "The beta versions of CLI 3.2 and
  SDK 3.2 are now available."
- Checklist paragraphs open with a two-to-four-word imperative:
  "Download the release candidate. Build and test with the latest SDK."
- What's-new bullets open with a bolded fragment: "**More than 100 new
  metrics.** Now you can access monetization data in Analytics."
- The literal heading "What you need to do:" before situation-split
  bullets.
- Precise failure modes, not "this is deprecated": "Your code will
  continue to compile, but you'll receive warnings" / "will cause a
  runtime error".
- Enumerate affected versions in full, every time. No "all platforms"
  shorthand.
- End on a links block, nothing after it. No media, no marketing.

## Voice and tone

- The feature is the subject. "We" appears only where the company acts
  ("we've added", "we'll provide clear advance notice before any pricing
  changes take effect"); the tersest corpus never uses "we" at all.
- Restrained by default; celebratory only at true launches, and at most
  one exclamation mark per launch. "Mobile has arrived." is the
  ceiling.
- Contractions are natural in prose and absent from fix bullets.
- Credit feedback in half a sentence, without flattery: "We've heard
  your feedback that you would like to manage issues for open source
  projects." Name an individual when the idea came from one.
- Prove internal use with a number: "We use this workflow internally to
  resolve roughly 30% of incoming bug reports."
- Own missteps in the same register: "We like to ship fast but realized
  we moved a bit too quickly this time."

## Media

- A hero screenshot or silent looping video under the heading for every
  feature section; none for fix lists or notifications.
- Multi-part launches add one image per section.
- Alt text is a full descriptive sentence: "The inbox in dark mode,
  showing Priority and Other tabs with several notifications about
  issue assignments."
- Screenshots contain realistic product data.
- Code blocks count as media for developer entries, each with a
  one-sentence caption: "Search trace spans in the CLI."

## Index and feed conventions

- Reverse chronological. One entry per change, or entries batched per
  release with the headline feature first — follow the project's cadence
  and do not mix the two within one feed.
- The opening paragraph doubles as the meta description and the index
  excerpt: write it to survive out of context.
- Entries carry a date and a permalink; batches group fixes by surface.
- Company milestones ship as ordinary entries, not special formats.

## Project adaptation rules

The patterns above are rendering-agnostic. Before writing, learn how the
repository being documented ships release notes: where entries live —
in-app MDX, a marketing site, GitHub releases, or a feed — how they are
ordered, permalinked, and dated, what frontmatter or metadata they
require, and what validation runs against their links. If the project
has no changelog surface at all, flag that publishing one is pipeline
work; do not invent a location. Existing entries set the format; follow
them, and flag gaps rather than inventing new components or frontmatter
fields.

Then map the style onto the project's mechanics:

- Register rules, skeletons, and fix-list grammar apply unchanged;
  notes and updates use the project's callout component, or the closest
  equivalent with the gap flagged.
- Hero media uses the project's image pipeline; if none exists, flag
  that a screenshot requires pipeline work rather than silently
  omitting it.
- Feature names appear exactly as the product renders them, product
  terms follow the project's glossary, and plan names match the pricing
  page verbatim.
- Every behavioral claim, plan, and date is verified against the merged
  change and the actual rollout, and links resolve to docs pages that
  exist at publish time.

## Review checklist

- The first sentence states the change and its availability in one
  breath, and survives as an excerpt out of context.
- The title is a declarative "now" sentence or a plain noun phrase,
  sentence case, without a subtitle.
- The register matches the weight of the news; nothing is padded.
- Every sentence carries a behavior, not an adjective; no banned
  marketing words; at most one exclamation mark, launches only.
- Plans, stages, rollout state, and pricing are exact; negative
  availability is stated where true.
- Fixes are outcome bullets grouped by surface.
- Deprecations follow the skeleton: new state, what does not change,
  migration step, hard date, no-op case.
- Media present for features, absent for fixes and notifications; alt
  text is a full sentence.
- Docs links resolve; feature names and plan names match the product,
  and no corpus terminology leaked in.
- The project's components, frontmatter, and conventions are followed;
  gaps are flagged, not improvised.
