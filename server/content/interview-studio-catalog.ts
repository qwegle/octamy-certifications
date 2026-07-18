import {
  INTERVIEW_STUDIO_BLUEPRINT_SCHEMA_VERSION,
  INTERVIEW_STUDIO_JAVASCRIPT_RUNTIME,
  interviewStudioBlueprintSchema,
  type InterviewStudioBlueprint,
} from "../../shared/interview-studio";

type AutocompleteItem = {
  id: string;
  label: string;
};

type AutocompleteState = {
  query: string;
  status: "idle" | "loading" | "ready" | "empty" | "error";
  items: AutocompleteItem[];
  selectedId: string | null;
  activeRequestId: number | null;
};

const autocompleteInput = (events: unknown[]) => `${JSON.stringify(events)}\n`;
const autocompleteOutput = (state: AutocompleteState) => JSON.stringify(state);

const EMPTY_AUTOCOMPLETE_STATE: AutocompleteState = {
  query: "",
  status: "idle",
  items: [],
  selectedId: null,
  activeRequestId: null,
};

/**
 * Canonical, source-controlled Interview Studio content.
 *
 * Published rows remain immutable in PostgreSQL. A catalog sync must therefore
 * insert a new version and make it current instead of changing an earlier
 * blueprint that may already be snapshotted into learner sessions.
 */
