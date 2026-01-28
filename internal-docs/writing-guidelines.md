# Apple Writing Guidelines

This document serves as the **authoritative internal guide** for writing compliant, high-quality text within our application, strictly adhering to [Apple's Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/writing) and the [Apple Style Guide](https://help.apple.com/asc/en/page/28).

## Core Philosophy

The words you choose within your app are an essential part of its user experience. Design through the lens of language to help people get the most from your app.

### 1. Voice and Tone

- **Determine Your Voice**: Establish a voice that reflects your app's personality (e.g., "trustworthy and stable" for banking, "exciting" for games).
- **Match Tone to Context**:
  - **Straightforward & Direct**: Use for serious situations (e.g., payment errors, security alerts).
  - **Light & Congratulatory**: Use for achievements or positive feedback (e.g., "You set a personal record!").
- **Be Action Oriented**: Use active voice. Avoid checking for "Click here." Use descriptive verbs like "Learn more" or "Send."

### 2. Clarity and Brevity

- **Be Clear**: Choose easy-to-understand words. Omit unnecessary words.
- **Write for Everyone**: Use simple, plain language. Avoid jargon.
- **Scannability**: Break text into short paragraphs, use bullet points, and put the most important info first.
- **Empty States**: Use empty states to educate. Don't just show a blank screen; guide the user on _what to do_ next (e.g., "Add your first item").

### 3. Consistency

- **Language Patterns**: Reuse phrases for similar actions to build familiarity.
- **Capitalization**:
  - **Title Case**: Alerts, Menu Items, Button Labels.
  - **Sentence case**: Body text, instructions, descriptions.
  - _Rule_: Choose a style for each UI element type and stick to it universally.
- **Possessive Pronouns**:
  - Use sparingly. "Favorites" is better than "Your Favorites".
  - **Avoid "We"**: Don't use "We're having trouble." Use "Unable to load content."

---

## Inclusive Writing

We must write consciously to include everyone, reflecting the diversity of our users.

### General Guidelines

- **Think Inclusively**: Avoid words with harmful associations.
- **Violent Terminology**: Avoid _kill_, _hang_, or _terminate_ if it sounds violent. Use _force quit_ or _cancel_.
- **Oppressive Terms**:
  - **Avoid**: _Master/Slave_, _Whitelist/Blacklist_, _Grandfathered in_.
  - **Use**: _Primary/Replica_, _Allowlist/Denylist_, _Legacy status_.
- **Ableist Language**: Avoid _sanity check_, _crippled_, _blind spot_, _user-blind_. Use _functionality check_, _disabled_, _hidden area_.

### Gender Identity

- **Pronouns**: Use **they/them/their** as singular, gender-neutral pronouns.
- **Avoid Binary**: Do not use "men and women" or "he or she." Use "people" or "they."
- **Titles**: Use gender-neutral titles (e.g., _Mx._) or just names.
- **Assumptions**: Do not assume gender based on names or appearance.

### Disability

When writing about disability, follow individual preference. If unknown, use the table below:

| Preference         | Description                 | Example                                            |
| :----------------- | :-------------------------- | :------------------------------------------------- |
| **Identity-First** | Emphasizes culture/identity | "A Deaf person", "An autistic person"              |
| **Person-First**   | Emphasizes the individual   | "A person who is deaf", "A person on the spectrum" |

**Use & Avoid Table**:

| Avoid                                    | Use Instead                                                  |
| :--------------------------------------- | :----------------------------------------------------------- |
| Handicapped, Differently abled           | Person with a disability, Disabled person                    |
| Wheelchair-bound, Confined to wheelchair | Wheelchair user, Person who uses a wheelchair                |
| Hearing impaired                         | Deaf, Hard of hearing                                        |
| High/Low functioning                     | Describe specific support needs (e.g., "needs high support") |
| Asperger's                               | Autistic (unless individual specifies otherwise)             |
| Crazy, Insane, Mute, Dumb                | Wild, Unreasonable, Nonspeaking                              |

---

## Style & Usage

### 1. Units of Measure

- **System**: Use [SI units](https://www.bipm.org/en/measurement-units/) (International System of Units).
- **Spacing**: **Always** use a space between the number and the unit symbol.
  - _Correct_: `10 GB`, `1.5 m`, `20 °C`
  - _Incorrect_: `10GB`, `1.5m`, `20°C`
- **Compound Adjectives**:
  - **Spelled out**: Hyphenate. (e.g., _17-inch display_, _3-meter cable_)
  - **Symbols**: Do NOT hyphenate. (e.g., _35 mm film_, _20 nA battery_)
- **Decimals**:
  - Use a period (`.`) for decimals in English.
  - Use a **non-breaking space** for thousands separators (not commas).
  - _Example_: `300 000` (not `300,000`).

### 2. Dates and Times

- **Standard**: ISO 8601.
- **Date Format**: `YYYY-MM-DD` (e.g., `2023-09-12`).
- **Time Format**: 24-hour clock. Use a colon. (e.g., `18:00`).
- **Time Zones**: Use UTC offset or "Z". (e.g., `18:00Z` or `18:00 PST (UTC-8)`).

### 3. Technical Notation

- **Code Font**: Use code font for:
  - Filenames (`StandardCRuntime.o`)
  - Directories/Paths
  - Language constants/literals (`true`, `nil`)
- **Placeholders**: Use _italics_ for variable placeholders in running text.
  - _Example_: "Replace _volumeName_ with your disk name."
- **Syntax**: Do not use function names as verbs.
  - _Incorrect_: "Grep the file."
  - _Correct_: "Search the file using `grep`."
- **Punctuation**: Use regular font for punctuation following code, unless the punctuation is part of the code.

### 4. International Style

- **Country Codes**: ISO 3166 (2-char uppercase).
  - _Examples_: `US`, `JP`, `DE`, `ES`, `FR`.
- **Currency**: ISO 4217 (3-char uppercase). Place **after** the amount.
  - _Correct_: `1199 USD`, `1980 EUR`
  - _Incorrect_: `$1199`, `€1980`
- **Language Codes**: ISO 639 (2-char lowercase).
  - _Examples_: `en`, `fr`, `zh-CN`.
- **Telephone**: ITU-T E.123. Start with `+`.
  - _Example_: `+1 408 996 1010`

---

## UI Specifics

### Alerts and Errors

- **Avoid Blame**: Never say "You did X wrong." Focus on the problem.
  - _Bad_: "You entered an invalid date."
  - _Good_: "The date format is invalid."
- **Be Helpful**: Suggest a fix. "Choose a password with at least 8 characters."
- **No Mechanical Failures**: Avoid "Invalid name." Say "Use only letters for your name."
- **No "Oops"**: Avoid "Oops!", "Uh-oh", or "Error!".

### Settings & Controls

- **Labels**: Be specific and practical.
- **Descriptions**: Explain what happens when the setting is **ON**. Users can infer the "Off" state.
- **Hints**: In text fields, show _examples_ (e.g., `name@example.com`) rather than instructions.

### Device Specifics

- **Touch**: Use "Tap", not "Click".
- **Gestures**: Describe gestures accurately for the device (swipe, pinch, double-tap).

---

## Quick Reference Checklist

- [ ] Voice is consistent and appropriate for context?
- [ ] No "we", "my", or unnecessary "your"?
- [ ] Active voice used?
- [ ] Inclusive language checked? (No ableist/oppressive terms)
- [ ] Units have space (e.g., `10 MB`)?
- [ ] Currency code after amount (e.g., `10 USD`)?
- [ ] Dates in ISO 8601 (`YYYY-MM-DD`)?
- [ ] Placeholders in _italics_?
- [ ] Empty states provide clear "next steps"?
