# Policy writing guidelines

This guide captures the writing and structure of the eight supplied policy samples. The samples are OpenAI’s privacy, cookie, terms of use, and usage policies, plus Apple’s global privacy policy, privacy governance page, website terms of use, and iCloud terms.

The corpus represents two companies and a small number of policy types. Treat repeated patterns as useful evidence from this sample set, not as universal legal-drafting conventions or proof that a section is required. The source files are web-page captures and may also contain navigation text, formatting artifacts, stale footer text, or other material that is not part of the operative policy.

This is a policy-specific guide. It is not a user-interface copy guide. Use it to write formal policy pages that explain a service, set responsibilities, describe data practices, and state legal or operational consequences.

The samples provide patterns, not reusable legal substance. Do not copy their company names, legal entities, rights, legal bases, jurisdictions, providers, certifications, deadlines, warranties, liability limits, enforcement processes, or contact details into another product.

This guide is not legal advice. A product owner and qualified legal reviewer must confirm every material policy statement before publication.

## The sample-derived policy style

The sample pages present the policy itself as the primary content rather than writing it like a help article. Depending on policy type, they combine explanation of a service or organizational position with detailed rules, disclosures, limitations, controls, and consequences. Some openings also contain values-based or reassuring language, especially the usage, privacy, and governance samples, but that language does not replace the operative details.

Across the set, recurring characteristics include:

- A visible title. Six of the eight samples also show a dated version marker such as “Effective,” “Updated,” “Published,” or “Last revised,” although its position varies. The captured Apple privacy-governance page and OpenAI U.S. privacy policy do not show one.
- A clear opening that says which service, feature, user group, region, or offering the policy covers.
- A statement about related policies, regional versions, business offerings, product-specific notices, or third-party services when those boundaries matter.
- Definitions when terms have a special product or legal meaning, followed by consistent use of those terms.
- Descriptive sections and, in longer or more formal samples, numbered or lettered sections with nested feature-specific or legal details.
- A direct reader voice that uses “you” for duties, permissions, choices, and rights.
- A first-party voice that uses the company or product name, “we,” “our,” or “us” for commitments and actions.
- Clear distinctions between what a reader may do, must do, may not do, and what the company may or will do.
- Concrete examples introduced with phrases such as “for example” and “such as” when they clarify a general rule.
- Tables for repeated technical fields, especially cookie source, name, duration, purpose, and domain.
- Qualifiers for real variations, including region, feature, device, account type, applicable law, or user choice.
- Practical controls, contact routes, complaint or report routes, and the effect of using or not using those controls.
- A change section, revision history, previous-version link, or effective-date explanation when the product maintains one.

The samples also show that policy copy may contain long sentences when a legal condition, exception, or consequence needs precision. Preserve every necessary condition, exception, and consequence when editing.

## Source-of-truth rule

Start with the actual product and its approved legal position. The policy must describe current behavior, not a planned feature, an assumed provider practice, or an attractive promise.

Across the policy set, verify every applicable dimension of a material fact: the actor, action, object, purpose, recipient or location, duration, reader control, and resulting consequence. Not every sentence needs every dimension. The samples often organize them across collection, use, disclosure, retention, and controls sections; use headings, tables, and cross-references to keep the complete account understandable without repeating it mechanically.

If a fact is unknown, confirm it before drafting. Do not conceal the missing fact with a vague qualifier or an unsupported promise.

Separate three kinds of content:

- **Product fact**: what the product currently does, stores, sends, limits, or supports.
- **Reader obligation or choice**: what the reader must do, may do, may not do, or can control.
- **Legal position**: a right, legal basis, jurisdiction, disclaimer, warranty, liability rule, notice period, or enforcement power that requires approval.

Copy the structure of a sample only after replacing its substance with facts for the product being documented.

## Provider and dependency research

Policy facts come from the product's full operating stack, not only its own interface and source code. Before drafting, inventory the services, packages, and integrations the project actually uses in production. Check deployment configuration, package manifests, environment-variable names, network calls, data schemas, authentication flows, storage code, and enabled provider features rather than assuming that every installed dependency is active.

The inventory may include:

- hosting, edge delivery, serverless compute, DNS, bot protection, and rate limiting;
- databases, object storage, caches, backups, queues, logs, and observability;
- authentication, email, messaging, customer support, and error reporting;
- analytics, advertising, consent management, and experimentation;
- payments, billing, fraud prevention, and tax services; and
- user-configured integrations, APIs, plugins, players, or connected applications.

For each active provider, read the documents that actually govern the product or plan in use. These may include a product or subscription agreement, service-specific terms, privacy policy, data processing agreement, security exhibit, cookie or feature addendum, subprocessor list, retention documentation, and service-level terms. A provider's general website terms may expressly exclude its subscribed or account-based products, so confirm that the document applies before relying on it.

Record, where relevant:

- the provider's exact legal and product names;
- the feature supplied and the data it receives, creates, stores, or transmits;
- whether it acts as a processor, service provider, controller, or independent third party for each processing purpose;
- its subprocessors and processing locations;
- documented retention, deletion, backup, security-incident, and transfer terms;
- user controls and the effects of disabling the provider feature; and
- the document title, URL, effective date, and date last verified.

A provider can have different roles for different purposes. Describe those roles separately instead of assigning one role to every provider activity. Distinguish the provider's processing of project user data from its processing of the project owner's account, billing details, provider-dashboard activity, or visits to the provider's own website.

Use provider terms to describe the provider relationship accurately, but do not pass the provider's promises, service levels, governing law, dispute forum, warranties, or liability terms through to the project's users unless the project has independently adopted and approved them. Do not attribute a provider's website analytics, advertising cookies, or marketing practices to the project unless those technologies actually run in the project.

Recheck provider documents before publication and when a provider, plan, deployment region, enabled feature, or material provider term changes. If an authoritative page cannot be read reliably, obtain an accessible official copy rather than drafting from a search snippet or secondary summary.

## Document anatomy

Use the following anatomy as a starting point. Omit a section that does not apply. Add a section when the product has a material fact that readers need to understand.

1. **Title and version marker**: name the policy or service directly. Normally show the effective, updated, published, or last-revised date; if a page has no version date, make that a deliberate product and legal decision. The dated samples place dates above the title, below it, or at the end, so choose one consistent position across the policy set. Include a previous-version link or changelog only if one exists.
2. **Opening scope**: explain the covered service, features, audience, region, and important exclusions.
3. **Related documents**: link to privacy, cookie, service-specific, business, usage, copyright, support, or regional documents by their names when they apply.
4. **Definitions**: define terms before using them as legal or technical terms.
5. **Main sections**: arrange the rules and disclosures in a reader-understandable order. Use numbered headings when they improve navigation or cross-references in a long document; the samples do not use numbering uniformly.
6. **Controls and responsibilities**: tell the reader what they can change, what they must protect, and what happens after a choice or failure.
7. **Contact or reporting route**: identify the correct path for questions, privacy requests, copyright notices, abuse reports, complaints, or appeals when supported.
8. **Changes and resources**: explain updates, related resources, or regional disclosures when the product maintains them.

Use a short explanatory paragraph before a detailed list or table. Then state the exact facts. Do not make the reader infer a limit, recipient, retention period, required action, or consequence from scattered sections.

## Voice and sentence patterns

The samples use a controlled, direct, reader-facing voice. They explain a subject first, then state the rule or consequence.

Use the following patterns:

- Use the product or company name when the actor must be clear: “[Product] stores…” or “[Company] may…”.
- Use “we,” “our,” and “us” only after the first-party entity has been identified and the pronouns remain unambiguous.
- Use “you” for the reader’s actions, obligations, permissions, choices, and rights.
- Use “may” for a possible or permitted action, “can” for an available capability, “must” for a requirement, and “will” for a stated commitment or outcome.
- Put the condition next to the action it controls: “If you disable necessary cookies, parts of the service may not work.”
- Put the consequence next to the triggering behavior: “If you exceed the storage limit, you may not be able to add more content.”
- Use “for example,” “such as,” and “including” to explain a category. Do not let examples silently become an exhaustive list.
- Use “depending on where you live,” “where required by law,” or similar qualifiers only when a real regional or legal condition changes the result.
- Use “to the extent permitted by law,” “subject to applicable law,” and similar legal qualifiers only in approved legal statements.
- Keep product names, defined terms, provider names, feature names, and capitalization consistent within the page and across related pages.

