# React Application Engineering Skills v1 — Independent Review Rubric

Assessment slug: `react-application-engineering-skills`

Proposed bank slug: `react-application-engineering-skills-bank-v1`

Review baseline: `OCT-RAES-2026.1 (React and React DOM 19.2 documentation snapshot 2026-07-19)`

Status: pre-authoring review gate. No question pack has been reviewed or approved by this report. The production shell must remain private and pending until every release gate below passes.

## Current shell finding

The seeded shell description is directionally appropriate, but its inherited generic software-engineering topics and single mixed blueprint row drawing 10 questions are not a valid React certification design. Replace them with the eight React-specific domains below. Retired starter questions are not eligible inventory and must not be reactivated.

This assessment is vendor-neutral React web application engineering. It must not imply a certification from Meta, mastery of a particular framework, or coverage of React Native. Questions that depend on a framework, router, state library, test runner, bundler, or CSS system must either be removed or supply all relevant behavior in the stem.

## Required blueprint

The live form draws 16 questions: exactly two from each topic. Each topic must contain 10 independently reviewed candidates, providing five non-overlapping rotations and meeting the certification minimum of 80 approved questions.

| Topic | Objective range | Candidate pool | Draw |
| --- | --- | ---: | ---: |
| Components, JSX and composition | `RAES-COMP-*` | 10 | 2 |
| State, events and data flow | `RAES-STATE-*` | 10 | 2 |
| Hooks, effects and external synchronization | `RAES-HOOK-*` | 10 | 2 |
| Forms, actions and asynchronous UI | `RAES-ASYNC-*` | 10 | 2 |
| Accessibility and semantic React DOM | `RAES-A11Y-*` | 10 | 2 |
| Rendering, performance and responsiveness | `RAES-PERF-*` | 10 | 2 |
| Testing, debugging and code quality | `RAES-QUAL-*` | 10 | 2 |
| Application boundaries, SSR and hydration | `RAES-ARCH-*` | 10 | 2 |
| **Total** |  | **80** | **16** |

Every topic pool should contain three easy, five medium and two hard items, for a total of 24 easy, 40 medium and 16 hard. Difficulty is determined by reasoning burden, not stem length:

- Easy: one documented rule or direct code trace, with no obscure recall.
- Medium: diagnose a realistic defect or choose between plausible implementation trade-offs.
- Hard: combine two or more React constraints, trace lifecycle/concurrency behavior, or reason across a server/client boundary.

The production blueprint should use eight topic-scoped mixed-difficulty rows, each drawing two questions for one mark and no negative mark. Before release, sample at least 100 forms and verify every form has 16 unique items, two from every domain, and no severe difficulty skew. This sampling does not replace the deterministic inventory gate.

## Source and scope policy

Use item-specific primary sources from the official React 19.2 documentation and W3C/WAI accessibility guidance. The React reference identifies the stable 19.2 APIs and separately labels Canary or Experimental features; Canary/Experimental behavior is outside this release unless the stem explicitly labels it as non-stable and the item tests recognition rather than implementation.

Primary source anchors:

- React 19.2 reference and stable API inventory: https://react.dev/reference/react
- React 19.2 release behavior: https://react.dev/blog/2025/10/01/react-19-2
- Modern React learning scope: https://react.dev/learn
- React DOM controls and forms: https://react.dev/reference/react-dom/components
- Rules of React and hooks lint behavior: https://react.dev/reference/rules
- React test helper behavior: https://react.dev/reference/react/act
- Accessible form semantics: https://www.w3.org/WAI/tutorials/forms/
- Accessible names and descriptions: https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/

Do not cite search results, blogs, generated summaries, or old `legacy.reactjs.org` guidance as answer authority. Third-party documentation may be used only for a third-party behavior that is explicitly in scope.

React Server Components require special caution. React 19.2.0 packages named in the official December 2025 security advisory contained a critical vulnerability, fixed in patched lines including 19.2.1. No item may recommend installing or retaining React Server Component packages at 19.2.0, and security/version questions must cite the current official advisory rather than treat the October release post as the latest operational guidance: https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components

## Item-level review protocol

Approval is per exact content hash and version, never per file or topic batch.

For each of the 80 items, the independent reviewer must:

1. Read the stem without looking at the key; identify the intended competency and solve it.
2. Execute or mentally trace every supplied code path under the stated React/DOM environment. Reject missing assumptions.
3. Open the item-specific primary source and confirm the claimed behavior applies to stable React 19.2.
4. Check the keyed option and explanation against both the code and source. The explanation must state why the key is correct, not merely restate it.
5. Test every distractor as a possible answer. It must be plausible because of a recognizable misconception, yet false under the exact stem. Reject overlapping, partially correct, stylistically conspicuous, or joke options.
6. Confirm that the question measures React engineering rather than JavaScript trivia, framework knowledge, vocabulary recall, or personal preference.
7. Confirm topic, objective code, difficulty, syllabus string, source URL, answer-validation record and distractor note.
8. Record an item-specific substantive review note tied to the exact content hash/version using a reviewer identity distinct from the author.

Any change to the stem, options, key, explanation, topic, objective, source, syllabus evidence, or metadata creates a new item version and invalidates the earlier approval. An author-authored “verified” note is evidence for reviewer intake, not independent approval.

Pack-wide checks must also reject:

- duplicate or near-template stems;
- answer-position concentration or detectable key patterns;
- repeated scenarios with only names/numbers changed;
- negative stems such as “Which is NOT” unless necessary and visually unambiguous;
- “all/none of the above,” trick wording, opinion-based “best practice,” and multiple defensible answers;
- inaccessible code images, color-only meaning, unexplained symbols, or essential information embedded in a URL;
- placeholder text, generic workplace filler, unsupported formats, incomplete options, or explanations under the acceptance minimum.

## Accessibility requirements

Accessibility must be assessed both as React subject matter and as exam delivery behavior.

Content items should test native semantic elements before ARIA, explicit or implicit form labels, accessible names, keyboard operation, focus management after meaningful UI changes, error identification, and non-color status communication. Avoid the false rule that ARIA is always preferred over native HTML. `useId` is appropriate for stable accessibility relationships within a component but not for list keys.

The exam runtime must be usable at 200% zoom and on a narrow mobile viewport; expose question text and options to assistive technology in logical reading order; programmatically associate each question with its radio group; provide visible keyboard focus; support Tab, Shift+Tab, arrow-key radio navigation and activation without a pointer; announce validation/submission errors; preserve answers across navigation and recovery; and never encode correctness by color alone. Code blocks need text, horizontal overflow without page breakage, sufficient contrast, and no image-only source.

## React 19.2 factual pitfalls checklist

The reviewer must explicitly look for these common but consequential errors:

- Hooks normally cannot be called in conditions, loops, callbacks, async functions or after early returns. The stable `use` API is a documented exception that may be called conditionally and in loops, but still not in `try`/`catch`.
- State is a snapshot for a render. Setting state does not mutate the already-running handler's captured value; updater functions are needed when the next value depends on queued prior state.
- State is associated with a component's position in the rendered tree. Changing a `key` can intentionally reset state. Keys must be stable among siblings and must not be generated during rendering.
- Components and Hooks must be pure. Props and state are immutable snapshots; side effects do not belong in render.
- Effects synchronize with external systems. Derived render data and user-event logic usually do not need an Effect. Cleanup must mirror setup, and development Strict Mode intentionally performs extra render/effect/ref checks.
- An Effect Event sees the latest props/state, is omitted from Effect dependencies, and may only be declared in the same component or Hook as its Effect. It is not a general lint-suppression mechanism.
- A controlled text input uses `value`; a controlled checkbox/radio uses `checked`. A controlled input needs a synchronous `onChange` update and must not switch between controlled and uncontrolled during its lifetime.
- A button inside a form defaults to submission unless its type is set. When a function is supplied as a React form `action`/`formAction`, submission uses POST; successful uncontrolled fields reset.
- In React 19, `ref` is available as a prop to function components. `forwardRef` remains a legacy API in the 19.2 reference; do not claim it has already been removed.
- `memo`, `useMemo` and `useCallback` are performance tools, not semantic guarantees. Code must remain correct without memoization. React Compiler coverage must not be assumed unless compilation is stated.
- A Transition cannot be used to control a text input. Async state updates after an `await` may need another `startTransition` under current documented behavior.
- Suspense activates only for Suspense-enabled sources. Data fetched inside an Effect or event handler does not automatically activate a boundary.
- `<Activity mode="hidden">` hides children, unmounts their Effects, defers updates and preserves state; it is inaccurate to describe this as ordinary conditional unmounting.
- Strict Mode's extra render, Effect and ref-callback checks are development-only; they do not mean production always renders twice.
- `act` should be awaited. Prefer assertions on user-visible behavior; implementation-detail snapshots alone are not evidence that interaction works.
- `createRoot` is for client roots; `hydrateRoot` attaches React to server-rendered HTML. Hydration expects equivalent server/client output, and `suppressHydrationWarning` is a narrow escape hatch rather than a repair strategy.
- `'use client'` defines a server/client module boundary; it does not mean every descendant module must repeat the directive. `'use server'` marks Server Functions, not generic Server Components.
- `useId`'s default prefix changed in 19.2. Tests or CSS must not depend on its internal generated string.
- Node Web Streams became supported for SSR in 19.2, but the official release guidance still recommends Node Stream APIs in Node for performance and compression reasons.

