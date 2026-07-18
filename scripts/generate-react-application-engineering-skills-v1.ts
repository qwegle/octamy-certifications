#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { finished } from "node:stream/promises";
import { normalizeQuestionPackItem } from "./lib/question-pack-contract";

const ASSESSMENT_SLUG = "react-application-engineering-skills";
const BANK_SLUG = "react-application-engineering-skills-bank-v1";
const SYLLABUS = "OCT-RAES-2026.1 (React 19.2; react.dev snapshot 2026-07-19)";

const REFERENCES = {
  components: "https://react.dev/learn/your-first-component",
  jsx: "https://react.dev/learn/writing-markup-with-jsx",
  rendering: "https://react.dev/learn/render-and-commit",
  conditional: "https://react.dev/learn/conditional-rendering",
  lists: "https://react.dev/learn/rendering-lists",
  purity: "https://react.dev/learn/keeping-components-pure",
  props: "https://react.dev/learn/passing-props-to-a-component",
  state: "https://react.dev/learn/state-a-components-memory",
  useState: "https://react.dev/reference/react/useState",
  sharing: "https://react.dev/learn/sharing-state-between-components",
  stateStructure: "https://react.dev/learn/choosing-the-state-structure",
  resetState: "https://react.dev/learn/preserving-and-resetting-state",
  stateSnapshot: "https://react.dev/learn/state-as-a-snapshot",
  queueing: "https://react.dev/learn/queueing-a-series-of-state-updates",
  events: "https://react.dev/learn/responding-to-events",
  forms: "https://react.dev/reference/react-dom/components/input",
  button: "https://react.dev/reference/react-dom/components/button",
  formAction: "https://react.dev/reference/react-dom/components/form",
  actionState: "https://react.dev/reference/react/useActionState",
  optimistic: "https://react.dev/reference/react/useOptimistic",
  objects: "https://react.dev/learn/updating-objects-in-state",
  arrays: "https://react.dev/learn/updating-arrays-in-state",
  reducer: "https://react.dev/learn/extracting-state-logic-into-a-reducer",
  context: "https://react.dev/learn/passing-data-deeply-with-context",
  useContext: "https://react.dev/reference/react/useContext",
  reducerContext: "https://react.dev/learn/scaling-up-with-reducer-and-context",
  effects: "https://react.dev/learn/synchronizing-with-effects",
  effectEvents: "https://react.dev/learn/separating-events-from-effects",
  useEffectEvent: "https://react.dev/reference/react/useEffectEvent",
  dependencies: "https://react.dev/learn/removing-effect-dependencies",
  lifecycle: "https://react.dev/learn/lifecycle-of-reactive-effects",
  youMightNotNeed: "https://react.dev/learn/you-might-not-need-an-effect",
  refs: "https://react.dev/learn/referencing-values-with-refs",
  domRefs: "https://react.dev/learn/manipulating-the-dom-with-refs",
  imperativeHandle: "https://react.dev/reference/react/useImperativeHandle",
  customHooks: "https://react.dev/learn/reusing-logic-with-custom-hooks",
  rulesHooks: "https://react.dev/reference/rules/rules-of-hooks",
  memo: "https://react.dev/reference/react/memo",
  useMemo: "https://react.dev/reference/react/useMemo",
  useCallback: "https://react.dev/reference/react/useCallback",
  transition: "https://react.dev/reference/react/useTransition",
  deferred: "https://react.dev/reference/react/useDeferredValue",
  suspense: "https://react.dev/reference/react/Suspense",
  profiler: "https://react.dev/reference/react/Profiler",
  lazy: "https://react.dev/reference/react/lazy",
  strictMode: "https://react.dev/reference/react/StrictMode",
  act: "https://react.dev/reference/react/act",
  useId: "https://react.dev/reference/react/useId",
  errors: "https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary",
  hydrate: "https://react.dev/reference/react-dom/client/hydrateRoot",
  useClient: "https://react.dev/reference/rsc/use-client",
  waiLabels: "https://www.w3.org/WAI/tutorials/forms/labels/",
  waiKeyboard: "https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/",
  eslintHooks: "https://react.dev/reference/eslint-plugin-react-hooks",
} as const;

const TOPICS = {
  "components-jsx-rendering": { name: "Components, JSX, and rendering", code: "RAES-CR" },
  "props-state-data-flow": { name: "Props, state, and data flow", code: "RAES-PS" },
  "events-forms": { name: "Events and forms", code: "RAES-EF" },
  "immutable-state-reducers-context": { name: "Immutable state, reducers, and context", code: "RAES-IC" },
  "effects-external-systems": { name: "Effects and external systems", code: "RAES-ES" },
  "refs-custom-hooks": { name: "Refs and custom Hooks", code: "RAES-RH" },
  "performance-concurrency": { name: "Performance and concurrency", code: "RAES-PC" },
  "testing-accessibility-application-quality": { name: "Testing, accessibility, and application quality", code: "RAES-TQ" },
} as const;

type TopicKey = keyof typeof TOPICS;
type Difficulty = "easy" | "medium" | "hard";
type Draft = {
  topic: TopicKey;
  question: string;
  correct: string;
  distractors: [string, string, string];
  explanation: string;
  reference: string;
  objective: string;
  difficulty: Difficulty;
};

const q = (
  topic: TopicKey,
  question: string,
  correct: string,
  distractors: [string, string, string],
  explanation: string,
  reference: string,
  objective: string,
  difficulty: Difficulty = "medium",
): Draft => ({ topic, question, correct, distractors, explanation, reference, objective, difficulty });