The sample set mixes conversational contractions with formal legal language. Either style can be appropriate. Choose the level of formality that fits the document and keep the policy’s operative rules unambiguous.

Values-based or reassuring language appears in some samples, but keep it substantiated, restrained, and subordinate to the operative policy. Do not turn rules into slogans or promotional claims, and do not use unexplained technical shorthand. Do not shorten a sentence by removing an exception, condition, jurisdiction, or consequence.

## Definitions and cross-document language

Define a term when it has a special meaning in the policy or when readers could reasonably interpret it in more than one way. Use the same defined term afterward.

The samples use defined terms such as “Services,” “Personal Data,” “Content,” “Input,” “Output,” “Account,” “Service,” “Site,” “Third Party Services,” and “Cookies.” Defined terms are often capitalized, but capitalization alone does not create a definition.

Create a project-specific terminology list before drafting. For each proposed defined term, record its exact meaning, capitalization, singular and plural forms, and the pages that use it. Resolve competing names before publication. The samples demonstrate this approach with terms such as “Services,” “Personal Data,” “Content,” “Account,” “Service,” and “Site”; a new project must supply its own verified vocabulary.

Link to a related policy by its name, such as “Cookie policy” or “Usage policy.” As an editorial and accessibility safeguard beyond the corpus—which contains at least one “click here” link—avoid unexplained link text. Do not create a link to a document or control that does not exist.

## Privacy policy characteristics

The sample privacy policies establish the covered service and personal-data concept early, then cover collection, use, disclosure, retention, controls, rights, and regional or operational information. Their order differs: for example, Apple places privacy rights before its collection details, while OpenAI uses a numbered collection-to-rights sequence.

Use this order when it matches the product:

1. **Scope and applicability**: identify the service, regions, user groups, related services, business offerings, and exclusions. State when third-party privacy practices are outside the policy.
2. **Definition of personal data**: explain what the policy treats as personal data and define the term.
3. **Product-specific notices**: link to feature or regional notices when a feature has different data handling.
4. **Data the reader provides**: account, contact, payment, communication, profile, content, credentials, or other information submitted by the reader.
5. **Data received from using the service**: log, usage, device, location, cookie, security, diagnostic, or interaction data.
6. **Data from other sources**: partners, providers, people acting at the reader’s direction, public sources, or fraud and safety sources, when applicable.
7. **Uses**: explain how the product provides, maintains, improves, personalizes, secures, communicates about, and legally operates the service.
8. **Disclosures**: separate service providers, affiliates, partners, business transfers, government or legal requests, administrators, and people or services with whom the reader shares information.
9. **Retention**: describe data that remains until the reader deletes it, data deleted automatically, and data retained longer for security, safety, financial, or legal reasons when those rules are verified.
10. **Controls and rights**: list account controls, export or deletion, opt-outs, access, correction, restriction, portability, consent withdrawal, complaint, verification, authorized-agent, and appeal processes when supported or legally applicable.
11. **Children, security, cookies, and international processing**: give each material topic a clear section when it applies.
12. **Controller, contact, resources, and changes**: identify the responsible entity, contact route, useful resources, current date, and update process when applicable.

Taken together, the relevant sections should explain what the product receives or creates, why it uses it, who receives it, where it is processed when material, how long it remains, and what the reader can control. Grouping by collection, use, disclosure, retention, and controls is valid; add a table or cross-reference when readers otherwise could not connect a material flow. Separate data stored by the service from storage on the reader’s device.

If the product does not collect or store a category of data, state that absence only when it is verified and meaningful to the reader’s decision. Do not claim data minimization, privacy by default, deidentification, a legal basis, an international transfer mechanism, a certification, or a government-request process without evidence and legal approval.

## Cookie policy characteristics

The sample cookie policy begins by defining cookies and similar technologies, distinguishes first-party from third-party technologies, and separates cookie categories.

Use these sections when they apply:

