---
name: product-docs-writing
description: >-
  Draft or review product documentation pages in the task-first product
  docs voice: plain confident sentences, fixed page anatomy, verified
  settings paths, screenshots for UI features, and FAQ blocks. Not for
  developer documentation, changelog entries, or release notes. Project
  mechanics are derived from the repository being documented.
---

# Product docs writing

Create or review product documentation in the docs house style captured in
this skill's reference. Product docs are for people using the product;
developer documentation follows the developer-docs-writing skill, and
release notes and announcements follow the product-changelog-writing
skill. This skill organizes the work. The reference holds
the detailed, sample-derived style guidance. Project mechanics — MDX
components, frontmatter, navigation, product terms — come from the
repository being documented, not from this skill. This skill does not
decide what features exist; it documents verified product behavior.

## Process

1. Define the request.

   Identify the page type (feature how-to, concept, integration or
   setup, start guide), the feature or surface, the audience (new user,
   operator, integrator), and whether the request is to draft, revise, or
   review. Pages for people implementing against the product's APIs or
   protocols follow the developer-docs-writing skill instead. Decide
   which navigation group and position the page owns, using the
   information architecture rules in the reference. Check the page against
   the project's surface list from its agent instructions, or the surfaces
   derived from its primary workflows; a change that touches a surface
   usually needs a decision for that surface's page, even if the decision
   is that it does not apply.

   Completion criterion: the deliverable has a documented page type, scope,
   and audience, or the unresolved choice is visible.

2. Ground the work in the product.

   Verify behavior against the running app or its source before writing
   it: exact settings paths and routes, toggle names, limits, and reverse
   states (retry, remove, cancel, sign out). Quote UI labels as the app
   renders them. Do not invent screens, limits, or shortcuts. Where a
   screenshot is required, confirm the screen exists and state what it
   must show rather than fabricating a description.

   Completion criterion: every UI path, label, and behavioral claim
   matches the app or is marked for confirmation.

3. Route to the reference and the project's docs setup.

   Read [the docs-writing reference](references/docs-writing-guidelines.md)
   before drafting or reviewing. Apply its page anatomy, section patterns,
   voice and sentence patterns, and formatting conventions to every page.
   Apply its information architecture rules when deciding where a page
   lives and how sections are grouped. Then follow its project adaptation
   rules to learn the repository's docs pipeline: rendering components,
   frontmatter contract, navigation configuration, link validation, and
   product terminology.

   Completion criterion: every planned section follows the applicable
   reference guidance and the project's mechanics.

4. Produce the requested work.

   Draft in the house voice: one-sentence lede, Overview first, Configure
   before Basics, verb-first task headings, honest limits in notes, FAQ
   for real edge cases. Use the project's own components and product
   terms as the adaptation rules direct. Every cross-link must resolve
   under the project's validation.

   Completion criterion: the draft reads in the house voice with verified
   substance and passing links.

5. Finish with checks.

   Apply the reference's review checklist. Run the project's formatter and
   lint scripts. Confirm the page appears in the navigation configuration
   as that project requires, and that its docs link validation passes.

   Completion criterion: checklist complete or unresolved items listed.

## Return format

Return:

1. The requested draft or review findings.
2. The owning section, navigation group, page type, and skeleton used.
3. Unverified product facts and needed screenshots.
4. Navigation or cross-link changes.
5. A status such as "Draft ready for review."