const DRAFTS: Draft[] = [
  // Components, JSX, and rendering
  q("components-jsx-rendering", "Which declaration is a valid React function component?", "`function Profile() { return <img alt=\"Profile\" />; }`", ["`function profile() { emit <img />; }`", "`component Profile = <img />`", "`function Profile() { render <img />; }`"], "A function component is a capitalized JavaScript function that returns renderable JSX; `return` supplies its output.", REFERENCES.components, "Recognize a function component", "easy"),
  q("components-jsx-rendering", "Why must adjacent JSX siblings be wrapped in a parent element or Fragment?", "A component must return a single JSX tree root", ["Browsers cannot display sibling DOM nodes", "Fragments make every child globally unique", "React permits only one child per element"], "JSX is transformed into JavaScript expressions, so one returned expression must represent the tree; a Fragment groups siblings without adding a DOM node.", REFERENCES.jsx, "Structure a JSX return value", "easy"),
  q("components-jsx-rendering", "In JSX, how should a component set a CSS class?", "Use the `className` prop", ["Use a `cssClass` attribute", "Use `class` only because JSX is HTML", "Call `setClass` during rendering"], "React DOM uses the `className` prop for an element's CSS class, matching the DOM property name.", REFERENCES.jsx, "Apply JSX attribute conventions", "easy"),
  q("components-jsx-rendering", "What is the safest way to render either `<AdminPanel />` or `<LoginForm />` from an `isLoggedIn` boolean?", "Use a JavaScript conditional or ternary in the component's returned JSX", ["Call both components and delete one DOM node afterward", "Mutate `isLoggedIn` during rendering", "Put an `if` statement directly inside a JSX tag"], "React conditional rendering uses ordinary JavaScript control flow to choose the render tree without imperative DOM mutation.", REFERENCES.conditional, "Render conditional branches", "medium"),
  q("components-jsx-rendering", "Why does each item produced by `items.map(...)` need a stable `key`?", "It lets React match items between renders when the list changes", ["It exposes the item as a global variable", "It guarantees that the item never re-renders", "It becomes the child's `key` prop automatically"], "Keys identify siblings across insertions, deletions, and reordering so React can preserve the correct component identity.", REFERENCES.lists, "Choose stable list keys", "medium"),
  q("components-jsx-rendering", "A sortable list currently uses the array index as each key. Why can that cause incorrect retained state after reordering?", "The same index can refer to a different logical item after the order changes", ["Indexes are illegal JavaScript values in JSX", "React sorts all numeric keys alphabetically", "An index key disables event handlers"], "Keys define component identity among siblings; position-based keys move identity to different records when order changes.", REFERENCES.lists, "Diagnose unstable list identity", "hard"),
  q("components-jsx-rendering", "What happens during React's commit phase?", "React applies the calculated minimal DOM changes", ["React downloads every component module", "React runs the component only to initialize props", "React serializes state into localStorage"], "After rendering calculates the desired UI, the commit phase updates the DOM to reflect the differences.", REFERENCES.rendering, "Distinguish render and commit", "medium"),
  q("components-jsx-rendering", "Why must a React component be pure with respect to its inputs?", "The same props, state, and context should produce the same JSX without mutating external values", ["Purity prevents the component from accepting props", "Pure components may never call Hooks", "Purity means returning only one DOM element"], "React may render components more than once; deterministic, side-effect-free rendering makes that safe and predictable.", REFERENCES.purity, "Apply component purity", "medium"),
  q("components-jsx-rendering", "Under `<StrictMode>`, `StoryTray` runs `stories.push({ id: 'create', label: 'Create Story' })` on the `stories` prop during render. In development the extra row appears twice, and the parent later sees its array changed. Which repair addresses both symptoms?", "Render a new array such as `[...stories, createStory]` without mutating the prop", ["Keep `push`, but assign each rendered row a stable key", "Move the same `push` into an Effect with `[stories]` dependencies", "Disable Strict Mode so render executes only once"], "The component mutates a prop and therefore is not pure. Copying the array makes repeated renders idempotent and leaves the parent's input untouched; keys or moving the mutation do not repair ownership.", REFERENCES.purity, "Diagnose repeated impure rendering", "hard"),
  q("components-jsx-rendering", "Which expression correctly renders a JavaScript variable named `fullName` inside an `<h1>`?", "`<h1>{fullName}</h1>`", ["`<h1>(fullName)</h1>`", "`<h1>${fullName}</h1>`", "`<h1>[fullName]</h1>`"], "Curly braces open a JavaScript expression within JSX, allowing the variable's value to become child content.", REFERENCES.jsx, "Embed expressions in JSX", "medium"),

  // Props, state, and data flow
  q("props-state-data-flow", "What is the correct mental model for props received by a component?", "They are read-only inputs supplied by the parent", ["They are private mutable fields owned by the child", "They are global variables shared by every component", "They are DOM attributes that React never reads"], "Props are snapshots of parent-provided input; a child requests change through callbacks rather than mutating them.", REFERENCES.props, "Treat props as immutable inputs", "easy"),
  q("props-state-data-flow", "A counter calls `setCount(count + 1)` and then immediately logs `count` in the same event handler. Why can the log show the old value?", "State behaves as a snapshot for that render; the setter requests a later render", ["The setter updates only localStorage", "React state is always one event behind", "Logging cancels the state update"], "Calling a setter queues a render but does not rewrite the state variable captured by the currently running handler.", REFERENCES.stateSnapshot, "Reason about state snapshots", "medium"),
  q("props-state-data-flow", "When should data be stored in state rather than a regular local variable?", "When it must persist between renders and changing it should update the UI", ["Whenever its value is a string", "Only when it comes from a server", "Whenever it is used once during rendering"], "State supplies both persistence across renders and a setter that schedules a new render.", REFERENCES.state, "Choose state appropriately", "easy"),
  q("props-state-data-flow", "Two sibling components must stay synchronized to one selected item. What design follows React's recommended data flow?", "Move the selected state to their closest common parent and pass value and handlers down", ["Duplicate the state in both siblings and poll for changes", "Mutate one sibling's props from the other", "Store the selection in a module variable during render"], "Lifting state establishes one source of truth that the parent distributes to both controlled children.", REFERENCES.sharing, "Lift shared state", "medium"),
  q("props-state-data-flow", "Why is storing `fullName` in state usually unnecessary when it is always `firstName + ' ' + lastName`?", "It is derivable during rendering and duplicated state can become inconsistent", ["String state is unsupported", "Computed text must be placed in a ref", "Derived values cannot be displayed in JSX"], "Values fully determined by current props or state should ordinarily be calculated during render instead of synchronized separately.", REFERENCES.stateStructure, "Avoid redundant state", "medium"),
  q("props-state-data-flow", "Three sibling accordion panels must enforce that at most one is open, and clicking the open panel must close it. Which parent design encodes both requirements without duplicated state?", "Store `activeId: string | null` and pass each panel `isActive` plus a callback that toggles that ID or null", ["Store one parent boolean and pass the same `isActive` value to every panel", "Let every panel own `isActive` and ask siblings to close themselves through refs", "Store an array of active IDs and remove duplicates after each render"], "A nullable active ID is one source of truth: an ID selects exactly one sibling and null selects none. Controlled children report intent while the parent enforces the invariant.", REFERENCES.sharing, "Model mutually exclusive controlled state", "hard"),
  q("props-state-data-flow", "A handler must increment a score three times in one event. Which calls correctly compose the queued updates?", "Call `setScore(s => s + 1)` three times", ["Call `setScore(score + 1)` three times", "Mutate `score++` three times without a setter", "Call `setScore(3)` and then `setScore(score)`"], "Updater functions receive the result of the prior queued updater, whereas repeated snapshot-based values all calculate from the same render.", REFERENCES.queueing, "Queue dependent state updates", "medium"),
  q("props-state-data-flow", "What is the purpose of the initializer-function form `useState(createInitialTodos)`?", "React calls it during initialization instead of recomputing the initializer expression on every render", ["It reruns whenever a todo changes", "It makes the state immutable", "It converts the state into context"], "Passing the function itself lets React use it as an initializer, avoiding repeated work from calling it while rendering.", REFERENCES.useState, "Use lazy state initialization", "medium"),
  q("props-state-data-flow", "`ProfileEditor` initializes local `draftName` from `user.name`. The draft must survive unrelated parent renders, but switching from user 42 to user 77 must discard it and initialize user 77's name. Which composition achieves that without an Effect that mirrors every prop change?", "Render `<ProfileEditor key={user.id} user={user} />` and initialize the draft inside the editor", ["Remove the key and call `setDraftName(user.name)` during every render", "Use the same constant key for every user and mutate the draft variable on switch", "Store `user.name` directly in a ref and render `ref.current` as the controlled value"], "React associates state with tree position and key. A user-specific key preserves the draft for the same user across parent renders but intentionally resets the editor when identity changes.", REFERENCES.resetState, "Reset local state at an identity boundary", "hard"),
  q("props-state-data-flow", "A `Clock` component receives `color` and `time`. What is the idiomatic way to read them?", "Destructure them from the component's props parameter", ["Read them from `window.props`", "Call `useState` once for each prop", "Access a global `Clock.props` object"], "Function components receive one props object, which may be destructured in the parameter list without copying values into state.", REFERENCES.props, "Consume component props", "easy"),

  // Events and forms
  q("events-forms", "Which JSX passes a click handler without invoking it during rendering?", "`<button onClick={handleClick}>Save</button>`", ["`<button onClick={handleClick()}>Save</button>`", "`<button click=\"handleClick\">Save</button>`", "`<button onClick=\"handleClick()\">Save</button>`"], "Event props receive a function value; calling the function in JSX supplies its return value and runs it while rendering.", REFERENCES.events, "Attach event handlers", "easy"),
  q("events-forms", "What does `event.stopPropagation()` do in a nested click handler?", "It prevents that event from continuing to ancestor handlers", ["It prevents the browser's default action", "It removes every listener from the target", "It cancels all later React renders"], "Stopping propagation controls event travel through ancestors; preventing the browser's default behavior is a separate operation.", REFERENCES.events, "Control event propagation", "easy"),
  q("events-forms", "A form submission should stay on the current page while React handles the data. What should the submit handler call?", "`event.preventDefault()`", ["`event.stopImmediateRender()`", "`event.persistDefault()`", "`event.cancelState()`"], "Preventing the default stops the browser's built-in navigation/reload behavior without inherently stopping event propagation.", REFERENCES.events, "Prevent a browser default", "medium"),
  q("events-forms", "What makes a text input controlled?", "Its `value` comes from state and `onChange` synchronously updates that state", ["It has a `defaultValue` and no handler", "It is read through a ref only after submit", "Its value is mutated directly through the DOM"], "A controlled input's displayed value is driven by React, with an onChange handler maintaining the backing state.", REFERENCES.forms, "Implement a controlled input", "medium"),
  q("events-forms", "Why does `<input value={name}>` without an `onChange` handler appear read-only?", "React continually controls the displayed value but no handler updates its source", ["The `value` prop works only for numeric inputs", "React disables inputs nested in components", "The browser requires `defaultValue` as well"], "Once value controls an input, user edits must synchronously update that value through onChange or the display reverts.", REFERENCES.forms, "Diagnose a locked controlled input", "medium"),
  q("events-forms", "When is `defaultValue` appropriate for an input?", "When providing an initial value while leaving subsequent input state to the DOM", ["When React state must control every keystroke", "When changing the prop must always overwrite user input", "When the input must be permanently read-only"], "defaultValue initializes an uncontrolled input; it does not continuously control the current value after mounting.", REFERENCES.forms, "Choose an uncontrolled input", "medium"),
  q("events-forms", "What does passing a function to a React `<form action={save}>` provide?", "React calls the function with the submitted `FormData`", ["It converts the form into a GET link", "It invokes the function during every render", "It bypasses browser form semantics entirely"], "A function action receives FormData on submission and supports React's form-action workflow.", REFERENCES.formAction, "Use form actions", "medium"),
  q("events-forms", "A form changes from `<form action={save}>` to `const [state, formAction, pending] = useActionState(save, initialState)`. Its old `save(formData)` now reads `formData.get` as undefined. Which change preserves result state and pending UI?", "Change it to `save(previousState, formData)`, submit with `formAction`, and render `pending` while it runs", ["Keep `save(formData)` but call `formAction(initialState, formData)` manually from render", "Change it to `save(formData, previousState)` and read pending from the returned state", "Keep the signature and wrap `save` in `useOptimistic` instead of using the returned action"], "useActionState adds the previous action state as the first argument, so submitted FormData becomes the second. Its returned action and pending flag drive submission and pending feedback.", REFERENCES.actionState, "Trace a useActionState form signature", "hard"),
  q("events-forms", "A comments form calls `addOptimistic(text)` inside an Action, then awaits `saveComment(text)`. The server rejects the request, and the base `comments` state is updated only on success. What behavior and implementation are correct?", "Show the optimistic comment while the Action is pending, then let it disappear on failure because the base state never committed it; keep the optimistic update function pure", ["Keep the failed optimistic comment permanently because optimistic state replaces the base state", "Mutate the base comments array before awaiting so rollback can detect the same object", "Call `addOptimistic` during render and use an Effect to submit the comment afterward"], "useOptimistic derives temporary state during the Action. If the authoritative base state is not updated after failure, React returns to that base; mutating base state or dispatching during render breaks the model.", REFERENCES.optimistic, "Reason about optimistic failure reconciliation", "hard"),
  q("events-forms", "A button inside a form performs a secondary action and must not submit. What markup is appropriate?", "Set `type=\"button\"` on the button", ["Set `action=\"none\"`", "Remove its click handler", "Set `method=\"button\"` on the form"], "Buttons inside forms submit by default, so an explicitly non-submit button uses type=\"button\".", REFERENCES.button, "Prevent accidental form submission", "easy"),

  // Immutable state, reducers, and context
  q("immutable-state-reducers-context", "Why is `person.name = nextName; setPerson(person)` an incorrect state update?", "It mutates the existing state object and reuses its identity", ["React state objects cannot contain strings", "The setter accepts only updater functions", "Object state must always be stored in context"], "State should be treated as read-only; creating a new object gives React a new snapshot and preserves prior render state.", REFERENCES.objects, "Update object state immutably", "easy"),
  q("immutable-state-reducers-context", "Which update changes `person.artwork.city` while retaining the other nested fields?", "`setPerson({ ...person, artwork: { ...person.artwork, city: nextCity } })`", ["`setPerson({ city: nextCity })`", "`person.artwork.city = nextCity` only", "`setPerson({ ...person.artwork, city: nextCity })`"], "Each object along the changed path must be copied so the resulting root and nested object have new identities without losing siblings.", REFERENCES.objects, "Copy nested state correctly", "medium"),
  q("immutable-state-reducers-context", "Which expression immutably appends `newItem` to array state?", "`setItems(items => [...items, newItem])`", ["`setItems(items.push(newItem))`", "`items[items.length] = newItem`", "`setItems(items.splice(0, 0, newItem))`"], "Array spread creates a new array containing the prior elements plus the new item; push and splice mutate the original.", REFERENCES.arrays, "Append immutable array state", "easy"),
  q("immutable-state-reducers-context", "Which update removes the item whose ID equals `removedId`?", "`setItems(items => items.filter(item => item.id !== removedId))`", ["`setItems(items.delete(removedId))`", "`items.splice(removedId, 1)` without a setter", "`setItems(items.filter(item => item.id === removedId))`"], "filter returns a new array and the inequality predicate retains every record except the selected ID.", REFERENCES.arrays, "Remove an array item immutably", "easy"),
  q("immutable-state-reducers-context", "When is a reducer especially useful?", "When many event handlers perform related updates to complex state", ["When a component has no state transitions", "When state must be mutated directly", "Only when data comes from context"], "A reducer centralizes transition logic as actions and a pure state-to-next-state function.", REFERENCES.reducer, "Choose reducer-based state", "medium"),
  q("immutable-state-reducers-context", "What must a well-formed reducer do?", "Return the next state without mutating the current state", ["Perform network requests for every action", "Call Hooks inside each switch branch", "Read component-local variables that are not arguments"], "Reducers run during rendering and should be pure, calculating new state from the current state and action.", REFERENCES.reducer, "Implement a pure reducer", "medium"),
  q("immutable-state-reducers-context", "What does `dispatch({ type: 'added', ... })` do?", "It queues a state update by passing that action to the reducer", ["It directly mutates the reducer's state parameter", "It sends a browser DOM event", "It synchronously replaces every context value"], "Dispatch describes what happened; React invokes the reducer with the current state and action to obtain the next state.", REFERENCES.reducer, "Explain reducer dispatch", "medium"),
  q("immutable-state-reducers-context", "What is context best suited to avoid?", "Passing the same data through many intermediate components that do not need it", ["Rendering provider children", "Using props for local component configuration", "Keeping state close to where it is used"], "Context lets descendants read a provided value without every intervening component forwarding that value as a prop.", REFERENCES.context, "Recognize context's purpose", "medium"),
  q("immutable-state-reducers-context", "`AuthProvider` renders `<AuthContext value={{ currentUser, login }}>`, while `login` is recreated on every provider render. Updating an unrelated clock state re-renders the provider, and a `memo`-wrapped `Profile` that reads this context also re-renders although `currentUser` is unchanged. Which explanation and targeted repair are correct?", "The provider supplies a different object by `Object.is`; stabilize `login` with `useCallback` and the context object with `useMemo` when profiling shows this matters", ["`memo` compares context deeply, so the Profile rerender proves that its own props changed", "Context consumers rerender only when `currentUser` mutates in place; mutate it before providing the same object", "Move the clock into the context object so every consumer receives all provider state explicitly"], "React compares the previous and next context values with Object.is, and memo does not block fresh context values. Stabilizing the function and containing object can avoid an unrelated identity change without mutating state.", REFERENCES.useContext, "Diagnose context value identity churn", "hard"),
  q("immutable-state-reducers-context", "A task screen has deeply nested readers and add/delete buttons. The team wants one auditable transition function, no prop drilling, and no direct state mutation. Which architecture satisfies all three constraints?", "Use a pure `tasksReducer`, provide current tasks and `dispatch` through context, and have descendants dispatch descriptive actions", ["Put the mutable tasks array in context and let every descendant push or splice it directly", "Give each descendant a separate reducer and synchronize their task copies in Effects", "Keep one reducer at the root but expose setters through module globals instead of a provider"], "The reducer centralizes immutable transitions, while context transports state and dispatch through the tree. Mutated, duplicated, or global state loses the single controlled transition path.", REFERENCES.reducerContext, "Design reducer and context state ownership", "hard"),

  // Effects and external systems
  q("effects-external-systems", "What is an Effect primarily for?", "Synchronizing a component with an external system after rendering", ["Calculating ordinary derived JSX values", "Handling every user click", "Declaring component props"], "Effects connect React state to systems outside React, such as network connections, browser APIs, or third-party widgets.", REFERENCES.effects, "Identify an Effect use case", "easy"),
  q("effects-external-systems", "A chat Effect opens a connection for `roomId`. What should its cleanup function do?", "Disconnect the connection created by that Effect run", ["Set `roomId` to null during render", "Reload the page", "Remove the component's props"], "Cleanup must undo the setup so changing dependencies or unmounting does not leave stale external connections.", REFERENCES.effects, "Clean up an external subscription", "easy"),
  q("effects-external-systems", "Why should `roomId` appear in the dependency list of an Effect that reads it?", "It is a reactive value, so the synchronization must rerun when it changes", ["Dependencies make the value globally available", "React cannot read props outside dependency arrays", "Including it prevents the Effect from ever running"], "Every reactive value used by the Effect belongs in its dependency list unless the code is restructured so it is no longer reactive.", REFERENCES.dependencies, "Declare Effect dependencies", "medium"),
  q("effects-external-systems", "An Effect derives `fullName` from `firstName` and `lastName` by setting state. What is the better design?", "Calculate `fullName` directly during rendering", ["Move the same setter into a second Effect", "Store the names in refs instead", "Mutate the DOM text manually"], "Pure derived data needs no external synchronization; calculating it during render avoids an extra render and stale duplicated state.", REFERENCES.youMightNotNeed, "Remove an unnecessary Effect", "medium"),
  q("effects-external-systems", "Where should code that sends a purchase request on a button click normally run?", "In the button's event handler", ["In an Effect that runs whenever the component mounts", "At module initialization", "Inside a state updater function"], "A purchase is caused by a specific interaction, so its logic belongs to that event rather than visibility-driven Effect synchronization.", REFERENCES.youMightNotNeed, "Separate events from Effects", "medium"),
  q("effects-external-systems", "Why may an Effect's setup and cleanup run an extra time in development under Strict Mode?", "React stress-tests whether cleanup correctly mirrors setup", ["Strict Mode submits forms twice in production", "React permanently mounts two component copies", "It indicates that dependency arrays are unsupported"], "The development-only setup-cleanup-setup cycle exposes missing cleanup while preserving production behavior.", REFERENCES.effects, "Interpret Strict Mode Effect behavior", "medium"),
  q("effects-external-systems", "`useEffect(() => { fetch('/search?q=' + query).then(r => r.json()).then(setResults); }, [query])` runs for `a` and then `ab`. The `ab` response arrives first, but the slower `a` response later replaces it. Which repair preserves query synchronization and prevents the stale commit?", "In each Effect run create an `ignore` flag (or abort that request), set it during cleanup, and call `setResults` only for the still-current run", ["Add `results` to the dependency array so the Effect repeats after either response commits", "Use an empty dependency array so only the first query can ever request data", "Keep both requests active and compare response arrival timestamps rather than the query run that created them"], "The Effect must remain dependent on query, while cleanup invalidates the previous run before its asynchronous result can update state. Adding result dependencies loops; removing query leaves stale synchronization.", REFERENCES.effects, "Prevent an out-of-order Effect race", "hard"),
  q("effects-external-systems", "What does an empty dependency array mean for an Effect's reactive lifecycle?", "It has no reactive dependencies, though development may still perform an extra setup and cleanup check", ["It runs after every render without exception", "It disables cleanup", "It makes all captured props update automatically"], "An empty list says the Effect does not depend on changing reactive values; it does not opt out of Strict Mode verification.", REFERENCES.lifecycle, "Interpret an empty dependency list", "easy"),
  q("effects-external-systems", "An Effect must react to `url` changes but read the latest `shoppingCart` without reconnecting because the cart changed. Which mechanism is designed for that separation?", "Move the non-reactive read into an Effect Event", ["Omit both values from the dependency list", "Copy the cart into a module variable", "Mutate the cart inside the Effect"], "Effect Events separate non-reactive logic from the reactive Effect, allowing latest values to be read without making them synchronization triggers.", REFERENCES.effectEvents, "Separate reactive and non-reactive Effect logic", "medium"),
  q("effects-external-systems", "A chat Effect must reconnect when `roomId` changes, but a connection callback should show the latest `theme` without reconnecting on theme changes. Which design keeps the dependency contract truthful?", "Create the notification callback with `useEffectEvent`, read `theme` there, and keep the connection Effect dependent on `roomId`", ["Read both values in the Effect but suppress the linter and use an empty dependency array", "Put both `roomId` and `theme` in the Effect dependencies and accept every theme-driven reconnect", "Copy `theme` into a module variable during render and read that global in the connection callback"], "An Effect Event reads the latest committed theme without making it a synchronization trigger. The Effect remains reactive to roomId, which actually determines the external connection.", REFERENCES.useEffectEvent, "Separate connection and notification reactivity", "hard"),

  // Refs and custom Hooks
  q("refs-custom-hooks", "What kind of value is appropriate for a ref rather than state?", "A value needed by handlers that should persist but does not affect rendered output", ["Any text displayed in JSX", "A prop the parent must control", "A value whose change must immediately re-render the component"], "Refs retain mutable values between renders without scheduling a render when their current value changes.", REFERENCES.refs, "Choose between refs and state", "easy"),
  q("refs-custom-hooks", "What happens when code assigns to `ref.current`?", "The value changes without causing React to re-render", ["React schedules a render exactly like a state setter", "The ref object is replaced automatically", "The component unmounts"], "A ref is a stable mutable container; React does not track current assignments as render-triggering state updates.", REFERENCES.refs, "Explain ref mutation", "easy"),
  q("refs-custom-hooks", "How should a component focus an input after a button click?", "Attach a ref to the input and call `ref.current.focus()` in the click handler", ["Query and focus the input during every render", "Store the DOM node in state", "Mutate the input's props object"], "A DOM ref is populated after commit and may be used from an event handler for imperative focus management.", REFERENCES.domRefs, "Use a DOM ref for focus", "easy"),
  q("refs-custom-hooks", "Why should render logic avoid reading or writing `ref.current` except for predictable initialization?", "Ref mutation is not part of React's reactive data flow and makes rendering impure or unpredictable", ["Refs are available only in Effects", "Reading a ref always throws during render", "Refs can contain only DOM nodes"], "Rendering should depend on props, state, and context; arbitrary ref access can hide changing inputs from React.", REFERENCES.refs, "Preserve purity around refs", "medium"),
  q("refs-custom-hooks", "A React 19 `SearchInput` accepts `ref` as a prop. Its parent may focus and select the text, but must not receive the DOM node or mutate its value directly. Which implementation fits that contract?", "Keep an internal input ref and use `useImperativeHandle(ref, () => ({ focusAndSelect() { inputRef.current.focus(); inputRef.current.select(); } }), [])`", ["Pass the internal DOM ref straight to the parent and document that it should not set `.value`", "Store the DOM node in state and expose that state object through the ref prop", "Call `focus()` and `select()` during render, then expose no handle"], "useImperativeHandle exposes a deliberately limited method while the actual DOM node stays private. State is not appropriate for a node, and imperative focus must not run during render.", REFERENCES.imperativeHandle, "Design a constrained imperative component API", "hard"),
  q("refs-custom-hooks", "What naming rule helps React tooling recognize a custom Hook?", "Its name starts with `use` followed by a capitalized word", ["Its name ends with `Component`", "Its name starts with `hook_`", "It must be the default export"], "The `use` prefix signals that a function may call Hooks and is subject to the Rules of Hooks.", REFERENCES.customHooks, "Name a custom Hook", "medium"),
  q("refs-custom-hooks", "What does a custom Hook share between components?", "Reusable stateful logic, not one shared state instance", ["The same private state object automatically", "Rendered JSX that cannot be configured", "A global ref for every caller"], "Each Hook call is independent; extracting a custom Hook reuses synchronization or state logic rather than state itself.", REFERENCES.customHooks, "Understand custom Hook reuse", "medium"),
  q("refs-custom-hooks", "Why can `useState` not be called conditionally inside a component?", "React relies on its Hook calls occurring in the same order on every render", ["Conditions cannot contain function calls in JavaScript", "Conditional state Hooks always mutate props", "State Hooks may be called only from event handlers"], "Stable top-level call order lets React associate each useState invocation with the correct stored state. The separate `use` API has documented conditional-call exceptions, but useState does not.", REFERENCES.rulesHooks, "Apply the Rules of Hooks", "medium"),
  q("refs-custom-hooks", "`useChatRoom({ serverUrl, roomId, onMessage })` receives a fresh object and callback every render. Its Effect depends on that object, so typing in an unrelated field reconnects the room; messages must still call the latest `onMessage`. Which Hook API and implementation meet both requirements?", "Accept `serverUrl`, `roomId`, and `onMessage` separately; wrap the latest callback in an Effect Event and make the connection Effect depend only on `serverUrl` and `roomId`", ["Keep the object dependency but suppress exhaustive-deps so React treats equal fields as the same object", "Put the options object in a ref once, use an empty dependency array, and never update the callback", "Move connection creation into the Hook body and use `useMemo` only for the returned connection object"], "Primitive connection inputs express when synchronization must restart, while an Effect Event lets the established connection invoke the latest callback without callback identity causing reconnection.", REFERENCES.useEffectEvent, "Design stable custom Hook synchronization", "hard"),
  q("refs-custom-hooks", "When should reusable logic remain a regular function instead of becoming a custom Hook?", "When it does not call Hooks and only performs a pure calculation", ["Whenever more than one component calls it", "When it accepts arguments", "When it returns an object"], "Ordinary pure functions do not need Hook naming or call-order constraints; custom Hooks are for logic that itself uses Hooks.", REFERENCES.customHooks, "Distinguish utilities from custom Hooks", "medium"),

  // Performance and concurrency
  q("performance-concurrency", "What does `memo(Component)` attempt to skip?", "Re-rendering when the component's props are unchanged", ["The component's first render", "All renders caused by its own state", "Browser layout and painting"], "memo is a performance optimization that can reuse output when parent-driven props compare equal.", REFERENCES.memo, "Explain component memoization", "easy"),
  q("performance-concurrency", "Why does passing a fresh object literal often defeat `memo`?", "The prop has a new object identity on each parent render", ["memo compares objects by serializing their JSON", "Objects cannot be passed to memoized components", "React mutates the object before comparison"], "Default memo comparison uses Object.is per prop, so separately created objects are not identical even if their contents match.", REFERENCES.memo, "Diagnose unstable memoized props", "medium"),
  q("performance-concurrency", "When is `useMemo` appropriate?", "To cache an expensive pure calculation between renders when its dependencies are unchanged", ["To perform required network side effects", "To guarantee semantic correctness", "To replace state for user-editable values"], "useMemo is a performance optimization for calculated values, not a lifecycle guarantee or side-effect mechanism.", REFERENCES.useMemo, "Choose useMemo appropriately", "easy"),
  q("performance-concurrency", "What does `useCallback(fn, dependencies)` cache?", "The function definition itself between renders", ["The result returned by calling the function", "Every event fired by the function", "The component's entire JSX tree"], "useCallback preserves function identity until a dependency changes, which can support optimized children or Hook dependencies.", REFERENCES.useCallback, "Distinguish useCallback from useMemo", "easy"),
  q("performance-concurrency", "What does `startTransition` communicate about its state updates?", "They are non-urgent and may be interrupted by more urgent updates", ["They must run synchronously before input updates", "They bypass rendering entirely", "They persist automatically to the server"], "Transitions keep urgent interactions responsive while React works on non-blocking UI updates in the background.", REFERENCES.transition, "Mark a non-urgent update", "medium"),
  q("performance-concurrency", "A search box uses `value={text}` and `onChange={e => startTransition(() => setText(e.target.value))}`. Its expensive results list also filters from `text`, and typing feels incorrect. Which refactor preserves a responsive controlled input while allowing the list to lag?", "Update `text` urgently in `onChange`, derive `deferredText = useDeferredValue(text)`, and render the expensive list from `deferredText`", ["Keep `setText` in the Transition and wrap the `<input>` itself in `memo`", "Use `defaultValue={text}` while continuing to update `text` only in the Transition", "Call `flushSync` inside the Transition and filter from the same transitioned input value"], "A Transition cannot control a text input: its value update must be immediate. Deferring the value consumed by the expensive list separates urgent typing from non-urgent rendering.", REFERENCES.transition, "Separate urgent input from deferred results", "hard"),
  q("performance-concurrency", "What does `useDeferredValue(query)` enable in a search interface?", "The input can update immediately while a slower results view temporarily uses an older query", ["The query is permanently debounced without renders", "The network request is automatically cancelled", "The results are cached on the server"], "A deferred value lets non-critical rendering lag behind urgent updates and React attempts the background render interruptibly.", REFERENCES.deferred, "Defer non-urgent rendering", "medium"),
  q("performance-concurrency", "What is a Suspense boundary's `fallback` displayed for?", "When a descendant suspends while its required code or data is not ready", ["Whenever a descendant throws an ordinary event-handler error", "Only when CSS fails to load", "After every completed transition"], "Suspense replaces the boundary's children with fallback content while a supported descendant is waiting.", REFERENCES.suspense, "Place a Suspense fallback", "medium"),
  q("performance-concurrency", "What does `lazy(() => import('./Chart.js'))` accomplish?", "It defers loading the component's module until React first tries to render it", ["It executes the import on every state update", "It renders the module without Suspense support", "It memoizes all props passed to Chart"], "lazy code-splits a component module and suspends during loading, normally paired with a Suspense fallback.", REFERENCES.lazy, "Code-split a component", "medium"),
  q("performance-concurrency", "Profiler shows `FilteredList` is expensive. It is wrapped in `memo`, but still re-renders whenever its parent counter changes because the parent passes `onSelect={() => select(category)}`. `category` is unchanged. Which targeted repair preserves behavior and makes the memo boundary effective?", "Cache `onSelect` with `useCallback(() => select(category), [select, category])` and keep `FilteredList` memoized", ["Add `category` as the list's changing `key` so React remounts it on counter updates", "Move the expensive filtering into an Effect that sets list state after every render", "Give `memo` a comparator that always returns true, including when list data changes"], "A new callback identity defeats shallow prop comparison. useCallback stabilizes it until a real dependency changes; forced remounts, post-render derived state, or ignoring changed data are incorrect.", REFERENCES.memo, "Repair an observed memoization boundary", "hard"),

  // Testing, accessibility, and application quality
  q("testing-accessibility-application-quality", "Why should test code wrap rendering and updates in `act`?", "It flushes pending React updates before assertions", ["It disables state updates during the test", "It converts components into snapshots", "It mocks all browser APIs"], "act applies queued updates and Effects so assertions observe the UI state a user would see after the interaction.", REFERENCES.act, "Synchronize React tests", "medium"),
  q("testing-accessibility-application-quality", "What behavior can `<StrictMode>` expose during development?", "Impure rendering and missing Effect or ref cleanup through extra checks", ["Production-only network failures", "Invalid database schemas", "CSS color-contrast violations automatically"], "Strict Mode intentionally repeats selected development operations to reveal code that is not safely repeatable or cleaned up.", REFERENCES.strictMode, "Use Strict Mode diagnostics", "medium"),
  q("testing-accessibility-application-quality", "What is `useId` designed to generate?", "A stable unique ID for accessibility relationships such as input and label", ["A key for every item in a dynamic list", "A database primary key", "A random password for a form"], "useId coordinates IDs across client and server rendering for attributes such as htmlFor and aria-describedby; it is not for list keys.", REFERENCES.useId, "Create accessible relationship IDs", "easy"),
  q("testing-accessibility-application-quality", "A reusable React field receives a page-unique `fieldId` prop and renders its visible `<label>` and `<input>` as separate siblings. Which markup gives the input the correct programmatic label?", "Set the label's `htmlFor={fieldId}` and the input's `id={fieldId}`", ["Set `id={fieldId}` on both the label and input but omit `htmlFor`", "Place the label beside the input and set only `aria-label=\"field\"` on the input", "Set the label's `htmlFor` to the input's changing value while keeping `id={fieldId}`"], "An explicit label association requires the label's for value—written as htmlFor in JSX—to exactly match the form control's id. Visual proximity or mismatched values do not create that relationship.", REFERENCES.waiLabels, "Associate reusable fields with visible labels", "medium"),
  q("testing-accessibility-application-quality", "A client hydrates server-rendered HTML. What must generally be true of the initial client render?", "It should produce the same content as the server output", ["It must deliberately replace every server DOM node", "It may omit all event handlers permanently", "It must start with an empty root"], "hydrateRoot expects matching output so React can attach behavior to existing markup without hydration mismatches.", REFERENCES.hydrate, "Prevent hydration mismatch", "medium"),
  q("testing-accessibility-application-quality", "`ResultsPanel` throws while rendering and an adjacent Save button can throw inside its click handler. Both sit inside one Error Boundary. Which outcome and repair are accurate?", "The boundary can show fallback UI for the render failure, but the click-handler error needs explicit handler error logic because boundaries do not catch event-handler errors", ["The boundary catches both failures because both descendants are inside its JSX", "The boundary catches only the click-handler error because render failures occur before mounting", "Wrap the click handler in another Error Boundary component and it will catch the handler throw automatically"], "Error Boundaries catch descendant rendering and lifecycle failures, not errors thrown by event handlers. Interaction failures require explicit handling even when the button is visually inside a boundary.", REFERENCES.errors, "Distinguish render and interaction error boundaries", "hard"),
  q("testing-accessibility-application-quality", "Where should an Error Boundary usually be placed?", "Around a UI region where a useful fallback can preserve the rest of the application", ["Only once around each individual HTML element", "Inside every event handler", "After the root has already failed to render"], "Boundary granularity is a product decision: isolate meaningful regions so one failure need not blank the entire interface.", REFERENCES.errors, "Choose Error Boundary granularity", "medium"),
  q("testing-accessibility-application-quality", "A custom clickable `<div>` works with a pointer but cannot be reached or activated from the keyboard. What is the most direct semantic repair for a normal action?", "Render a native `<button type=\"button\">` and keep the click handler", ["Add only `tabIndex={0}` to the div and keep click as its sole activation handler", "Add `role=\"button\"` but leave the div unfocusable and without keyboard handling", "Listen for every document keydown and trigger the div for any key"], "A native button supplies focus, role, and expected keyboard activation semantics. Recreating only one part on a div leaves keyboard users with an incomplete control.", REFERENCES.waiKeyboard, "Prefer native keyboard-operable controls", "easy"),
  q("testing-accessibility-application-quality", "A module renders on the server but imports `useState` and handles `onClick`. What boundary declaration is required, and how far does it apply?", "Add `'use client'` at that module's top; it marks that module and its transitive dependencies as client code when imported from server code", ["Add `'use server'` because state is first created during server rendering", "Add `'use client'` inside the component function and repeat it in every descendant file", "No boundary is needed because event handlers are serialized from server code automatically"], "Interactive state and event handling require a Client Component boundary. The top-of-file directive defines the module boundary; descendants do not each need to repeat it.", REFERENCES.useClient, "Identify a client component boundary", "easy"),
  q("testing-accessibility-application-quality", "A test renders a counter, dispatches a click, and immediately asserts `Count: 1`, but React reports that updates were not wrapped in `act`. Which rewrite correctly waits for React and verifies the interaction's visible result?", "Use `await act(async () => { root.render(<Counter />); });`, then `await act(async () => { button.dispatchEvent(new MouseEvent('click', { bubbles: true })); });`, and assert the rendered count text", ["Call synchronous `act(() => root.render(<Counter />))`, dispatch the click outside act, and assert the component's private state variable", "Wrap only the final text assertion in `act` while leaving rendering and the click outside it", "Dispatch the click inside `act` without awaiting either act call, then assert that the click-handler function was invoked"], "React recommends the awaited act form. Rendering and the interaction that schedule updates are awaited before asserting the user-visible DOM result, so pending React work is flushed.", REFERENCES.act, "Await interaction updates before observable assertions", "hard"),
];

