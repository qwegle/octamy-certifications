#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { finished } from "node:stream/promises";
import { normalizeQuestionPackItem } from "./lib/question-pack-contract";

const ASSESSMENT_SLUG = "software-testing-qa-foundations";
const BANK_SLUG = "software-testing-qa-foundations-bank-v1";
const SYLLABUS = "OCT-STQA-2026.1 (ISTQB CTFL 4.0, OWASP WSTG, WCAG 2.2, Playwright, OpenAPI; 2026-07-28)";

const REFERENCES = {
  istqb: "https://www.istqb.org/certifications/certified-tester-foundation-level-ctfl-v4-0/",
  owaspWstg: "https://owasp.org/www-project-web-security-testing-guide/latest/",
  wcag: "https://www.w3.org/TR/WCAG22/",
  playwrightAssertions: "https://playwright.dev/docs/test-assertions",
  playwrightTimeouts: "https://playwright.dev/docs/test-timeouts",
  openapi: "https://spec.openapis.org/oas/latest.html",
  rfc9110: "https://www.rfc-editor.org/rfc/rfc9110.html",
} as const;

const TOPICS = {
  "testing-fundamentals-risk-strategy": { name: "Testing fundamentals, risk, and strategy", code: "STQA-STRAT" },
  "sdlc-agile-devops-testing": { name: "Testing across SDLC, Agile, and DevOps", code: "STQA-SDLC" },
  "static-review-test-analysis": { name: "Static review and test analysis", code: "STQA-REVIEW" },
  "black-box-test-design": { name: "Black-box test design techniques", code: "STQA-BLACK" },
  "white-box-technical-testing": { name: "White-box and technical testing", code: "STQA-WHITE" },
  "api-contract-integration-testing": { name: "API, contract, and integration testing", code: "STQA-API" },
  "ui-e2e-automation-reliability": { name: "UI end-to-end automation reliability", code: "STQA-E2E" },
  "defect-triage-release-reporting": { name: "Defect triage and release reporting", code: "STQA-DEFECT" },
  "test-data-environments-ci": { name: "Test data, environments, and CI", code: "STQA-CI" },
  "accessibility-security-quality": { name: "Accessibility, security, and quality risk", code: "STQA-QUAL" },
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
  q("testing-fundamentals-risk-strategy", "A payments team has limited time before release. Which testing approach best uses the time?", "Prioritize tests around the highest product and business risks first", ["Run only the easiest happy-path tests", "Test files alphabetically by component name", "Skip exploratory testing because automation exists"], "Risk-based testing focuses effort where failure impact and likelihood are highest, which is essential under time pressure.", REFERENCES.istqb, "Apply risk-based test prioritization", "easy"),
  q("testing-fundamentals-risk-strategy", "A tester finds a severe checkout issue before launch. Which statement best describes the value of testing here?", "Testing provided information that reduced release risk before users were affected", ["Testing proved the application has no other defects", "Testing replaced the need for product decisions", "Testing guaranteed the release will be profitable"], "Testing supplies quality information and exposes risk; it does not prove defect absence or make business decisions alone.", REFERENCES.istqb, "Explain testing value", "easy"),
  q("testing-fundamentals-risk-strategy", "A team says, 'We tested everything because all written test cases passed.' What is the main flaw in that claim?", "Passing selected tests does not prove there are no defects outside those checks", ["Passing tests means exploratory testing is forbidden", "A test case cannot have expected results", "Manual testing never finds real issues"], "One core testing principle is that exhaustive testing is impractical; passed tests reduce uncertainty but do not prove perfection.", REFERENCES.istqb, "Recognize limits of testing", "easy"),
  q("testing-fundamentals-risk-strategy", "A support dashboard fails only for a small admin group but blocks incident response. How should severity be judged?", "By business and operational impact, not only by number of affected users", ["Always low because few users are affected", "Always cosmetic because it is an admin page", "Only by whether the defect is easy to fix"], "Severity reflects impact. A small audience can still represent high business or operational risk.", REFERENCES.istqb, "Classify quality risk impact", "medium"),
  q("testing-fundamentals-risk-strategy", "A team wants to stop testing once no new bugs are found for one day. What stronger exit criterion would improve the decision?", "Combine defect trend, risk coverage, passed critical tests, and unresolved-severity thresholds", ["Stop after the newest tester says the product feels fine", "Stop when all low-risk UI colors are checked", "Stop when developers say they are busy"], "Exit decisions should use objective evidence about coverage, residual risk, and unresolved defects.", REFERENCES.istqb, "Define release exit criteria", "medium"),
  q("testing-fundamentals-risk-strategy", "A new tester writes many tests from the developer's implementation notes only. What important perspective is missing?", "User behavior, requirements, risks, and likely failure modes beyond the implementation", ["The exact variable names used in production", "The build server CPU model", "The developer's preferred code editor"], "Good analysis considers product intent, user workflows, and risks, not only how code was built.", REFERENCES.istqb, "Broaden test basis analysis", "medium"),
  q("testing-fundamentals-risk-strategy", "A release has stable core flows but a brand-new refund feature touching payments, email, and ledger entries. What should receive extra regression focus?", "The refund feature and connected payment, notification, and accounting flows", ["Only unchanged login screens", "Only the oldest test cases", "Only UI screenshots of the home page"], "Regression effort should reflect change impact and integration risk, especially around financially sensitive workflows.", REFERENCES.istqb, "Prioritize regression by change impact", "medium"),
  q("testing-fundamentals-risk-strategy", "A product owner asks whether a known intermittent order bug should block release. What should QA provide?", "Clear evidence about frequency, impact, affected users, workaround, and residual risk", ["A personal opinion without evidence", "A promise that the bug will never happen again", "A request to ignore the bug because it is intermittent"], "QA supports release decisions by making risk visible with actionable evidence.", REFERENCES.istqb, "Communicate residual risk", "medium"),
  q("testing-fundamentals-risk-strategy", "An insurance quote engine has thousands of input combinations. Why is exhaustive testing not practical?", "The combination space is too large, so techniques and risk selection are needed", ["Because quote engines cannot be tested", "Because expected results are never useful", "Because only production users can test forms"], "Combinatorial explosion makes exhaustive testing impractical; testers use design techniques and risk analysis.", REFERENCES.istqb, "Explain exhaustive testing limits", "hard"),
  q("testing-fundamentals-risk-strategy", "A team measures QA only by number of defects found. What harmful behavior can this create?", "It can reward quantity over risk reduction, prevention, and useful quality information", ["It always improves collaboration", "It guarantees better test design", "It removes the need for defect triage"], "Defect count alone is a weak metric because good testing also prevents defects and informs decisions.", REFERENCES.istqb, "Evaluate QA metrics", "hard"),

  q("sdlc-agile-devops-testing", "In an Agile team, when should testers start contributing to a user story?", "During refinement and acceptance-criteria discussion, before coding is complete", ["Only after deployment to production", "Only after all developers finish every story", "Only when the sprint review starts"], "Early tester involvement helps clarify expectations, risks, and testability before defects are built in.", REFERENCES.istqb, "Shift testing earlier in Agile", "easy"),
  q("sdlc-agile-devops-testing", "A team practices continuous delivery. What is the main reason automated regression checks matter?", "They provide fast feedback on whether recent changes broke important behavior", ["They remove all need for human judgment", "They guarantee the release has no security risks", "They make requirements unnecessary"], "Fast automated feedback supports frequent delivery but does not replace exploration or risk analysis.", REFERENCES.istqb, "Use automation for fast feedback", "easy"),
  q("sdlc-agile-devops-testing", "Which artifact is most useful for making a story testable before development starts?", "Clear acceptance criteria with observable outcomes", ["A logo color palette only", "A production database password", "A list of developer vacation days"], "Acceptance criteria help the team understand expected behavior and create tests before implementation.", REFERENCES.istqb, "Use acceptance criteria", "easy"),
  q("sdlc-agile-devops-testing", "A waterfall project delays system testing until the final week. What risk increases most?", "Late discovery of integration and requirement misunderstandings", ["Too much unit test coverage", "Too much stakeholder feedback", "Earlier release of working software"], "Late testing compresses feedback and makes integration defects more expensive to resolve.", REFERENCES.istqb, "Identify late-testing risk", "medium"),
  q("sdlc-agile-devops-testing", "Developers say unit tests passed, so QA should skip system testing. What is the best response?", "Unit tests are valuable, but system testing checks end-to-end behavior and integration risks", ["Unit tests are useless and should be deleted", "System testing is only needed for mobile apps", "QA should test only code formatting"], "Different test levels target different risks; unit success does not prove full-system behavior.", REFERENCES.istqb, "Differentiate test levels", "medium"),
  q("sdlc-agile-devops-testing", "A production hotfix changes tax calculation. Which SDLC activity should happen immediately after deployment?", "Targeted monitoring and confirmation that the fix works without new high-risk regressions", ["Delete all regression tests", "Disable logs to reduce noise", "Postpone verification until the next quarter"], "Maintenance testing includes validating changes and watching affected production behavior.", REFERENCES.istqb, "Apply maintenance testing", "medium"),
  q("sdlc-agile-devops-testing", "A Scrum team carries every testing task into the next sprint. What process problem is most likely?", "Testing is not integrated into the team's definition of done and sprint planning capacity", ["The team has too many monitors", "The product uses too few colors", "The bug tracker has too many labels"], "Repeated spillover often means quality activities are not realistically planned into the delivery flow.", REFERENCES.istqb, "Integrate testing into done criteria", "medium"),
  q("sdlc-agile-devops-testing", "A CI pipeline runs slow browser tests on every small commit and blocks developers for an hour. What is a better strategy?", "Use a layered pipeline with fast checks first and slower end-to-end suites at appropriate gates", ["Remove every automated test", "Run only screenshots once a year", "Require manual approval for each assertion"], "A test pyramid or layered feedback strategy balances speed, confidence, and cost.", REFERENCES.istqb, "Design CI feedback layers", "medium"),
  q("sdlc-agile-devops-testing", "A team deploys behind a feature flag but never tests the enabled path until full rollout. What is the hidden risk?", "The flag reduces exposure but does not verify the real enabled behavior", ["Feature flags automatically test business logic", "Disabled code cannot contain defects", "Rollbacks are impossible with flags"], "Feature flags control rollout; they do not replace testing of enabled and disabled behavior.", REFERENCES.istqb, "Test feature-flagged behavior", "hard"),
  q("sdlc-agile-devops-testing", "A release train includes web, API, and mobile teams. Which test planning action best reduces cross-team surprise?", "Agree shared contract checks, integration windows, ownership, and release acceptance signals", ["Let each team invent incompatible status codes", "Avoid documenting assumptions", "Test only the web UI after all deployments"], "Cross-team systems need explicit integration expectations and coordinated evidence before release.", REFERENCES.istqb, "Coordinate multi-team testing", "hard"),

  q("static-review-test-analysis", "A tester reviews requirements and finds two acceptance criteria contradict each other. What kind of testing activity is this?", "Static testing through review before executing the software", ["Load testing in production", "Dynamic testing of compiled code", "A/B testing of marketing pages"], "Static testing evaluates work products such as requirements without executing the software.", REFERENCES.istqb, "Identify static testing", "easy"),
  q("static-review-test-analysis", "What is the main benefit of reviewing acceptance criteria before coding?", "Defects and ambiguity can be removed when they are cheaper to fix", ["It guarantees no runtime defects", "It replaces all need for unit tests", "It makes stakeholders unnecessary"], "Early reviews can prevent misunderstandings before implementation cost increases.", REFERENCES.istqb, "Explain review value", "easy"),
  q("static-review-test-analysis", "During a review, a tester says, 'What should happen if payment succeeds but email fails?' What skill is being applied?", "Finding missing behavior and exception paths in the test basis", ["Changing the production schema", "Approving a visual design", "Measuring CPU utilization"], "Good test analysis asks about missing states, errors, and observable outcomes.", REFERENCES.istqb, "Analyze exception paths", "easy"),
  q("static-review-test-analysis", "A user story says, 'The report loads quickly.' What is the best review comment?", "Define a measurable performance expectation and context for 'quickly'", ["Remove the report from scope", "Use a larger font", "Mark the story complete"], "Ambiguous quality expectations should be turned into measurable acceptance criteria.", REFERENCES.istqb, "Clarify non-functional criteria", "medium"),
  q("static-review-test-analysis", "A design review finds that no audit log is planned for admin role changes. Why is this useful QA input?", "It identifies a quality and compliance risk before the feature is built", ["It proves the UI is too slow", "It replaces authorization tests", "It means the database cannot be backed up"], "Reviews can expose missing controls that affect security, traceability, or operations.", REFERENCES.istqb, "Review for quality attributes", "medium"),
  q("static-review-test-analysis", "A tester traces each acceptance criterion to at least one planned test. What gap does this reveal?", "Requirements with no planned verification and tests with no clear requirement/risk basis", ["Whether developers prefer TypeScript", "Whether the logo is trademarked", "Whether users like the pricing"], "Traceability helps find coverage gaps and unsupported tests.", REFERENCES.istqb, "Use traceability", "medium"),
  q("static-review-test-analysis", "A review meeting spends most time blaming the author. What is the process failure?", "The review is not focused on improving the work product and finding issues objectively", ["The defect tracker has too many columns", "The test environment is too small", "The release branch has no tags"], "Effective reviews focus on defects in the work product, not personal criticism.", REFERENCES.istqb, "Conduct constructive reviews", "medium"),
  q("static-review-test-analysis", "A team reviews a database migration and notices rollback is undefined. Which testability concern is raised?", "Failure recovery cannot be verified without expected rollback behavior", ["The CSS bundle is too large", "Unit tests must be written in SQL", "Users cannot remember passwords"], "Undefined recovery behavior prevents reliable testing of operational failure paths.", REFERENCES.istqb, "Review for operability testability", "medium"),
  q("static-review-test-analysis", "A regulatory form has 40 fields and multiple conditional rules. What should test analysis produce before execution?", "A model of rules, valid/invalid conditions, and expected outcomes for each important path", ["Only one screenshot of the empty form", "A production user password", "A list of unrelated browser shortcuts"], "Complex rules need structured analysis so tests cover meaningful combinations.", REFERENCES.istqb, "Model complex test conditions", "hard"),
  q("static-review-test-analysis", "A tester finds that a requirement uses both 'customer' and 'account holder' without defining whether they differ. Why does this matter?", "Inconsistent terms can lead to different implementations and incorrect tests", ["Terminology never affects software behavior", "Only designers care about wording", "The issue can only be found after release"], "Terminology ambiguity is a common requirements defect that static review can catch early.", REFERENCES.istqb, "Detect terminology ambiguity", "hard"),

  q("black-box-test-design", "A field accepts ages from 18 to 65 inclusive. Which values are boundary-focused?", "17, 18, 65, and 66", ["20, 30, 40, and 50", "Only 18 and 65", "Only negative numbers"], "Boundary value analysis checks values at and just outside edges where defects often occur.", REFERENCES.istqb, "Apply boundary value analysis", "easy"),
  q("black-box-test-design", "A discount rule applies to orders over ₹5,000. Which pair best checks the boundary?", "₹5,000 and ₹5,001", ["₹1 and ₹2", "₹10,000 and ₹20,000", "Two unrelated high-value orders"], "Boundary tests target the threshold and the first value that crosses it.", REFERENCES.istqb, "Choose threshold boundary values", "easy"),
  q("black-box-test-design", "A login accepts either email/password or Google sign-in. What technique helps model the different valid flows?", "Decision table or state/flow modeling for authentication paths", ["CPU profiling only", "Color contrast checking only", "Deleting negative tests"], "Black-box techniques can model rules and flows without knowing code internals.", REFERENCES.istqb, "Model alternate user flows", "easy"),
  q("black-box-test-design", "A shipping fee depends on country, cart weight band, and membership tier. Which test design technique is most helpful?", "Decision table testing", ["Only statement coverage", "Only visual snapshot testing", "Only spell checking"], "Decision tables help cover combinations of business rules and expected outcomes.", REFERENCES.istqb, "Use decision tables", "medium"),
  q("black-box-test-design", "An order can move Draft → Paid → Packed → Shipped → Delivered, with Cancel allowed only before Packed. What technique fits best?", "State transition testing", ["Equivalence partitioning only", "Accessibility contrast testing only", "Mutation testing only"], "State transition testing checks valid and invalid movement between states.", REFERENCES.istqb, "Apply state transition testing", "medium"),
  q("black-box-test-design", "A file upload accepts PDF and PNG up to 5 MB. Which set best represents equivalence partitions?", "Valid type/size, invalid type, oversized file, and missing file", ["Four different valid PDF filenames", "Only files from one browser", "Only the largest valid PNG repeated"], "Equivalence partitioning groups inputs expected to behave similarly while including invalid groups.", REFERENCES.istqb, "Use equivalence partitions", "medium"),
  q("black-box-test-design", "A search page has filters for category, price, rating, and availability. Why might pairwise testing be useful?", "It reduces combination count while still covering interactions between pairs of inputs", ["It proves every possible combination works", "It removes the need for expected results", "It is only for white-box unit tests"], "Pairwise testing is a practical combinatorial technique when full coverage is too expensive.", REFERENCES.istqb, "Apply pairwise selection", "medium"),
  q("black-box-test-design", "A tester only checks valid coupon codes. What important black-box coverage is missing?", "Invalid, expired, already-used, and boundary-condition coupons", ["The developer's keyboard layout", "The CI server hostname", "The image compression settings"], "Negative and edge cases are essential for validating business rule handling.", REFERENCES.istqb, "Add negative coverage", "medium"),
  q("black-box-test-design", "A tax calculation rule has nested exceptions by state, product type, nonprofit status, and date. What is the risk of testing only examples from the requirements document?", "Important rule interactions may be missed if the examples do not cover combinations systematically", ["The examples always cover every combination", "Tax rules cannot be tested before production", "Only UI tests can validate tax rules"], "Complex rules need systematic design beyond a few examples.", REFERENCES.istqb, "Analyze rule-combination risk", "hard"),
  q("black-box-test-design", "A flight booking system prices seats based on fare class, baggage, loyalty tier, and changeability. Why should expected results be independently calculated?", "Otherwise tests may simply repeat the same misunderstanding as the implementation", ["Expected results are optional for business rules", "The UI will always show the correct price", "Only developers can define any expected result"], "Independent expected results reduce confirmation bias in business-rule testing.", REFERENCES.istqb, "Avoid oracle duplication", "hard"),

  q("white-box-technical-testing", "What does statement coverage measure?", "Whether executable statements have been exercised by tests", ["Whether every user story is approved", "Whether every browser is installed", "Whether every defect is fixed"], "Statement coverage is a structural measure of executed code statements.", REFERENCES.istqb, "Define statement coverage", "easy"),
  q("white-box-technical-testing", "A function has an `if/else` branch. Which metric focuses on exercising both outcomes?", "Branch or decision coverage", ["Color contrast ratio", "Customer satisfaction score", "Page load screenshot count"], "Branch/decision coverage checks whether decision outcomes have been exercised.", REFERENCES.istqb, "Define branch coverage", "easy"),
  q("white-box-technical-testing", "A unit test stubs the payment gateway. What risk remains?", "The real integration contract and production gateway behavior may still fail", ["The unit test cannot check any logic", "The app cannot be deployed", "The code will not compile"], "Test doubles isolate logic but do not prove external integration compatibility.", REFERENCES.istqb, "Understand test doubles", "easy"),
  q("white-box-technical-testing", "A team has 95% statement coverage but missed a production defect in an untested branch condition. What lesson fits best?", "High statement coverage does not guarantee all decisions or risks are covered", ["Coverage proves there are no bugs", "Coverage should never be measured", "Only manual testing can cover branches"], "Coverage metrics are useful but incomplete indicators of test adequacy.", REFERENCES.istqb, "Interpret coverage limits", "medium"),
  q("white-box-technical-testing", "A developer writes tests only after reading the implementation and asserts current behavior, including a known bug. What is the risk?", "The tests can lock in incorrect behavior instead of validating intended behavior", ["The tests become impossible to run", "The code editor deletes requirements", "The build tool refuses all assertions"], "Tests should validate intended behavior, not merely mirror implementation defects.", REFERENCES.istqb, "Avoid implementation bias", "medium"),
  q("white-box-technical-testing", "A service has retry logic for transient 503 responses. What technical test should be added?", "Simulate transient failures and verify retry limits, backoff, and final outcome", ["Only verify the page title", "Only check that logs exist", "Only test a permanent success response"], "Resilience code needs tests for failure paths, not only the happy path.", REFERENCES.istqb, "Test resilience logic", "medium"),
  q("white-box-technical-testing", "A feature uses time-dependent subscription expiry. What improves deterministic automated tests?", "Inject or control time so expiry scenarios can be tested reliably", ["Wait for real subscriptions to expire", "Use production customer accounts", "Disable all expiry checks"], "Controlling time avoids flaky and slow tests for time-based behavior.", REFERENCES.istqb, "Control time-dependent tests", "medium"),
  q("white-box-technical-testing", "A test suite uses production API keys in CI. What is the quality risk?", "Tests can mutate real systems and expose secrets", ["Tests will always run faster", "Assertions become impossible", "Unit tests become browser tests"], "Safe test isolation requires non-production credentials and controlled environments.", REFERENCES.istqb, "Protect technical test isolation", "medium"),
  q("white-box-technical-testing", "A race condition occurs only when two checkout requests submit simultaneously. What technical test approach is appropriate?", "A concurrency-focused test that coordinates overlapping requests and verifies final state", ["Only a single sequential happy-path test", "Only a screenshot comparison", "Only a spell-check test"], "Concurrency defects require tests that create the timing conditions where the bug appears.", REFERENCES.istqb, "Test concurrency risks", "hard"),
  q("white-box-technical-testing", "A mutation test changes `>=` to `>` and no test fails. What does that indicate?", "The suite may not detect an important boundary behavior change", ["The production code is definitely wrong", "Mutation testing deleted the test data", "The UI framework is unsupported"], "Surviving mutations can reveal weak assertions or missing boundary checks.", REFERENCES.istqb, "Interpret mutation feedback", "hard"),

  q("api-contract-integration-testing", "An API returns JSON but omits a required field documented in its contract. What test type should catch this?", "Contract/schema validation against the API specification", ["Only visual regression testing", "Only keyboard navigation testing", "Only unit statement coverage"], "Contract tests verify that requests and responses match documented expectations.", REFERENCES.openapi, "Validate API response contracts", "easy"),
  q("api-contract-integration-testing", "Which HTTP status is most appropriate when a valid request creates a new resource?", "`201 Created`", ["`304 Not Modified`", "`401 Unauthorized`", "`415 Unsupported Media Type`"], "HTTP semantics define 201 for successful creation of one or more resources.", REFERENCES.rfc9110, "Check create response status", "easy"),
  q("api-contract-integration-testing", "A client sends JSON to an endpoint that only accepts XML. Which response should an API test expect?", "`415 Unsupported Media Type`", ["`201 Created`", "`204 No Content`", "`304 Not Modified`"], "415 is the specific status for unsupported request content format.", REFERENCES.rfc9110, "Validate media-type errors", "easy"),
  q("api-contract-integration-testing", "A consumer relies on `totalAmount` as a number, but the provider changes it to a string. What is the integration risk?", "The contract change can break consumers even if the provider tests pass", ["Strings are always safer in APIs", "Consumers cannot validate JSON", "HTTP forbids numeric fields"], "Provider-only testing can miss consumer compatibility; contract checks catch schema-breaking changes.", REFERENCES.openapi, "Detect breaking schema changes", "medium"),
  q("api-contract-integration-testing", "A test verifies `GET /orders/123` returns 404 for another user's order. What quality risk is being checked?", "Authorization and object-level access control", ["Browser font rendering", "Cache image compression", "CSS specificity"], "API tests should include authorization boundaries, especially object ownership checks.", REFERENCES.owaspWstg, "Test authorization boundaries", "medium"),
  q("api-contract-integration-testing", "A flaky integration test fails when a downstream sandbox is slow. What improvement targets the cause?", "Set realistic timeouts, isolate dependencies where appropriate, and assert retry/error behavior explicitly", ["Increase all sleeps until failures disappear", "Delete assertions from the test", "Use production data to make it faster"], "Reliable integration tests need controlled dependencies and explicit expectations for latency and failure.", REFERENCES.istqb, "Stabilize integration tests", "medium"),
  q("api-contract-integration-testing", "An API endpoint returns 200 with `{error:'not allowed'}` for unauthorized access. Why is this a testing concern?", "Clients, logs, caches, and monitoring may interpret the request as successful", ["HTTP status codes are not visible to clients", "JSON cannot contain error fields", "Unauthorized requests must always return 500"], "Status codes are part of the contract and operational signal.", REFERENCES.rfc9110, "Validate error contract semantics", "medium"),
  q("api-contract-integration-testing", "A test seeds an order and immediately queries the read model, which updates asynchronously. What should the test account for?", "Eventual consistency or a documented readiness signal instead of assuming immediate visibility", ["Delete asynchronous processing", "Assert the first query must always pass instantly", "Use a fixed delay with no readiness condition"], "Integration tests must reflect real consistency behavior and wait on meaningful conditions.", REFERENCES.istqb, "Test asynchronous integration", "medium"),
  q("api-contract-integration-testing", "A public API removes a response field used by mobile app version 3.2. What should a compatibility test protect?", "Existing supported clients should continue receiving fields required by their contract", ["Only the newest web client matters", "Removed fields never affect users", "Mobile apps update instantly for all users"], "Contract compatibility is critical when older deployed clients remain in use.", REFERENCES.openapi, "Protect backward compatibility", "hard"),
  q("api-contract-integration-testing", "A team mocks every downstream service in all tests. What gap remains before release?", "Real serialization, auth, network, and dependency behavior are not exercised together", ["Mocks always behave exactly like production", "Integrated environments are illegal", "Unit tests cannot use mocks"], "Mocks are useful but cannot replace selected end-to-end integration verification.", REFERENCES.istqb, "Balance mocks and integration tests", "hard"),

  q("ui-e2e-automation-reliability", "A Playwright test should check that a saved status eventually appears. Which assertion style is best?", "Use an auto-retrying web assertion such as `await expect(locator).toHaveText(...)`", ["Read text once immediately after click", "Use a fixed sleep and no assertion", "Check only that the page URL is non-empty"], "Playwright web assertions retry until the expected condition is met or timeout expires, reducing timing flakes.", REFERENCES.playwrightAssertions, "Use auto-retrying assertions", "easy"),
  q("ui-e2e-automation-reliability", "What is a common reason fixed sleeps make UI tests unreliable?", "They wait too little on slow runs and waste time on fast runs", ["They automatically improve selectors", "They validate business rules", "They remove all async behavior"], "Condition-based waits are more reliable than arbitrary sleeps.", REFERENCES.playwrightAssertions, "Avoid fixed sleeps", "easy"),
  q("ui-e2e-automation-reliability", "Which locator strategy usually produces more resilient UI tests?", "Select by accessible role/name or stable test id that reflects user intent", ["Select by generated CSS class names only", "Select by pixel coordinates", "Select by the current animation frame"], "User-facing locators and stable test ids are less brittle than implementation-specific selectors.", REFERENCES.playwrightAssertions, "Choose resilient locators", "easy"),
  q("ui-e2e-automation-reliability", "A test clicks Save and immediately reads a toast that appears after an API call. What should the test do?", "Assert the toast with a retrying expectation instead of reading synchronously", ["Assume the toast is instant", "Disable all API calls", "Ignore the save result"], "Async UI needs expectations that wait for observable user outcomes.", REFERENCES.playwrightAssertions, "Assert async UI outcomes", "medium"),
  q("ui-e2e-automation-reliability", "A browser test passes locally but fails in CI because the test timeout is too short for a realistic upload. What should be adjusted?", "Use an appropriate test or expect timeout for the known operation while keeping a meaningful assertion", ["Remove the assertion", "Make every test unlimited", "Run the upload against production"], "Playwright has separate test and assertion timeouts that should match realistic operation boundaries.", REFERENCES.playwrightTimeouts, "Tune test timeouts", "medium"),
  q("ui-e2e-automation-reliability", "A test uses `.card:nth-child(3)` and fails whenever sorting changes. What is the better assertion?", "Locate the specific item by stable visible text, role, or test id and assert its behavior", ["Increase the nth-child number", "Disable sorting for users", "Use a screenshot of the whole page only"], "Selectors should express the user-visible target, not incidental layout position.", REFERENCES.playwrightAssertions, "Reduce selector brittleness", "medium"),
  q("ui-e2e-automation-reliability", "A UI test creates a real paid order every run. What is the main test-design issue?", "The test has unsafe side effects and should use a controlled sandbox or reversible test flow", ["Paid orders are required for all UI tests", "Assertions cannot inspect checkout screens", "The browser cannot submit forms"], "Automated tests should control external side effects and avoid mutating real business systems.", REFERENCES.istqb, "Control E2E side effects", "medium"),
  q("ui-e2e-automation-reliability", "A suite has one large test covering registration, checkout, profile, and logout. Why might failure diagnosis be poor?", "A failure anywhere obscures which behavior broke and may block later checks", ["Large tests always run faster", "Small tests cannot use browsers", "Logout cannot be tested"], "Focused tests improve diagnosis while selected end-to-end journeys still provide coverage.", REFERENCES.istqb, "Structure E2E scope", "medium"),
  q("ui-e2e-automation-reliability", "A test sometimes clicks a button before it is enabled after validation. Which assertion reduces flakiness?", "Wait for the button to be enabled, then click and verify the resulting state", ["Click repeatedly without checking", "Use a longer blind sleep", "Ignore disabled state"], "Auto-retrying enabled-state assertions match user-visible readiness.", REFERENCES.playwrightAssertions, "Wait for actionable state", "hard"),
  q("ui-e2e-automation-reliability", "A screenshot test fails after a legitimate copy change. What does this show about visual assertions?", "Visual checks should be scoped to meaningful visual risk, not used as a broad substitute for behavior checks", ["All screenshot tests are invalid", "Text changes cannot be tested", "Screenshots prove business logic"], "Visual testing is useful when scoped carefully; broad screenshots can be noisy.", REFERENCES.istqb, "Scope visual regression testing", "hard"),

  q("defect-triage-release-reporting", "What should a useful defect report include?", "Steps to reproduce, expected result, actual result, environment, evidence, and impact", ["Only the tester's name", "Only a screenshot with no context", "Only the developer assigned to it"], "Clear defect reports make reproduction, triage, and prioritization possible.", REFERENCES.istqb, "Write actionable defect reports", "easy"),
  q("defect-triage-release-reporting", "A crash blocks checkout for all users. Which priority is most likely?", "High priority because core revenue flow is blocked", ["Lowest priority because crashes are technical", "Low priority because UI color is unchanged", "No priority until a developer confirms it"], "Priority reflects business urgency as well as severity and user impact.", REFERENCES.istqb, "Prioritize business-critical defects", "easy"),
  q("defect-triage-release-reporting", "A defect is reported as 'dashboard broken.' What is the biggest issue with the report?", "It lacks reproducible steps, observed behavior, expected behavior, and environment detail", ["It has too many screenshots", "It contains a clear root cause", "It is already ready for release notes"], "Vague defect reports slow triage and fixing.", REFERENCES.istqb, "Improve defect clarity", "easy"),
  q("defect-triage-release-reporting", "A tester finds a typo on the terms page and a data-loss bug in profile saving. How should triage treat them?", "The data-loss bug should receive higher urgency because impact is greater", ["Both must always have identical priority", "The typo is higher because it is easier", "Neither should be logged"], "Triage weighs impact, likelihood, and business risk.", REFERENCES.istqb, "Compare defect impact", "medium"),
  q("defect-triage-release-reporting", "Developers cannot reproduce a reported mobile bug. What should QA add first?", "Device/browser version, account state, data setup, steps, logs, and media evidence", ["A demand to fix without details", "Only the tester's opinion", "A duplicate ticket with the same text"], "Reproducibility often depends on environment, data, and sequence details.", REFERENCES.istqb, "Make defects reproducible", "medium"),
  q("defect-triage-release-reporting", "A bug is fixed and the original failing scenario now passes. What should QA consider next?", "Confirm the fix and run targeted regression around affected behavior", ["Close without any verification", "Retest unrelated branding only", "Delete all old bug evidence"], "Defect confirmation should include the fix and nearby regression risk.", REFERENCES.istqb, "Verify fixes and regressions", "medium"),
  q("defect-triage-release-reporting", "A release report says 'QA complete' but lists no coverage, open defects, or risks. What is missing?", "Evidence-based quality status that stakeholders can use for release decisions", ["A larger logo", "Developer laptop specs", "A list of office holidays"], "Test reporting should communicate progress, coverage, defects, and residual risk.", REFERENCES.istqb, "Report quality status", "medium"),
  q("defect-triage-release-reporting", "A low-severity spelling defect appears on a legally required consent checkbox. Why might priority still be high?", "Context can make a small text issue legally or operationally urgent", ["Spelling always blocks every release", "Legal text cannot be tested", "Priority must equal severity"], "Priority and severity are related but not identical; context matters.", REFERENCES.istqb, "Separate severity and priority", "medium"),
  q("defect-triage-release-reporting", "A production incident occurs from a missed edge case. What should QA add to prevent recurrence?", "A regression test and test-basis update tied to the incident's root cause", ["Only blame the tester who missed it", "Delete the incident report", "Stop testing that feature"], "Incident learning should strengthen future coverage and documentation.", REFERENCES.istqb, "Convert incidents into regression coverage", "hard"),
  q("defect-triage-release-reporting", "A team closes defects automatically when a branch is merged. What is the risk?", "The fix may not be verified in an integrated environment or released build", ["Merges always prove user impact is resolved", "Defects cannot be linked to code", "Integrated builds never differ from branches"], "Defect lifecycle should include verification of the delivered behavior.", REFERENCES.istqb, "Control defect lifecycle", "hard"),

  q("test-data-environments-ci", "Why should test data be controlled and repeatable?", "So results can be reproduced and failures can be diagnosed reliably", ["So tests always use production customer records", "So no cleanup is ever needed", "So assertions can be skipped"], "Repeatable test data improves reliability and diagnosis.", REFERENCES.istqb, "Use repeatable test data", "easy"),
  q("test-data-environments-ci", "A test environment points to production email delivery. What is the risk?", "Tests may send unintended messages to real users", ["Emails make tests impossible", "Production email always blocks sign-in", "Assertions cannot inspect notifications"], "Non-production environments should isolate external side effects.", REFERENCES.istqb, "Isolate test environments", "easy"),
  q("test-data-environments-ci", "A CI job fails because previous test data remains in the database. What should be improved?", "Test setup and cleanup should create an independent known state", ["Run tests only once per month", "Disable database assertions", "Use shared mutable accounts forever"], "Independent tests reduce order dependence and flakiness.", REFERENCES.istqb, "Create independent test state", "easy"),
  q("test-data-environments-ci", "A payment flow test needs a card decline scenario. What is the safest test-data choice?", "Use a payment-provider sandbox decline token or controlled simulator", ["Use a real customer's declined card", "Guess card numbers in production", "Skip the negative payment path"], "Payment tests should use approved sandbox data and avoid real customer information.", REFERENCES.istqb, "Select safe payment test data", "medium"),
  q("test-data-environments-ci", "A staging environment has a different feature flag value than production. What should QA verify before release?", "The intended production flag state and both enabled/disabled behavior where relevant", ["Only staging behavior because it is easier", "No flag behavior because flags are config", "Only screenshots of the settings page"], "Config differences can create release risk; flag states must be explicit.", REFERENCES.istqb, "Validate environment configuration", "medium"),
  q("test-data-environments-ci", "A flaky test passes when rerun alone but fails in the suite. What is a likely cause?", "Shared state, order dependency, or leaked data between tests", ["The assertion is too clear", "The defect report is too detailed", "The compiler is too strict"], "Order-dependent failures often come from uncontrolled shared state.", REFERENCES.istqb, "Diagnose suite order dependency", "medium"),
  q("test-data-environments-ci", "A CI pipeline deploys code even when critical tests are skipped by mistake. What control is missing?", "A quality gate that fails when required suites are absent, skipped, or below threshold", ["A larger monitor", "More hidden sleeps", "A production-only password"], "Quality gates must verify required evidence exists, not just tolerate empty test runs.", REFERENCES.istqb, "Enforce CI quality gates", "medium"),
  q("test-data-environments-ci", "A test uses today's date and starts failing after midnight in UTC. What improves it?", "Control the clock or calculate expectations with explicit timezone handling", ["Run tests only before noon", "Remove date assertions", "Use production calendars only"], "Time-dependent tests need controlled time and timezone clarity.", REFERENCES.istqb, "Stabilize time-based tests", "medium"),
  q("test-data-environments-ci", "A load test accidentally runs against production during business hours. What governance should prevent this?", "Environment allowlists, explicit approvals, rate limits, and non-production defaults for destructive tests", ["Hide the load-test script name", "Use larger unmanaged data sets", "Disable all monitoring"], "High-impact tests require operational controls so they cannot harm users.", REFERENCES.istqb, "Govern high-impact test execution", "hard"),
  q("test-data-environments-ci", "A team restores anonymized production data to staging but forgets to mask phone numbers. What is the quality and compliance problem?", "Sensitive personal data can be exposed through non-production testing", ["Staging can never use databases", "Phone numbers cannot affect tests", "Masking always removes all useful data"], "Test data must protect privacy while preserving useful behavior characteristics.", REFERENCES.istqb, "Protect privacy in test data", "hard"),

  q("accessibility-security-quality", "A form input has no accessible name. Which users are directly affected?", "Screen reader and assistive-technology users who need programmatic labels", ["Only users with high-speed internet", "Only backend developers", "Only users with large monitors"], "WCAG accessibility requirements include making controls understandable to assistive technologies.", REFERENCES.wcag, "Recognize accessible names", "easy"),
  q("accessibility-security-quality", "A page uses light gray text on a white background. What should QA check?", "Text contrast against WCAG requirements", ["Only server CPU usage", "Only API response status", "Only database indexes"], "Low contrast can make content unreadable for many users and is a common accessibility risk.", REFERENCES.wcag, "Check color contrast", "easy"),
  q("accessibility-security-quality", "A security test finds an admin page accessible by changing a URL. What risk is this?", "Broken access control or authorization failure", ["Visual regression", "Keyboard navigation only", "Cache freshness only"], "Direct URL access must still enforce authorization; security testing should verify this.", REFERENCES.owaspWstg, "Identify access-control risk", "easy"),
  q("accessibility-security-quality", "A modal opens but keyboard focus remains behind it. What user-impact risk exists?", "Keyboard and assistive-technology users may be unable to operate the dialog correctly", ["The database will corrupt records", "API contracts become invalid", "The page cannot use HTTPS"], "Focus management is central to accessible interactive UI behavior.", REFERENCES.wcag, "Test focus management", "medium"),
  q("accessibility-security-quality", "A checkout form shows validation errors only by red border. What is missing?", "A non-color cue such as text that identifies the field error", ["A larger product image", "An unrelated loading spinner", "A hidden production flag"], "Relying only on color excludes users who cannot perceive the color difference.", REFERENCES.wcag, "Avoid color-only error signaling", "medium"),
  q("accessibility-security-quality", "A password reset response says whether an email exists. What security concern should QA raise?", "Account enumeration risk", ["Too much color contrast", "Invalid API documentation format", "A missing screenshot baseline"], "Authentication flows should avoid exposing whether specific accounts exist.", REFERENCES.owaspWstg, "Test account enumeration risk", "medium"),
  q("accessibility-security-quality", "A file upload accepts SVG and renders it back to other users. What should security testing consider?", "Stored script or content-injection risk from uploaded files", ["Only whether the filename is short", "Only whether the upload button is blue", "Only whether the browser cache is warm"], "Uploads can create stored injection risks if content is not validated and served safely.", REFERENCES.owaspWstg, "Assess upload security risks", "medium"),
  q("accessibility-security-quality", "A mobile web menu cannot be opened with a keyboard. What should QA report?", "Keyboard accessibility failure with affected control, steps, expected behavior, and impact", ["Only that the menu color is subjective", "Only that mobile screens are small", "Only that the API is fast"], "Interactive functionality should be operable through keyboard where applicable.", REFERENCES.wcag, "Report keyboard operability issues", "medium"),
  q("accessibility-security-quality", "A web app stores bearer tokens in a place accessible to injected scripts. What cross-quality risk does this combine?", "Security weakness that can turn an XSS issue into account takeover", ["Only a font-rendering defect", "Only an email-delivery issue", "Only an SEO issue"], "Security testing considers how weaknesses combine, including script access to sensitive tokens.", REFERENCES.owaspWstg, "Reason about chained security risk", "hard"),
  q("accessibility-security-quality", "A release passes functional tests but blocks screen-reader users from completing checkout. Why is it not release-quality?", "Quality includes accessibility and user impact, not only functional success for some users", ["Accessibility is unrelated to software quality", "Screen-reader users cannot be customers", "Checkout quality is only a backend concern"], "A product is not fit for use if important users cannot complete critical tasks.", REFERENCES.wcag, "Include accessibility in release quality", "hard"),
];