1. **What cookies are**: explain cookies, pixels, web beacons, device identifiers, APIs, local storage, or other technologies that the product actually uses. State that the policy uses “cookies” as shorthand only if that is true.
2. **Necessary cookies**: explain why they are required and what features they enable.
3. **Analytics cookies**: describe measurement technologies only if the product uses them.
4. **Marketing or advertising cookies**: describe them only if the product uses them.
5. **Inventory tables**: list the source, exact cookie name, duration, purpose, and domain. Use one row per known cookie or a clearly labeled provider-managed group.
6. **Variation note**: explain if cookies vary by region, service, browser, device, consent choice, or provider.
7. **Managing cookies**: describe product controls, browser controls, and whether the control applies to one device or browser.
8. **Functionality impact**: state what may stop working when a reader blocks necessary cookies or storage.
9. **Additional information and contact**: provide the approved privacy contact and supporting resources when available.

Do not list a cookie because a dependency could set it. Verify the production name, duration, source, purpose, and domain. If a provider controls those details, say that the provider’s names or durations may vary rather than guessing.

## Terms-of-use characteristics

The sample terms begin as an agreement and identify the service and legal relationship. Access, use, content, ownership, third parties, account lifecycle, service changes, and legal remedies recur, but their order varies substantially by the service and the age or drafting style of the document.

Use this order when it matches the service:

1. **Agreement and service scope**: say what the terms cover, who the agreement is between, what related terms apply, and which regional or business terms replace them.
2. **Provider identity and eligibility**: identify the operating entity, minimum age, authority to accept, and registration requirements.
3. **Account and security**: state accuracy, credential, confidentiality, unauthorized-use, recovery, and administrator rules.
4. **Using the service**: distinguish what the reader may do from what the reader must do and may not do.
5. **Service-specific restrictions**: cover scraping, automation, reverse engineering, unauthorized access, interference, rate limits, impersonation, unlawful use, or other restrictions only when they apply.
6. **Third-party services**: explain separate terms, third-party output or content, provider limits, and lack of control or endorsement.
7. **Content**: explain what the reader provides or receives, ownership, permissions, the license needed to operate the service, content responsibility, sharing, accuracy, and any deletion or removal process.
8. **Intellectual property**: state the company’s rights in the service, software, marks, and content, and the reader’s permitted license if applicable.
9. **Paid services**: cover billing, renewals, taxes, credits, cancellation, refunds, and price changes only when applicable.
10. **Suspension, termination, and discontinuation**: state triggers, notice, cure, appeal, account deletion, content access, refunds, and other effects when supported.
11. **Disclaimers, liability, and indemnity**: use only approved legal language and preserve jurisdiction-specific exceptions.
12. **Disputes, copyright, notices, and general terms**: include only the approved process, reporting route, governing law, severability, assignment, entire agreement, trade controls, and notice rules.

Apple’s iCloud sample also shows a feature-by-feature terms pattern. When a service has materially different features, explain each feature’s data movement, sharing setting, capacity, dependency, recovery risk, and deletion effect in its own subsection.

## Usage policy characteristics

The sample usage policy opens with purpose and principles before listing prohibited uses. It frames responsible use as shared, explains enforcement and reporting, and ends with a changelog.

Use this pattern:

1. **Purpose**: explain what the policy protects and how it relates to the broader service terms or safety program.
2. **Shared responsibility**: state that readers remain responsible for lawful, safe, and authorized use.
3. **Enforcement and review**: describe monitoring, enforcement, appeal, or review only when the product actually provides those processes.
4. **Grouped rules**: organize prohibitions by the harm or protected interest, such as people, privacy, minors, connected services, intellectual property, or shared capacity.
5. **Specific examples**: list recognizable behaviors under each group. State whether the list is illustrative or exhaustive when that distinction matters.
6. **Product-specific rules**: address credentials, access controls, rate limits, automation, integrations, or other product risks.
7. **Reporting and updates**: provide the approved report route and explain how the current policy is identified.
8. **Changelog**: include dated changes only if the product maintains a real history.

Begin a rule with a clear permission or prohibition, such as “You may not use…” or “You must…”. Name the behavior and the person, system, service, or resource it protects. Do not import another company’s safety categories, monitoring claims, appeal process, or enforcement promises.