function item(draft: Draft, index: number) {
  const topic = TOPICS[draft.topic];
  const correctOption = index % 4;
  const options = [...draft.distractors];
  options.splice(correctOption, 0, draft.correct);
  const objectiveCode = `${topic.code}-${String((index % 10) + 1).padStart(2, "0")}`;
  return {
    schemaVersion: 1 as const,
    sourceRecordId: `raes-v1-${String(index + 1).padStart(3, "0")}`,
    language: "en",
    question: draft.question,
    format: "mcq_single" as const,
    options,
    answer: { kind: "single_choice" as const, correctOption },
    explanation: draft.explanation,
    subject: "React application engineering",
    topic: topic.name,
    syllabus: SYLLABUS,
    exam: "React Application Engineering Skills",
    examYear: 2026,
    objective: draft.objective,
    difficulty: draft.difficulty,
    maxPoints: 1,
    negativeMarks: 0,
    timeLimitSec: draft.difficulty === "hard" ? 120 : draft.difficulty === "easy" ? 60 : 90,
    tags: ["react", draft.topic, draft.difficulty, "original", "version-1"],
    provenance: {
      sourceLocator: draft.reference,
      questionOrigin: "original" as const,
      answerEvidence: `${draft.explanation} Verified against ${draft.reference}`,
      explanationOrigin: "original" as const,
    },
    metadata: {
      bankSlug: BANK_SLUG,
      assessmentSlugs: [ASSESSMENT_SLUG],
      topicSlug: draft.topic,
      authoredCaseVersion: "1.0.0",
      releaseEvidence: {
        syllabusVersion: SYLLABUS,
        objectiveCode,
        answerValidation: { status: "verified", method: "primary_source", reference: draft.reference },
        distractorReview: {
          status: "verified",
          note: "Author screened each distractor for plausibility and a single keyed answer; independent SME confirmation remains required.",
        },
      },
    },
  };
}