## Runtime and publication acceptance

The bank may be activated and the assessment published only after all of the following are true:

- exactly one versioned, rights-verified source manifest and one private certification bank are reconciled;
- all 80 intended questions import with provenance, content hashes, explicit author identity, matching syllabus evidence and zero duplicate/rejected rows;
- all 80 exact versions are active and approved by a distinct attributable reviewer with timestamps and matching review attestations;
- the bank has the eight exact React topics above, 10 eligible questions in each, and no retired/generic topic in the blueprint;
- the bank is active and the course uses the eight-row, 16-question blueprint;
- the guarded readiness and deep content-acceptance report return zero blockers;
- answer positions are balanced across the pack, all explanations meet the reasoned-explanation standard, and automated tests cover manifest/JSONL reproducibility;
- public catalogue/detail/navigation requests expose the certification only after publication;
- a real candidate session returns exactly 16 unique, balanced questions without `correctAnswer`, explanation, answer metadata, provenance, reviewer data or other answer leakage;
- keyboard/mobile/zoom checks pass, answers survive navigation/reload recovery, timer and submission behavior are correct, scoring uses the configured passing score, and pending/retired questions never appear;
- withdrawal or retirement of any approved pool item fail-closes or unpublishes dependent live assessments as designed.

Publishing through direct SQL or an unguarded bulk mutation is not acceptable. Use the guarded assessment mutation only after the acceptance report is clean, then record the production course ID, bank ID, blueprint revision, source/import run, pack digest, reviewer, publisher, release commit and smoke-test result.

## Exact-item audit — 2026-07-19

The independent reviewer read all 80 authored rows in
`octamy-react-application-engineering-skills-v1.jsonl`: every stem, four
options, key, explanation, objective, difficulty, topic and source locator.
The focused test passes (2/2), the pool has 10 rows in each authored topic,
each topic now has 3 easy/5 medium/2 hard labels, and answer positions are
balanced 20/20/20/20. These structural results do not constitute approval.

### Exact item defects

| Item | Severity | Finding | Required correction |
| --- | --- | --- | --- |
| `raes-v1-058` | Corrected in candidate | The first candidate said Hooks categorically cannot be conditional, contradicting React 19.2's documented conditional/loop exception for `use`. | The current candidate correctly narrows the stem to `useState` and names the `use` exception in the explanation. Re-review the regenerated hash; no approval may attach to the superseded wording. |
| `raes-v1-080` | Blocker | The keyed behavior-focused choice is reasonable, but the cited `act` reference establishes update flushing, not the comparative claim that this is the “strongest confidence” test. The distractors are also so implausible that the item does not meet its `hard` label. | Replace with a directly sourced, objective React testing scenario (for example, awaited `act` behavior and an observable post-interaction assertion), or provide an authoritative source that directly establishes the testing principle. Write competing plausible approaches and reassess difficulty. |

No additional wrong answer key was found in rows 001–080. That is not a
release approval because the following pack-level defects affect the blueprint
and the validity of its difficulty claims.

### Pack-level blockers