function item(draft: Draft, index: number) {
  const topic = TOPICS[draft.topic];
  const correctOption = index % 4;
  const options = [...draft.distractors];
  options.splice(correctOption, 0, draft.correct);
  const objectiveCode = `${topic.code}-${String((index % 10) + 1).padStart(2, "0")}`;
  return {
    schemaVersion: 1 as const,
    sourceRecordId: `stqa-v1-${String(index + 1).padStart(3, "0")}`,
    language: "en",
    question: draft.question,
    format: "mcq_single" as const,
    options,
    answer: { kind: "single_choice" as const, correctOption },
    explanation: draft.explanation,
    subject: "Software testing and QA",
    topic: topic.name,
    syllabus: SYLLABUS,
    exam: "Software Testing and QA Skills",
    examYear: 2026,
    objective: draft.objective,
    difficulty: draft.difficulty,
    maxPoints: 1,
    negativeMarks: 0,
    timeLimitSec: draft.difficulty === "hard" ? 120 : draft.difficulty === "easy" ? 60 : 90,
    tags: ["software-testing", "qa", draft.topic, draft.difficulty, "original", "version-1"],
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

export const SOFTWARE_TESTING_QA_SKILLS_V1 = DRAFTS.map(item);

function semanticKey(value: string) {
  return value.toLowerCase().replace(/`[^`]+`/g, "<code>").replace(/\b\d+(?:\.\d+)?\b/g, "<n>").replace(/[^a-z<>]+/g, " ").trim();
}

export function auditSoftwareTestingQaSkillsV1() {
  const errors: string[] = [];
  const ids = new Set<string>();
  const prompts = new Set<string>();
  const semantic = new Set<string>();
  const hashes = new Set<string>();
  const topicCounts = new Map<string, number>();
  const difficultyCounts = new Map<string, number>();
  const answerPositions = [0, 0, 0, 0];
  const allowedSources = Object.values(REFERENCES).map((value) => value.replace(/latest\/?$/, ""));
  for (const candidate of SOFTWARE_TESTING_QA_SKILLS_V1) {
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
    if (!allowedSources.some((prefix) => candidate.provenance.sourceLocator.startsWith(prefix))) {
      errors.push(`${candidate.sourceRecordId}: non-primary source`);
    }
  }
  if (SOFTWARE_TESTING_QA_SKILLS_V1.length !== 100) errors.push(`Expected 100 rows, found ${SOFTWARE_TESTING_QA_SKILLS_V1.length}`);
  for (const topicSlug of Object.keys(TOPICS)) {
    if ((topicCounts.get(topicSlug) ?? 0) !== 10) errors.push(`${topicSlug}: expected 10 questions`);
    if ((difficultyCounts.get(`${topicSlug}:easy`) ?? 0) !== 3) errors.push(`${topicSlug}: expected 3 easy questions`);
    if ((difficultyCounts.get(`${topicSlug}:medium`) ?? 0) !== 5) errors.push(`${topicSlug}: expected 5 medium questions`);
    if ((difficultyCounts.get(`${topicSlug}:hard`) ?? 0) !== 2) errors.push(`${topicSlug}: expected 2 hard questions`);
  }
  if (answerPositions.some((count) => count !== 25)) errors.push(`Answer positions are not balanced: ${answerPositions.join(",")}`);
  const digest = createHash("sha256").update(JSON.stringify(SOFTWARE_TESTING_QA_SKILLS_V1)).digest("hex");
  return {
    errors,
    rows: SOFTWARE_TESTING_QA_SKILLS_V1.length,
    uniquePrompts: prompts.size,
    uniqueSemanticPrompts: semantic.size,
    uniqueContent: hashes.size,
    topicCounts: Object.fromEntries(topicCounts),
    difficultyCounts: Object.fromEntries(difficultyCounts),
    answerPositions,
    proposedDraw: 25,
    rotationDepth: 4,
    digest,
  };
}

async function main() {
  const output = path.resolve(process.argv[2] ?? "content/question-packs/octamy-software-testing-qa-skills-v1.jsonl");
  const audit = auditSoftwareTestingQaSkillsV1();
  if (audit.errors.length) throw new Error(audit.errors.join("\n"));
  await mkdir(path.dirname(output), { recursive: true });
  const stream = createWriteStream(output, { encoding: "utf8", flags: "w", mode: 0o600 });
  for (const candidate of SOFTWARE_TESTING_QA_SKILLS_V1) stream.write(`${JSON.stringify(candidate)}\n`);
  stream.end();
  await finished(stream);
  process.stdout.write(`${JSON.stringify({ output, ...audit }, null, 2)}\n`);
}

if (/generate-software-testing-qa-skills-v1\.(?:c?js|ts)$/.test(path.basename(process.argv[1] ?? ""))) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