## Privacy governance characteristics

The Apple governance sample is a separate accountability document, not a normal privacy notice. It describes organizational practices such as privacy by default, minimum necessary data, cross-functional oversight, privacy impact assessments, third-party review, employee training, security and incident response, complaints, policy updates, government requests, deidentification, and accountable data transfers.

Create a governance page only when the organization can substantiate those processes. Do not turn an aspiration into a present-tense commitment. If the product has no separate governance program, keep the policy set focused on actual service behavior and approved legal obligations.

## Policy-set map

The samples support four reusable policy patterns plus a separate governance pattern. Use only the documents and topics that fit the project:

| Policy type | Sample-derived emphasis |
| --- | --- |
| Privacy policy | Define scope and personal data; explain collection, use, disclosure, retention, controls, rights, children, security, international processing, responsible entities, contact, and changes when applicable. |
| Cookie policy | Define cookies and similar technologies; separate actual categories; inventory verified technologies; explain variation, controls, browser or device scope, functionality impact, and contact information. |
| Terms of use | Establish the agreement and service scope; explain eligibility, accounts, permitted and prohibited use, content, intellectual property, third parties, paid services, suspension, termination, availability, disclaimers, disputes, notices, and changes when applicable. |
| Usage policy | Explain purpose and shared responsibility; group product-relevant prohibitions; describe enforcement, reporting, appeals, updates, and a changelog only when those processes exist. |
| Privacy governance | Describe substantiated organizational privacy practices, oversight, training, security, incident response, complaints, government requests, deidentification, and accountable transfers. |

The corpus does not directly cover other documents such as open-source license notices, accessibility statements, community guidelines, or refund policies. Do not present a structure for an uncovered document type as sample-derived without obtaining relevant samples.

## Cross-policy consistency review

Before publishing a policy set, compare every page for:

- each document’s name matching across its visible title, route metadata, navigation, and cross-policy links;
- consistent date formats, product names, defined terms, provider names, and feature names;
- matching storage limits, retention periods, usage allowances, age rules, and deletion effects wherever the pages describe the same scope, with intentional feature, account-type, or regional differences stated explicitly;
- matching descriptions of what the product stores, sends, does not store, or cannot recover wherever the same data flow is discussed;
- matching links to the privacy, cookie, terms, usage, support, and report destinations that actually exist;
- matching route metadata, page summaries, visible headings, and dates;
- consistent separation of the company, its products, service providers, user-directed third parties, independent third-party services, and user-provided content;
- controls that match the current product, including cookie settings, account deletion, session revocation, and privacy requests; and
- legal text, rights, jurisdictions, notice periods, disclaimers, liability limits, and enforcement powers that have received specific approval.

When one canonical fact changes, search every policy and related page for the old term and value. Do not fix one page while leaving a conflicting statement elsewhere.

## Publication checklist

Before publication, confirm that:

- the policy identifies its service, audience, region, relevant exclusions, and normally its version date; any omitted date is deliberate and approved;
- every defined term is necessary, accurate, and reused consistently;
- the opening explains the document’s purpose before the detailed rules;
- each major section answers one policy question and uses a descriptive heading;
- across the relevant sections, every material data, cookie, content, account, or service flow covers each applicable actor, action, purpose, recipient, location, duration, control, and consequence without unnecessary repetition;
- tables contain verified values and clearly labeled fields;
- permissions, duties, prohibitions, possible actions, and commitments use the intended modal verb;
- provider and third-party boundaries are explicit;
- every named provider and material production dependency has been checked against the controlling, service-specific documents for the product and plan in use;
- provider roles, data categories, subprocessors, locations, controls, and transfer or retention statements are current, scoped to the relevant processing purpose, and linked when useful;
- controls, contact routes, report routes, complaints, appeals, and deletion effects are accurate;
- regional, children’s, security, transfer, legal-basis, certification, and governance statements are evidence-backed;
- disclaimers and liability terms are approved and include required legal exceptions;
- related policy links and resources point to real destinations;
- changes, previous versions, and changelogs are included only when maintained; and
- product and legal owners have reviewed the final copy.
