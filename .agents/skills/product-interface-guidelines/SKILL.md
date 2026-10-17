---
name: product-interface-guidelines
description: >-
  Use when designing or reviewing a product interface, its copy, interactions,
  accessibility, or inclusive behavior against the project's guidelines.
---

# Product interface guidelines

Use the repository's local source files as the authority for this skill. This skill is a routing and review workflow. It does not replace the source material or claim authorship.

The source material is published by Apple Inc. This project is not affiliated with, sponsored by, or endorsed by Apple. Preserve the attribution notice and source URLs when copying or sharing this skill.

## Workflow

1. Identify the platform, interface surface, user task, and requested output.
2. Read only the relevant source files before making recommendations:

   - [Writing](references/hig-writing.md) for interface copy, labels, errors, empty states, voice, tone, and language patterns.
   - [Accessibility](references/hig-accessibility.md) for perceptibility, text sizing, contrast, VoiceOver, input methods, motion, and assistive technologies.
   - [Inclusion](references/hig-inclusion.md) for inclusive language, representation, gender identity, stereotypes, localization, and approachable experiences.
   - [Terminology and style](references/apple-style-guide.md) for terminology, capitalization, spelling, usage, and product names. For a narrow question, search for the specific term and read its entry instead of loading the whole guide.

   Read [source and attribution](references/source-and-attribution.md) when presenting, copying, or distributing the guidance.

3. Apply the source guidance to the actual interface and distinguish three things in the result: Apple's guidance, the product's constraints, and the recommendation for this interface.
4. For a review, report the observed issue, the relevant Apple source and heading, its user impact, and a concrete fix. Prioritize issues that block understanding, access, or task completion.
5. For interface copy, provide the proposed text and check clarity, action orientation, accessibility, inclusion, localization, and terminology against the relevant source files.
6. If the local sources do not cover the question, say so. Do not invent an Apple rule or present a general design preference as Apple's guidance.

## Source handling

The files in `references/` are the exact local source snapshot for this skill. Keep their content and frontmatter unchanged when updating the skill. Do not silently replace the local snapshot with newer web content. If freshness matters, use the source URL in each file's frontmatter and call out any difference.
