---
name: product-changelog-writing
description: >-
  Draft or review changelog entries, release notes, developer
  notifications, and launch announcement posts in the declarative
  changelog voice: availability-first sentences with plans and rollout
  state, register scaled to the size of the news, fix lists in outcome
  grammar, and deprecation skeletons with migration steps and dates. Not
  for product docs or developer reference pages.
---

# Product changelog writing

Create or review release notes and announcements in the changelog house
style captured in this skill's reference. Changelog writing tells users
and developers what changed: changelog entries, release notes, developer
notifications, and launch posts. Product documentation follows the
product-docs-writing skill, and developer reference pages follow the
developer-docs-writing skill. Project mechanics — where entries live,
frontmatter, product terms — come from the repository being documented,
not from this skill. This skill does not decide what shipped; it
documents verified, shipped behavior.

## Process

1. Define the request.

   Identify the weight of the news (fix or quality-of-life item, small
   or medium feature, major launch, flagship, developer notification),
   the audience (users, developers, or both), and whether the request is
   to draft, revise, or review. The weight selects the register; a
   medium feature does not borrow the launch register.

   Completion criterion: the deliverable has a documented weight,
   audience, and register, or the unresolved choice is visible.

2. Ground the work in what shipped.

   Verify every claim against the actual change: the merged work, the
   rollout state, the affected plans, versions, and dates. Quote feature
   names as the product renders them. Never announce a plan gate, a
   partial rollout, or a date that was not verified. A changelog entry
   is a claim about behavior; an unverified claim is an error.

   Completion criterion: every behavioral claim, plan, date, and link
   matches the shipped change or is marked for confirmation.

3. Route to the reference and the project's changelog setup.

   Read [the changelog writing
   reference](references/changelog-writing-guidelines.md) before
   drafting or reviewing. Apply its register rules, entry anatomy,
   availability formulas, and deprecation skeleton. Then follow its
   project adaptation rules to learn where the project publishes
   entries and what mechanics they carry.

   Completion criterion: every planned section follows the applicable
   reference guidance and the project's mechanics.

4. Produce the requested work.

   State the change and its availability in the first sentence. Scale
   length to the weight of the news. Close on availability or a docs
   pointer. Fix lists in outcome grammar; deprecations in the full
   skeleton.

   Completion criterion: the draft reads in the house voice with
   verified substance and passing links.

5. Finish with checks.

   Apply the reference's review checklist. Run the project's formatter
   and lint scripts. Confirm the entry appears in the changelog
   configuration as the project requires.

   Completion criterion: checklist complete or unresolved items listed.

## Return format

Return:

1. The requested draft or review findings.
2. The weight, audience, register, and skeleton used.
3. Unverified rollout facts (plans, dates, availability).
4. Links to the docs pages or issues the entry must reference.
5. A status such as "Draft ready for review."