export const FRONTEND_ENGINEER_FOUNDATIONS_V2 = interviewStudioBlueprintSchema.parse({
  schemaVersion: INTERVIEW_STUDIO_BLUEPRINT_SCHEMA_VERSION,
  templateKey: "frontend-engineer-foundations",
  version: 2,
  title: "Frontend Engineer Interview Practice",
  summary:
    "A realistic intermediate frontend interview covering asynchronous data, React performance, accessibility, engineering ownership, and a deterministic state-management task.",
  role: "Frontend Engineer",
  level: "intermediate",
  skills: [
    "Async JavaScript",
    "React performance",
    "Web accessibility",
    "Engineering ownership",
    "Frontend state management",
  ],
  allowedModes: ["practice"],
  estimatedDurationMinutes: 45,
  rubricVersion: "frontend-engineer-intermediate-rubric-v2",
  items: [
    {
      key: "stale-search-results",
      kind: "structured_response",
      title: "Fix out-of-order search results",
      competency: "Async JavaScript",
      timeLimitSeconds: 420,
      instructions:
        "Give an evidence-led diagnosis, a concrete implementation approach, and a verification plan. State any assumptions you make.",
      prompt:
        "A product-search page requests results on every query change. A user types “shoe” and then quickly types “shoes”; the slower “shoe” response arrives last and replaces the correct results. Explain how you would reproduce and prove the cause, fix the request lifecycle, and handle loading, empty, and error states without introducing a new race.",
      responseFormat: "text_or_transient_voice",
      minimumWords: 100,
      maximumWords: 500,
      rubric: [
        {
          key: "race-diagnosis",
          label: "Race diagnosis",
          description:
            "Uses observable request ordering or controlled latency to identify the stale-response race rather than guessing.",
          weight: 35,
        },
        {
          key: "request-lifecycle",
          label: "Request lifecycle",
          description:
            "Proposes a sound cancellation or latest-request strategy and defines coherent loading, empty, success, and error behavior.",
          weight: 40,
        },
        {
          key: "verification",
          label: "Verification",
          description:
            "Covers automated out-of-order response tests and practical browser or production validation.",
          weight: 25,
        },
      ],
    },
    {
      key: "inventory-render-regression",
      kind: "structured_response",
      title: "Diagnose a React render regression",
      competency: "React performance",
      timeLimitSeconds: 480,
      instructions:
        "Start with measurement, isolate the responsible render path, and justify each optimization with evidence.",
      prompt:
        "After live inventory updates are added, a React product grid pauses on every update even when only one visible item changes. Describe how you would establish a reproducible baseline, use React and browser tooling to find the render or subscription boundary at fault, change the design, and demonstrate that behavior and accessibility did not regress.",
      responseFormat: "text_or_transient_voice",
      minimumWords: 110,
      maximumWords: 550,
      rubric: [
        {
          key: "measurement",
          label: "Measurement",
          description:
            "Establishes a repeatable baseline and uses profiler or render evidence to locate the expensive work.",
          weight: 35,
        },
        {
          key: "state-boundaries",
          label: "State and render boundaries",
          description:
            "Narrows subscriptions and state ownership before applying targeted memoization, batching, or virtualization where justified.",
          weight: 40,
        },
        {
          key: "regression-control",
          label: "Regression control",
          description:
            "Validates measurable improvement while protecting correctness, interaction behavior, and accessibility.",
          weight: 25,
        },
      ],
    },
    {
      key: "accessible-autocomplete-contract",
      kind: "structured_response",
      title: "Specify an accessible autocomplete",
      competency: "Web accessibility",
      timeLimitSeconds: 480,
      instructions:
        "Define observable interaction behavior and a test plan; do not treat an ARIA attribute list as a complete answer.",
      prompt:
        "You are reviewing an autocomplete that works with a mouse but is confusing with a keyboard and screen reader. Specify how focus, arrow keys, Enter, Escape, selection, loading, no-results, and validation errors should behave. Explain the browser-facing accessibility state you would expose and how you would test the finished interaction.",
      responseFormat: "text_or_transient_voice",
      minimumWords: 110,
      maximumWords: 550,
      rubric: [
        {
          key: "interaction-model",
          label: "Interaction model",
          description:
            "Defines coherent keyboard, focus, selection, dismissal, and recovery behavior for the complete interaction.",
          weight: 35,
        },
        {
          key: "accessible-state",
          label: "Accessible state",
          description:
            "Connects appropriate combobox state, relationships, active option, status, and error announcements to actual behavior.",
          weight: 35,
        },
        {
          key: "assistive-testing",
          label: "Assistive testing",
          description:
            "Combines keyboard and screen-reader checks with suitable automated tests and clear acceptance criteria.",
          weight: 30,
        },
      ],
    },
    {
      key: "shipped-feature-tradeoff",
      kind: "structured_response",
      title: "Explain a shipped frontend trade-off",
      competency: "Engineering ownership",
      timeLimitSeconds: 360,
      instructions:
        "Use one real example. Separate your contribution from the team’s work and support outcomes with evidence where possible.",
      prompt:
        "Describe one frontend feature or production fix you personally helped ship. What user or business problem were you solving, what constraints shaped the design, which technical trade-off did you make, and how did you verify the outcome? Include what you would change if you approached the work again.",
      responseFormat: "text_or_transient_voice",
      minimumWords: 90,
      maximumWords: 450,
      rubric: [
        {
          key: "personal-evidence",
          label: "Personal evidence",
          description:
            "Clearly distinguishes the candidate’s contribution and grounds the example in a concrete problem and constraints.",
          weight: 40,
        },
        {
          key: "tradeoff-reasoning",
          label: "Trade-off reasoning",
          description:
            "Explains alternatives, the chosen compromise, and the consequences instead of presenting a context-free success story.",
          weight: 30,
        },
        {
          key: "outcome-learning",
          label: "Outcome and learning",
          description:
            "Uses credible validation or outcome evidence and identifies a specific lesson or next improvement.",
          weight: 30,
        },
      ],
    },
    {
      key: "autocomplete-state-reducer",
      kind: "coding",
      title: "Implement an autocomplete state reducer",
      competency: "Frontend state management",
      timeLimitSeconds: 960,
      instructions:
        "Complete reduceAutocomplete. Read the JSON event array from standard input and write only the final state JSON to standard output.",
      language: "javascript",
      runtime: INTERVIEW_STUDIO_JAVASCRIPT_RUNTIME,
      interface: "stdin_stdout",
      problemStatement:
        "Implement a pure reducer for an autocomplete. The input is a JSON array of events. QUERY_CHANGED sets the query and status to idle, then clears items, selection, and the active request. REQUEST_STARTED applies only when its query equals the current query and sets activeRequestId and status to loading. REQUEST_SUCCEEDED and REQUEST_FAILED apply only when requestId equals activeRequestId; both clear activeRequestId. A success stores its items and sets status to ready or empty, while a failure clears items and sets status to error. SELECT changes selectedId only when that id exists in the current items; otherwise ignore it. CLEAR restores the initial state. Ignore stale request events. Output exactly one JSON object with properties in this order: query, status, items, selectedId, activeRequestId.",
      starterCode: `const fs = require("node:fs");
const events = JSON.parse(fs.readFileSync(0, "utf8"));

const initialState = {
  query: "",
  status: "idle",
  items: [],
  selectedId: null,
  activeRequestId: null,
};

function reduceAutocomplete(state, event) {
  // Return the next state without mutating state, event, or event.items.
}

const finalState = events.reduce(reduceAutocomplete, initialState);
process.stdout.write(JSON.stringify(finalState));
`,
      constraints: [
        "The input contains between 0 and 1000 valid event objects.",
        "requestId is an integer between 1 and 1000000000.",
        "Every success item has non-empty string id and label properties, and item ids are unique within that event.",
        "Unknown event types do not occur.",
        "The reducer must not mutate prior state, events, or item arrays.",
      ],
      testCases: [
        {
          key: "public-current-success",
          title: "Current request succeeds",
          visibility: "public",
          input: autocompleteInput([
            { type: "QUERY_CHANGED", query: "shoes" },
            { type: "REQUEST_STARTED", query: "shoes", requestId: 1 },
            {
              type: "REQUEST_SUCCEEDED",
              requestId: 1,
              items: [
                { id: "p1", label: "Running shoes" },
                { id: "p2", label: "Walking shoes" },
              ],
            },
          ]),
          expectedOutput: autocompleteOutput({
            query: "shoes",
            status: "ready",
            items: [
              { id: "p1", label: "Running shoes" },
              { id: "p2", label: "Walking shoes" },
            ],
            selectedId: null,
            activeRequestId: null,
          }),
          weight: 20,
        },
        {
          key: "public-valid-selection",
          title: "Existing result is selected",
          visibility: "public",
          input: autocompleteInput([
            { type: "QUERY_CHANGED", query: "lamp" },
            { type: "REQUEST_STARTED", query: "lamp", requestId: 4 },
            {
              type: "REQUEST_SUCCEEDED",
              requestId: 4,
              items: [{ id: "p9", label: "Desk lamp" }],
            },
            { type: "SELECT", id: "p9" },
          ]),
          expectedOutput: autocompleteOutput({
            query: "lamp",
            status: "ready",
            items: [{ id: "p9", label: "Desk lamp" }],
            selectedId: "p9",
            activeRequestId: null,
          }),
          weight: 15,
        },
        {
          key: "hidden-stale-success",
          title: "Late stale response is ignored",
          visibility: "hidden",
          input: autocompleteInput([
            { type: "QUERY_CHANGED", query: "shoe" },
            { type: "REQUEST_STARTED", query: "shoe", requestId: 10 },
            { type: "QUERY_CHANGED", query: "shoes" },
            { type: "REQUEST_STARTED", query: "shoes", requestId: 11 },
            {
              type: "REQUEST_SUCCEEDED",
              requestId: 11,
              items: [{ id: "new", label: "New result" }],
            },
            {
              type: "REQUEST_SUCCEEDED",
              requestId: 10,
              items: [{ id: "old", label: "Stale result" }],
            },
          ]),
          expectedOutput: autocompleteOutput({
            query: "shoes",
            status: "ready",
            items: [{ id: "new", label: "New result" }],
            selectedId: null,
            activeRequestId: null,
          }),
          weight: 25,
        },
        {
          key: "hidden-empty-success",
          title: "Current request returns no items",
          visibility: "hidden",
          input: autocompleteInput([
            { type: "QUERY_CHANGED", query: "unavailable" },
            { type: "REQUEST_STARTED", query: "unavailable", requestId: 21 },
            { type: "REQUEST_SUCCEEDED", requestId: 21, items: [] },
          ]),
          expectedOutput: autocompleteOutput({
            query: "unavailable",
            status: "empty",
            items: [],
            selectedId: null,
            activeRequestId: null,
          }),
          weight: 10,
        },
        {
          key: "hidden-current-failure",
          title: "Only current failure changes state",
          visibility: "hidden",
          input: autocompleteInput([
            { type: "QUERY_CHANGED", query: "bag" },
            { type: "REQUEST_STARTED", query: "bag", requestId: 30 },
            { type: "QUERY_CHANGED", query: "bags" },
            { type: "REQUEST_STARTED", query: "bags", requestId: 31 },
            { type: "REQUEST_FAILED", requestId: 30 },
            { type: "REQUEST_FAILED", requestId: 31 },
          ]),
          expectedOutput: autocompleteOutput({
            query: "bags",
            status: "error",
            items: [],
            selectedId: null,
            activeRequestId: null,
          }),
          weight: 15,
        },
        {
          key: "hidden-clear-reset",
          title: "Clear resets every field",
          visibility: "hidden",
          input: autocompleteInput([
            { type: "QUERY_CHANGED", query: "chair" },
            { type: "REQUEST_STARTED", query: "chair", requestId: 40 },
            {
              type: "REQUEST_SUCCEEDED",
              requestId: 40,
              items: [{ id: "c1", label: "Office chair" }],
            },
            { type: "SELECT", id: "c1" },
            { type: "CLEAR" },
          ]),
          expectedOutput: autocompleteOutput(EMPTY_AUTOCOMPLETE_STATE),
          weight: 15,
        },
      ],
      rubric: [
        {
          key: "correctness",
          label: "Correctness",
          description:
            "Produces the required state across current, stale, empty, failed, selection, and reset cases.",
          weight: 70,
        },
        {
          key: "state-model",
          label: "State model",
          description:
            "Uses explicit immutable transitions and keeps request identity, status, items, and selection consistent.",
          weight: 20,
        },
        {
          key: "code-quality",
          label: "Code quality",
          description:
            "Uses clear, bounded JavaScript with readable event handling and no unnecessary side effects.",
          weight: 10,
        },
      ],
    },
  ],
});

export const INTERVIEW_STUDIO_CATALOG: readonly InterviewStudioBlueprint[] = Object.freeze([
  FRONTEND_ENGINEER_FOUNDATIONS_V2,
]);