1. **Authored topics do not substantiate the shell's advertised coverage.**
   The combined “Testing, accessibility, and application quality” pool has two
   `useId` items but no item on semantic native controls, programmatic labels,
   keyboard operation, focus after UI changes, accessible errors, or
   non-colour status. It has one hydration item but no coherent application
   boundary/SSR domain. Meanwhile state is split across two full 10-item
   topics, making the form disproportionately state-heavy. At minimum replace
   duplicated rows `raes-v1-074` (list-key ground already tested by 005/006),
   `raes-v1-078` (Rules of Hooks already tested by 058), and `raes-v1-079`
   (Effect dependencies already tested by 043/050), plus defective 080, with:
   one native-label/accessibility item, one keyboard/semantic-control item, one
   client/server or SSR boundary item, and one directly sourced interaction
   testing item. Use React DOM and W3C/WAI primary sources and update the test
   allowlist accordingly. If these four replacements are not made, narrow the
   public title/description so it does not claim accessibility and frontend
   architecture coverage.
2. **Hard labels are largely quota labels rather than hard reasoning.**
   Items 009, 016, 019, 028, 029, 040, 050, 055, 070, 076 and 080 ask a single
   direct rule or API-purpose recall question and have mostly non-competing
   distractors. They do not satisfy this rubric's hard definition. Rewrite at
   least the two hard rows in every topic as concrete code/scenario reasoning
   with plausible misconception-based distractors; do not merely relabel rows
   to preserve a 3/5/2 count.
3. **Reproducibility was not demonstrated by the focused test.** The test
   imports and audits the generator but does not compare regenerated JSONL
   bytes with the committed JSONL. During review, the committed JSONL initially
   had difficulty labels different from the generator while the test still
   passed. Add a generator-versus-artifact equality assertion (or equivalent
   digest assertion) so a stale release artifact cannot pass.
4. **The blueprint must use the authored exact topic slugs if this design is
   retained.** They differ from the pre-authoring proposal. Do not map any
   inherited generic bank topics. The production mapping must draw two mixed
   items from each of the final eight reviewed topics only.

## Reviewer disposition

**Blocked; 0 of 80 approved.** All 80 rows received a first substantive read,
and 79 have no detected answer-key error in their current wording. Item 058's
wording correction is acceptable subject to regenerated-hash review. Item 080,
coverage duplication/omissions, weak hard-item construction, and the missing
artifact equality test remain release blockers. This report authorizes no
import, bank activation, item approval, blueprint mutation, or publication.

## Final-candidate re-review — 2026-07-19

Candidate digest reviewed:
`1b0359ec6dae9410551822e1b49d98141cdc5f02cceeacd6c4f71da1f5b30dc0`.

The reviewer re-read the final versions of 009, 016, 019, 028, 029, 040, 050,
055, 058, 070, 074, 076, 078, 079 and 080 against their cited sources and
checked their keys, explanations and distractors. Those corrections are
factually acceptable. In particular:

- 058 correctly limits the ordinary call-order rule to `useState` and names
  the stable `use` exception;
- 074 and 078 add directly sourced label association and native keyboard
  semantics;
- 075 and 079 together provide hydration and server/client boundary coverage;
- 080 now tests the documented awaited `act` workflow instead of making an
  unsupported comparative testing claim;
- the focused suite now includes exact generated-versus-committed JSONL
  equality and passes 3/3.

The eighth authored domain now has a defensible combined scope: two testing
items, three accessibility items (including `useId`), two application-boundary
items, and Strict Mode/Error Boundary quality coverage. The coverage and
artifact-reproducibility blockers are resolved.

### Remaining exact defects

The pool is not yet approval-ready because four retained rows still use a
`hard` label for direct single-rule recall with three non-competing
distractors:

| Item | Finding | Required correction |
| --- | --- | --- |
| `raes-v1-039` | Asking what happens when a context provider value changes is foundation-level recall; all distractors are plainly impossible. | Replace with a code/scenario problem that requires reasoning about provider identity, nearest-provider scope or unnecessary consumer renders, with plausible alternatives. |
| `raes-v1-047` | The stem already states the out-of-order response race and the only relevant option repeats it; caching, prop rendering and JSON parsing do not compete. | Supply a concrete two-request timeline or cleanup implementation and ask which result/repair is correct; include plausible abort/ignore/dependency mistakes. |
| `raes-v1-059` | Fresh object identity causing reconnection is stated in the stem and only primitive arguments are credible; globals, render-time connection and lint suppression are giveaway distractors. | Require API/dependency reasoning across at least two sound-looking designs, such as primitive arguments versus caller memoization and internal Effect dependencies. |
| `raes-v1-066` | The item asks a directly documented Transition restriction and its distractors are unrelated inventions. | Use a controlled-input plus slow-results code scenario and require separating urgent input state from transitioned/deferred work, with plausible placement alternatives. |