export const REACT_APPLICATION_ENGINEERING_SKILLS_V1 = DRAFTS.map(item);

function semanticKey(value: string) {
  return value.toLowerCase().replace(/`[^`]+`/g, "<code>").replace(/\b\d+(?:\.\d+)?\b/g, "<n>").replace(/[^a-z<>]+/g, " ").trim();
}

export function auditReactApplicationEngineeringSkillsV1() {
  const errors: string[] = [];
  const ids = new Set<string>();
  const prompts = new Set<string>();
  const semantic = new Set<string>();
  const hashes = new Set<string>();
  const topicCounts = new Map<string, number>();
  const difficultyCounts = new Map<string, number>();
  const answerPositions = [0, 0, 0, 0];
  for (const candidate of REACT_APPLICATION_ENGINEERING_SKILLS_V1) {
    const normalized = normalizeQuestionPackItem(candidate);
    if (!normalized.ok) {
      errors.push(`${candidate.sourceRecordId}: ${normalized.errors.join("; ")}`);
      continue;
    }
    const prompt = candidate.question.toLowerCase().trim();
    const template = semanticKey(candidate.question);
    if (ids.has(candidate.sourceRecordId)) errors.push(`${candidate.sourceRecordId}: duplicate id`);
    if (prompts.has(prompt)) errors.push(`${candidate.sourceRecordId}: exact duplicate prompt`);
    if (semantic.has(template)) errors.push(`${candidate.sourceRecordId}: normalized duplicate prompt`);
    if (hashes.has(normalized.value.contentHash)) errors.push(`${candidate.sourceRecordId}: duplicate content hash`);
    ids.add(candidate.sourceRecordId);
    prompts.add(prompt);
    semantic.add(template);
    hashes.add(normalized.value.contentHash);
    const topicSlug = String(candidate.metadata.topicSlug);
    topicCounts.set(topicSlug, (topicCounts.get(topicSlug) ?? 0) + 1);
    const difficultyKey = `${topicSlug}:${candidate.difficulty}`;
    difficultyCounts.set(difficultyKey, (difficultyCounts.get(difficultyKey) ?? 0) + 1);
    answerPositions[candidate.answer.correctOption] += 1;
    const evidence = candidate.metadata.releaseEvidence;
    if (evidence.syllabusVersion !== SYLLABUS || !evidence.objectiveCode || !evidence.answerValidation.reference) {
      errors.push(`${candidate.sourceRecordId}: incomplete release evidence`);
    }
    if (
      !candidate.provenance.sourceLocator.startsWith("https://react.dev/")
      && !candidate.provenance.sourceLocator.startsWith("https://www.w3.org/WAI/")
    ) {
      errors.push(`${candidate.sourceRecordId}: non-primary source`);
    }
  }
  if (REACT_APPLICATION_ENGINEERING_SKILLS_V1.length !== 80) errors.push(`Expected 80 rows, found ${REACT_APPLICATION_ENGINEERING_SKILLS_V1.length}`);
  for (const topicSlug of Object.keys(TOPICS)) {
    if ((topicCounts.get(topicSlug) ?? 0) !== 10) errors.push(`${topicSlug}: expected 10 questions`);
  }
  if (answerPositions.some((count) => count !== 20)) errors.push(`Answer positions are not balanced: ${answerPositions.join(",")}`);
  const digest = createHash("sha256").update(JSON.stringify(REACT_APPLICATION_ENGINEERING_SKILLS_V1)).digest("hex");
  return {
    errors,
    rows: REACT_APPLICATION_ENGINEERING_SKILLS_V1.length,
    uniquePrompts: prompts.size,
    uniqueSemanticPrompts: semantic.size,
    uniqueContent: hashes.size,
    topicCounts: Object.fromEntries(topicCounts),
    difficultyCounts: Object.fromEntries(difficultyCounts),
    answerPositions,
    proposedDraw: 16,
    rotationDepth: 5,
    digest,
  };
}

async function main() {
  const output = path.resolve(process.argv[2] ?? "content/question-packs/octamy-react-application-engineering-skills-v1.jsonl");
  const audit = auditReactApplicationEngineeringSkillsV1();
  if (audit.errors.length) throw new Error(audit.errors.join("\n"));
  await mkdir(path.dirname(output), { recursive: true });
  const stream = createWriteStream(output, { encoding: "utf8", flags: "w", mode: 0o600 });
  for (const candidate of REACT_APPLICATION_ENGINEERING_SKILLS_V1) stream.write(`${JSON.stringify(candidate)}\n`);
  stream.end();
  await finished(stream);
  process.stdout.write(`${JSON.stringify({ output, ...audit }, null, 2)}\n`);
}

if (/generate-react-application-engineering-skills-v1\.(?:c?js|ts)$/.test(path.basename(process.argv[1] ?? ""))) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