Item 006 remains acceptable as hard identity/reordering reasoning, although its
distractors should be strengthened in a future refresh. No wrong answer key or
unsupported explanation was found elsewhere in the current 80-row candidate.

### Current disposition

**Blocked; 0 of 80 approved.** Exact-version review notes for production must
not be issued for the full pool while rows 039, 047, 059 and 066 remain below
the declared difficulty and distractor standard. After those four rows are
rewritten, regenerate the pack, rerun the 3-test suite, provide the new digest,
and re-review the four new hashes. Production remains untouched.

## Final exact-hash approval gate — 2026-07-19

This section supersedes the earlier candidate dispositions.

- Generator/canonical pack digest:
  `bbf7b21b8186ba5c06a6218fa70cfa8a88b7a3879b122346f0d4de0a42d192dc`
- Committed JSONL SHA-256:
  `93e3a7848ef09b948ddaa7056797c9290dc865765cb38358a6e200739c34604a`
- Focused test result: 3/3 passed, including exact generated-versus-committed
  JSONL equality.
- Structural audit: 80 rows, 80 unique prompts, 80 unique semantic prompts,
  80 unique content records, 10 items per topic, 3 easy/5 medium/2 hard per
  topic, and answer positions 20/20/20/20.

The final exact versions of 039, 047, 059 and 066 were independently solved
and checked against their cited primary sources:

- 039 correctly combines `Object.is` context-value comparison, context-driven
  consumer rendering, `memo` limitations, and targeted `useCallback` plus
  `useMemo` stabilization.
- 047 correctly retains `query` as a reactive dependency and invalidates or
  aborts the prior request during cleanup so an out-of-order response cannot
  commit stale state.
- 059 correctly separates primitive connection dependencies from the latest
  non-reactive callback through an Effect Event.
- 066 correctly keeps controlled-input state urgent and defers the expensive
  result consumer with `useDeferredValue`.

Each now requires multi-constraint code or lifecycle reasoning, and each set
of distractors represents a recognizable but incorrect repair. No factual,
ambiguity, key, explanation, source, topic, difficulty or distractor defect
remains in the final 80-item candidate.

### Production approval-note strategy

Approval remains per imported database question, exact content hash and
version. For every row, join the import provenance `sourceRecordId` to the
row's `objective`, `provenance.sourceLocator`, and
`metadata.releaseEvidence.answerValidation.reference`. The reviewer note must
be item-specific and use this form:

```text
<sourceRecordId> — <objective> independently solved and checked against
<sourceLocator>; keyed option, explanation, and all three distractors confirmed
for this exact imported content version.
```

Examples:

```text
raes-v1-039 — Diagnose context value identity churn independently solved and
checked against https://react.dev/reference/react/useContext; keyed option,
explanation, and all three distractors confirmed for this exact imported
content version.

raes-v1-047 — Prevent an out-of-order Effect race independently solved and
checked against https://react.dev/learn/synchronizing-with-effects; keyed
option, explanation, and all three distractors confirmed for this exact
imported content version.
```

Apply the same source-bound form to all source records `raes-v1-001` through
`raes-v1-080`; do not use one batch note or a note lacking the individual
source record and reference. The review endpoint must additionally attest the
database content hash, expected version, reviewer identity and timestamp. If
any imported stem, option, key, explanation, evidence, objective, source,
topic or difficulty differs from this JSONL SHA, stop and re-review that new
version.

### Final disposition

**Approval-ready: 80 of 80 exact candidate items passed independent content
review.** This is authorization to proceed through rights registration,
validation-only import, provenance reconciliation, individual exact-version
approval, guarded bank activation, the eight-topic blueprint and guarded
publication acceptance. It is not evidence that those production actions have
already occurred. This reviewer did not mutate production.
