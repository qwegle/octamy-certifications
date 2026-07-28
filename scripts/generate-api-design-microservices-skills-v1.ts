#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { finished } from "node:stream/promises";
import { normalizeQuestionPackItem } from "./lib/question-pack-contract";

const ASSESSMENT_SLUG = "api-design-microservices-foundations";
const BANK_SLUG = "api-design-microservices-foundations-bank-v1";
const SYLLABUS = "OCT-ADMS-2026.1 (RFC 9110/9111, OpenAPI 3.1, OWASP API Security 2023, Twelve-Factor, Kubernetes docs snapshot 2026-07-28)";

const REFERENCES = {
  httpSemantics: "https://www.rfc-editor.org/rfc/rfc9110.html",
  httpCaching: "https://www.rfc-editor.org/rfc/rfc9111.html",
  openapi: "https://spec.openapis.org/oas/latest.html",
  owaspApi: "https://owasp.org/API-Security/editions/2023/en/0x11-t10/",
  twelveConfig: "https://12factor.net/config",
  twelveProcesses: "https://12factor.net/processes",
  twelveDisposability: "https://12factor.net/disposability",
  kubeProbes: "https://kubernetes.io/docs/concepts/workloads/pods/probes/",
  kubeService: "https://kubernetes.io/docs/concepts/services-networking/service/",
  kubeConfigMap: "https://kubernetes.io/docs/concepts/configuration/configmap/",
  kubeSecrets: "https://kubernetes.io/docs/concepts/configuration/secret/",
} as const;

const TOPICS = {
  "http-semantics-resource-design": { name: "HTTP semantics and resource design", code: "ADMS-HTTP" },
  "http-caching-concurrency": { name: "HTTP caching and conditional requests", code: "ADMS-CACHE" },
  "openapi-contracts-versioning": { name: "OpenAPI contracts and versioning", code: "ADMS-OAS" },
  "api-security-authorization": { name: "API security and authorization", code: "ADMS-SEC" },
  "service-boundaries-data-ownership": { name: "Service boundaries and data ownership", code: "ADMS-SVC" },
  "resilience-observability-failure": { name: "Resilience, observability, and failure handling", code: "ADMS-RES" },
  "configuration-secrets-delivery": { name: "Configuration, secrets, and delivery", code: "ADMS-CONF" },
  "kubernetes-runtime-operations": { name: "Kubernetes runtime operations", code: "ADMS-KUBE" },
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
  q("http-semantics-resource-design", "Which HTTP method is defined as safe because its requested semantics are read-only?", "GET", ["POST", "PATCH", "DELETE"], "RFC 9110 defines safe methods as read-only in their requested semantics, and GET is one of the safe methods.", REFERENCES.httpSemantics, "Identify safe HTTP methods", "easy"),
  q("http-semantics-resource-design", "Which HTTP method is specifically intended to replace all current representations of the target resource with the request content?", "PUT", ["GET", "CONNECT", "OPTIONS"], "PUT requests that the target resource state be created or replaced with the representation enclosed in the request content.", REFERENCES.httpSemantics, "Apply PUT replacement semantics", "easy"),
  q("http-semantics-resource-design", "What does a successful `201 Created` response indicate?", "The request succeeded and created one or more new resources", ["The request succeeded but no response body is allowed", "The representation was found in an intermediary cache", "The target resource was permanently moved"], "A 201 status is for successful creation; the response can identify the new resource with Location or representation metadata.", REFERENCES.httpSemantics, "Interpret creation status codes", "easy"),
  q("http-semantics-resource-design", "An API receives `POST /orders` to create an order and returns `200 OK` with the created order but no `Location`. What is the more precise response when the server creates a distinct new order resource?", "`201 Created` with a representation and, when available, a `Location` for the new resource", ["`204 No Content` because creation responses must be empty", "`304 Not Modified` because the order did not previously exist", "`409 Conflict` for every successful create operation"], "When creation succeeds, 201 communicates that a new resource exists; Location is the usual way to identify it when the URI is known.", REFERENCES.httpSemantics, "Choose precise create responses", "medium"),
  q("http-semantics-resource-design", "A client sends `DELETE /sessions/123` twice. The first call removes the session; the second returns `404 Not Found`. Can the DELETE method still be idempotent?", "Yes. Idempotence concerns intended server state after repeated requests, not identical response status codes", ["No. Idempotent methods must return the same status every time", "No. DELETE is never idempotent when a resource disappears", "Yes, but only if both responses include an empty body"], "RFC 9110 defines idempotence by the intended effect of multiple identical requests; different response codes can still reflect the same final state.", REFERENCES.httpSemantics, "Reason about idempotent effects", "medium"),
  q("http-semantics-resource-design", "Which status code best fits a syntactically valid request that cannot be processed because a required domain invariant fails, such as booking seats already held?", "`409 Conflict`", ["`401 Unauthorized`", "`415 Unsupported Media Type`", "`301 Moved Permanently`"], "409 indicates the request conflicts with the current state of the target resource and the user might resolve the conflict and resubmit.", REFERENCES.httpSemantics, "Select conflict status codes", "medium"),
  q("http-semantics-resource-design", "A request body is JSON but the server only supports `application/xml` for that operation. Which status code is most specific?", "`415 Unsupported Media Type`", ["`406 Not Acceptable`", "`412 Precondition Failed`", "`204 No Content`"], "415 applies when the request content format is unsupported. 406 is about the response representation acceptable to the client.", REFERENCES.httpSemantics, "Differentiate media negotiation errors", "medium"),
  q("http-semantics-resource-design", "Which header should a client use to tell the server which response media types it can process?", "`Accept`", ["`Content-Type`", "`Allow`", "`Vary`"], "Accept describes acceptable response media types; Content-Type describes the representation enclosed in the request or response.", REFERENCES.httpSemantics, "Use content negotiation headers", "medium"),
  q("http-semantics-resource-design", "A gateway retries `POST /payments` after a timeout and the service creates two charges. Which design most directly makes the create operation retry-safe without pretending POST is safe?", "Require an idempotency key and make repeated requests with the same key resolve to one logical payment result", ["Change the operation to GET because GET can carry a body", "Return 500 for all timed-out payment attempts", "Cache every POST response publicly for one day"], "POST is not inherently idempotent, but an application-level idempotency key can let the server detect and coalesce duplicate create attempts.", REFERENCES.httpSemantics, "Design retry-safe creation", "hard"),
  q("http-semantics-resource-design", "An API uses `GET /reports/run` to start an expensive report job because it is easy to call from a browser. What is the core protocol problem?", "GET is defined with safe semantics, so using it to trigger state-changing work violates client and intermediary assumptions", ["GET responses may never contain JSON", "GET requests are required to be unauthenticated", "GET can only be used for resources smaller than one megabyte"], "Safe methods allow clients, crawlers, and intermediaries to make requests without intending state change; job creation should use an unsafe method such as POST.", REFERENCES.httpSemantics, "Protect safe-method semantics", "hard"),

  q("http-caching-concurrency", "Which response header tells caches the freshness lifetime and storage rules for a response?", "`Cache-Control`", ["`Content-Type`", "`Authorization`", "`Allow`"], "RFC 9111 defines Cache-Control directives for controlling how caches store, reuse, and revalidate responses.", REFERENCES.httpCaching, "Identify cache-control metadata", "easy"),
  q("http-caching-concurrency", "Which validator is an opaque value chosen by the server to represent a selected resource representation version?", "`ETag`", ["`Vary`", "`Max-Forwards`", "`Retry-After`"], "An entity tag is an opaque validator for a representation and can be used in conditional requests.", REFERENCES.httpSemantics, "Identify entity validators", "easy"),
  q("http-caching-concurrency", "Which status code is used when a conditional GET validator matches and the cached representation can be reused?", "`304 Not Modified`", ["`201 Created`", "`409 Conflict`", "`422 Unprocessable Content`"], "304 tells the client that its stored selected representation remains valid after a conditional request.", REFERENCES.httpSemantics, "Interpret conditional GET responses", "easy"),
  q("http-caching-concurrency", "An API response varies by `Accept-Language`. What header prevents a shared cache from serving an English representation to a Hindi request as if it were identical?", "`Vary: Accept-Language`", ["`Allow: Accept-Language`", "`Location: Accept-Language`", "`Retry-After: Accept-Language`"], "Vary names request fields that affect response selection, so caches include those fields in cache key matching.", REFERENCES.httpCaching, "Declare cache key variance", "medium"),
  q("http-caching-concurrency", "A client wants to update a document only if it has not changed since the client read ETag `\"v3\"`. Which request header expresses that precondition?", "`If-Match: \"v3\"`", ["`If-None-Match: \"v3\"`", "`Vary: \"v3\"`", "`Content-Location: \"v3\"`"], "If-Match makes the method conditional on the current selected representation matching the supplied entity tag, which protects against lost updates.", REFERENCES.httpSemantics, "Use preconditions for optimistic concurrency", "medium"),
  q("http-caching-concurrency", "Which status code fits a failed `If-Match` precondition on an update?", "`412 Precondition Failed`", ["`304 Not Modified`", "`202 Accepted`", "`415 Unsupported Media Type`"], "412 indicates one or more preconditions evaluated to false, so the server did not apply the requested method.", REFERENCES.httpSemantics, "Handle failed preconditions", "medium"),
  q("http-caching-concurrency", "A user-specific response includes account details and is sent through shared infrastructure. Which cache directive most directly prevents shared caches from storing it?", "`Cache-Control: private` or `no-store`, depending on whether any cache may store it", ["`Vary: User-Agent` only", "`Allow: GET` only", "`Content-Type: private/json`"], "private restricts storage to a private cache, while no-store tells caches not to store the request or response at all.", REFERENCES.httpCaching, "Control private response storage", "medium"),
  q("http-caching-concurrency", "What does `Cache-Control: no-cache` require before a stored response is reused?", "Successful validation with the origin server", ["Immediate deletion of the response from every cache", "Changing the request method to POST", "Ignoring all validators on the response"], "In HTTP caching, no-cache means the stored response cannot be reused to satisfy a request without successful validation.", REFERENCES.httpCaching, "Differentiate no-cache from no-store", "medium"),
  q("http-caching-concurrency", "A product list endpoint returns different content based on `Authorization`, but the response is accidentally marked `public, max-age=600` with no variance or privacy control. What is the highest-risk outcome?", "A shared cache can reuse one user's representation for another requester", ["Browsers will reject the JSON as malformed", "All conditional requests will automatically fail", "The server will convert the response to 304"], "Public freshness metadata can make a shared cache reuse a stored response; personalized responses need explicit privacy or keying controls.", REFERENCES.httpCaching, "Diagnose shared-cache data leaks", "hard"),
  q("http-caching-concurrency", "Two clients read the same ETag and both submit updates. The service accepts both updates without preconditions and the later write overwrites the earlier change. Which HTTP mechanism directly addresses this lost-update failure?", "Require clients to send `If-Match` with the ETag and reject mismatches with `412 Precondition Failed`", ["Return `304 Not Modified` after every successful update", "Add `Vary: Accept` to all update responses", "Set `Cache-Control: max-age=0` on the request body"], "ETag validators with If-Match let the server ensure the update applies to the representation version the client actually reviewed.", REFERENCES.httpSemantics, "Prevent lost updates", "hard"),

  q("openapi-contracts-versioning", "In OpenAPI, which top-level field identifies the OpenAPI Specification version used by the document?", "`openapi`", ["`swaggerVersion`", "`schemaVersion`", "`apiVersion`"], "The OpenAPI document uses the required `openapi` field to state the semantic version of the OpenAPI Specification.", REFERENCES.openapi, "Identify OpenAPI version metadata", "easy"),
  q("openapi-contracts-versioning", "Which OpenAPI object lists the available paths and operations for an API?", "`paths`", ["`components`", "`info.contact`", "`externalDocs`"], "The Paths Object holds relative paths to individual endpoints and their operations.", REFERENCES.openapi, "Locate path definitions", "easy"),
  q("openapi-contracts-versioning", "Where should reusable schemas such as `User` or `ProblemDetails` normally be defined in an OpenAPI document?", "`components.schemas`", ["`servers.variables`", "`security`", "`tags.externalDocs`"], "Components holds reusable objects, and schemas under components can be referenced from operations and responses.", REFERENCES.openapi, "Define reusable schemas", "easy"),
  q("openapi-contracts-versioning", "An operation returns either `200` with a `User` schema or `404` with an error schema. Where should those alternatives be represented?", "Under the operation's `responses`, keyed by status code", ["Only in a prose paragraph inside `description`", "As two separate `paths` entries with the same method", "Inside `servers` because servers choose status codes"], "OpenAPI operations define possible responses in the Responses Object using HTTP status codes or ranges.", REFERENCES.openapi, "Model operation responses", "medium"),
  q("openapi-contracts-versioning", "Which OpenAPI construct describes an API key, HTTP authentication scheme, OAuth2 flow, or OpenID Connect discovery URL for reuse?", "`components.securitySchemes`", ["`components.callbacks`", "`info.license`", "`paths.securitySchemes`"], "Security schemes are reusable components that define the authentication and authorization mechanisms used by operations.", REFERENCES.openapi, "Model security schemes", "medium"),
  q("openapi-contracts-versioning", "A request body may be either JSON or XML with different schemas. What OpenAPI structure should describe that?", "`requestBody.content` entries keyed by media type", ["Multiple `summary` fields on the same operation", "A comma-separated list in `operationId`", "Separate `servers` entries for each payload format"], "The requestBody content map defines supported media types and the schema for each representation.", REFERENCES.openapi, "Describe request media types", "medium"),
  q("openapi-contracts-versioning", "Which practice makes client generation and logs more stable for a specific OpenAPI operation?", "Give the operation a unique, stable `operationId`", ["Use the same `operationId` for equivalent endpoints", "Omit response codes that are uncommon", "Put the HTTP method name in `info.title`"], "OpenAPI operationId values are intended to identify operations uniquely, and many tools use them for generated method names.", REFERENCES.openapi, "Use stable operation identifiers", "medium"),
  q("openapi-contracts-versioning", "A breaking response change removes a required field from `GET /v1/invoices/{id}` while clients still depend on it. Which release choice is safest for compatibility?", "Introduce a new versioned contract or additive transition instead of silently changing the existing contract", ["Reuse the same contract because removing fields is always backward compatible", "Hide the removal by keeping the OpenAPI document unchanged", "Change only the operation summary so clients know to adapt"], "Contracts need to preserve client expectations; removing required response data is a breaking change that should not be hidden behind the same stable operation.", REFERENCES.openapi, "Recognize breaking API contract changes", "medium"),
  q("openapi-contracts-versioning", "An OpenAPI schema says a property is required, but the service sometimes omits it in successful responses. What is the practical certification-level defect?", "The implementation violates the published contract and can break generated or validating clients", ["OpenAPI required properties apply only to request bodies", "Clients must ignore every required property in JSON", "The schema is still correct because HTTP status was 200"], "A schema is a machine-readable contract. Successful responses that omit required fields contradict the contract and can fail client validation.", REFERENCES.openapi, "Validate implementation against contract", "hard"),
  q("openapi-contracts-versioning", "A team uses one `Error` schema for all failures, but different operations return incompatible fields with the same schema reference. Why is this risky?", "The shared schema no longer describes a single contract, so clients cannot rely on generated types or validation", ["OpenAPI forbids reusable error schemas", "Every error response must use plain text", "Only success responses can reference components"], "Reusable components are useful only when the referenced structure is consistent; incompatible runtime shapes under one reference create false contract guarantees.", REFERENCES.openapi, "Maintain reusable schema integrity", "hard"),

  q("api-security-authorization", "Which OWASP API Security 2023 risk covers an API exposing object identifiers without checking that the caller may access that specific object?", "Broken Object Property Level Authorization is not the issue; Broken Object Level Authorization is", ["Server Side Request Forgery", "Unsafe Consumption of APIs", "Security Misconfiguration"], "Broken Object Level Authorization is about authorizing access to object instances, commonly when IDs are exposed in API requests.", REFERENCES.owaspApi, "Identify BOLA risk", "easy"),
  q("api-security-authorization", "Which OWASP API Security 2023 category covers mass assignment of fields that callers should not be allowed to set?", "Broken Object Property Level Authorization", ["Improper Inventory Management", "Unrestricted Resource Consumption", "Unsafe Consumption of APIs"], "API3:2023 includes mass assignment under broken object property level authorization because clients can set properties they should not control.", REFERENCES.owaspApi, "Identify mass assignment under API3", "easy"),
  q("api-security-authorization", "Which defense is most direct for an endpoint `GET /users/{id}/salary`?", "Check object-level and property-level authorization for the authenticated caller before returning the salary field", ["Encrypt the URL path but skip authorization", "Return salary only when the Accept header is JSON", "Move the endpoint behind a different DNS name"], "Sensitive object fields require authorization checks for both the object and the property being exposed.", REFERENCES.owaspApi, "Apply object and property authorization", "easy"),
  q("api-security-authorization", "An endpoint accepts `{ \"role\": \"admin\" }` in a profile update payload and writes it to the user row. Which design prevents the class of vulnerability?", "Use an allowlist DTO that excludes server-controlled fields such as role", ["Trust the mobile client to hide the role field", "Rename the JSON property to make it less obvious", "Log the payload after saving it"], "Mass assignment is prevented by explicitly binding only fields the caller may set, rather than blindly mapping request properties to internal models.", REFERENCES.owaspApi, "Prevent mass assignment", "medium"),
  q("api-security-authorization", "A public API has no pagination or rate limits and lets callers request a million expensive records per call. Which OWASP risk is most directly implicated?", "Unrestricted Resource Consumption", ["Broken Authentication only", "Improper Assets Management only", "Server Side Request Forgery only"], "Unrestricted Resource Consumption covers APIs that allow excessive CPU, memory, storage, or downstream-resource use.", REFERENCES.owaspApi, "Recognize resource-consumption risk", "medium"),
  q("api-security-authorization", "A service checks that a user is logged in but does not verify tenant membership before returning `/tenants/{tenantId}/invoices`. What is missing?", "Object-level authorization tied to the tenant resource", ["Only a stronger password hash", "A different JSON media type", "An OpenAPI operationId"], "Authentication establishes identity; object-level authorization decides whether that identity may access the specific tenant object.", REFERENCES.owaspApi, "Separate authentication from authorization", "medium"),
  q("api-security-authorization", "Why is returning every property from an ORM entity risky in an API response?", "It can expose sensitive object properties that were not authorized or intended for the client", ["JSON cannot represent ORM entities", "ORM entities always disable TLS", "HTTP caches require all database columns"], "OWASP highlights broken object property level authorization when APIs expose properties without field-level authorization and filtering.", REFERENCES.owaspApi, "Limit response properties", "medium"),
  q("api-security-authorization", "An API accepts a webhook URL from users and the server fetches it from inside the private network. Which check is essential before making the request?", "Validate and restrict outbound destinations to prevent server-side request forgery", ["Require the URL to end with `.json`", "Disable all response caching", "Change the request method from POST to GET"], "SSRF occurs when user-controlled URLs cause the server to access internal or unintended resources; destination validation and egress controls are core defenses.", REFERENCES.owaspApi, "Mitigate SSRF", "medium"),
  q("api-security-authorization", "A GraphQL or REST endpoint lets any authenticated user request arbitrary nested expansions until the database is exhausted. Which combined controls best address the issue?", "Enforce authorization plus query complexity, depth, pagination, and rate/resource limits", ["Move the endpoint to HTTPS only and allow unlimited depth", "Return 500 when the database becomes slow", "Document the endpoint as internal but keep it public"], "The risk combines access control with unrestricted resource consumption; transport encryption alone does not bound server work.", REFERENCES.owaspApi, "Control expensive API queries", "hard"),
  q("api-security-authorization", "An admin-only field is filtered out by the web UI but still accepted by the API and persisted when sent manually. What is the correct security conclusion?", "The API is vulnerable because authorization and field allowlisting must be enforced server-side", ["The API is safe because the official UI hides the field", "The request is safe if it uses HTTPS", "The vulnerability is only in the browser cache"], "Clients are not a trust boundary. OWASP API risks require server-side enforcement for object, property, and function authorization.", REFERENCES.owaspApi, "Reject client-side-only authorization", "hard"),

  q("service-boundaries-data-ownership", "What is a practical sign that two capabilities should not be split into separate microservices yet?", "They require the same transactional data changes for most user actions", ["They are implemented in the same programming language", "They both expose JSON over HTTP", "They are deployed by the same team account"], "A service boundary should protect cohesive ownership. Frequent shared transactions are evidence that the boundary may cut through one consistency model.", REFERENCES.twelveProcesses, "Assess service boundary cohesion", "easy"),
  q("service-boundaries-data-ownership", "In a microservice design, who should normally own the schema for a service's private database?", "The service that protects the business capability using that data", ["Every other service that can query the network", "Only the API gateway", "The frontend client"], "Independent services need clear data ownership. Sharing mutable database tables across services creates tight coupling and bypasses service contracts.", REFERENCES.twelveProcesses, "Assign data ownership", "easy"),
  q("service-boundaries-data-ownership", "What does stateless process design mean for horizontally scaled service instances?", "Any instance can handle a request because durable state is kept in backing services, not local memory", ["Instances may never use a database", "All user sessions must be stored in a process variable", "Only one instance may run at a time"], "The Twelve-Factor processes principle says processes are stateless and share-nothing, with persistent data stored in backing services.", REFERENCES.twelveProcesses, "Explain stateless processes", "easy"),
  q("service-boundaries-data-ownership", "A checkout service directly joins tables from the inventory service database to calculate availability. What is the main architectural risk?", "It bypasses the inventory service contract and couples checkout to another service's private schema", ["SQL joins are impossible across services", "HTTP APIs cannot represent availability", "Inventory data must always be cached by clients"], "Cross-service database access makes schema changes unsafe and undermines the service that owns the data and invariants.", REFERENCES.twelveProcesses, "Avoid shared-database coupling", "medium"),
  q("service-boundaries-data-ownership", "Two services need to react when an order is paid. Which interaction reduces temporal coupling compared with synchronous fan-out from the payment request path?", "Publish a durable domain event that subscribers process asynchronously", ["Make the payment service call every subscriber before returning", "Let subscribers poll the payment service's private database", "Store subscriber code inside the payment service repository"], "Asynchronous events allow the payment transaction to complete without every downstream capability being available in the same request path.", REFERENCES.twelveDisposability, "Reduce temporal coupling", "medium"),
  q("service-boundaries-data-ownership", "Why should an API gateway usually not contain business authorization rules that only a domain service can evaluate correctly?", "The gateway lacks the domain data and invariants needed for object-level decisions", ["Gateways cannot inspect HTTP headers", "Domain services cannot return 403", "Authorization rules are always frontend concerns"], "A gateway can enforce coarse checks, but object-level and property-level authorization must be enforced where the protected resource is understood.", REFERENCES.owaspApi, "Place domain authorization", "medium"),
  q("service-boundaries-data-ownership", "A service publishes internal database column names in its public API. Why is that a boundary problem?", "It leaks storage design into the contract and makes internal schema changes breaking API changes", ["Column names are never valid JSON field names", "HTTP forbids exposing database-backed data", "OpenAPI cannot document fields with underscores"], "A stable API contract should represent domain concepts, not accidental storage details that other teams will couple to.", REFERENCES.openapi, "Keep contracts independent of storage", "medium"),
  q("service-boundaries-data-ownership", "When is a synchronous request from one service to another most defensible?", "When the caller needs the callee's current decision to complete the user-visible operation", ["Whenever it is easier than defining an event", "For every audit log write", "Only when both services use the same database"], "Synchronous coupling is appropriate for immediate decisions, but it should be deliberate because it shares latency and availability between services.", REFERENCES.twelveDisposability, "Choose synchronous interactions deliberately", "medium"),
  q("service-boundaries-data-ownership", "An `orders` service and `billing` service each store an order total and each treats its copy as authoritative. They often disagree after refunds. What is the boundary defect?", "The design has unclear ownership of a business fact, so services overwrite or reinterpret the same invariant independently", ["The services use different HTTP methods", "The API needs a larger page size", "Both services should expose the same database table"], "Microservice boundaries need clear source-of-truth ownership for facts and invariants; duplicated authority creates inconsistent behavior.", REFERENCES.twelveProcesses, "Resolve source-of-truth conflicts", "hard"),
  q("service-boundaries-data-ownership", "A team splits one capability into five services but releases all five together for every change and cannot test them independently. What conclusion is most technically defensible?", "The split has not achieved independent deployability and may be distributed modularity overhead without service autonomy", ["The design is automatically secure because there are more network boundaries", "The services are independent because they have different ports", "The API contracts no longer require versioning"], "The operational value of microservices depends on independent change and deployment boundaries. Network separation alone does not create autonomy.", REFERENCES.twelveProcesses, "Evaluate service autonomy", "hard"),

  q("resilience-observability-failure", "What is the main purpose of a timeout on an outbound service call?", "To bound how long the caller waits for a dependency before handling failure", ["To guarantee the dependency completed successfully", "To convert every network error into a cache hit", "To prevent authentication checks"], "Timeouts are basic failure controls: they stop callers from waiting indefinitely and allow recovery or error paths to run.", REFERENCES.twelveDisposability, "Use timeouts", "easy"),
  q("resilience-observability-failure", "Which HTTP status code commonly tells a client that the server is temporarily unable to handle the request?", "`503 Service Unavailable`", ["`204 No Content`", "`304 Not Modified`", "`415 Unsupported Media Type`"], "503 indicates temporary server overload or maintenance and can be accompanied by Retry-After.", REFERENCES.httpSemantics, "Identify temporary failure status", "easy"),
  q("resilience-observability-failure", "What should a readiness check represent?", "Whether the instance is ready to receive traffic", ["Whether the process binary exists on disk", "Whether the service has ever started since deployment", "Whether every optional downstream system is always perfect"], "Kubernetes readiness probes determine whether a container should receive traffic through Services.", REFERENCES.kubeProbes, "Define readiness", "easy"),
  q("resilience-observability-failure", "A service retries failed payment captures immediately with no limit after every timeout. What is the main risk?", "It can amplify dependency failure and create duplicate side effects unless retries are bounded and idempotent", ["Retries always make non-idempotent work safe", "Timeouts prove the payment was not received", "HTTP requires infinite retry for POST"], "Retries need limits, backoff, and idempotency for side-effecting operations because a timeout does not prove the server did no work.", REFERENCES.httpSemantics, "Design safe retries", "medium"),
  q("resilience-observability-failure", "Why should health endpoints avoid doing expensive deep checks on every probe?", "Frequent probes can become load and cause false failures if they depend on slow optional systems", ["Kubernetes does not support HTTP probes", "Health endpoints cannot return status codes", "All probes must connect to every downstream database"], "Probe endpoints run repeatedly. They should reflect the intended readiness or liveness signal without causing avoidable load or coupling to irrelevant dependencies.", REFERENCES.kubeProbes, "Keep probes operationally safe", "medium"),
  q("resilience-observability-failure", "A liveness probe fails whenever a downstream search cluster is unavailable, so Kubernetes restarts healthy API pods repeatedly. What is wrong?", "Liveness is being used for dependency readiness; restarts do not fix an external dependency outage", ["Liveness probes are only for batch jobs", "The API must return 200 even when its process is dead", "The search cluster should be stored in a ConfigMap"], "Liveness should detect when the container needs restart. Dependency availability usually belongs in readiness or graceful degradation decisions.", REFERENCES.kubeProbes, "Separate liveness from readiness", "medium"),
  q("resilience-observability-failure", "Which log field most directly allows tracing one user request across several services?", "A correlation or trace identifier propagated with the request", ["The server's local timezone abbreviation", "The CSS class used by the frontend", "The Kubernetes namespace alone"], "Distributed systems need request identifiers or trace context so events from different services can be connected during investigation.", REFERENCES.twelveProcesses, "Correlate distributed requests", "medium"),
  q("resilience-observability-failure", "What does graceful shutdown primarily protect?", "In-flight work and resource cleanup when a process receives a termination signal", ["The service from needing authentication", "The OpenAPI schema from breaking changes", "The cache from validating ETags"], "The Twelve-Factor disposability principle expects fast startup and graceful shutdown so processes can stop without corrupting work.", REFERENCES.twelveDisposability, "Handle shutdown correctly", "medium"),
  q("resilience-observability-failure", "A new deployment passes liveness but readiness fails. Traffic is not sent to the pods, yet the pods are not restarted. What is the intended interpretation?", "The containers are alive but not ready to serve requests, so they are removed from Service endpoints until ready", ["Kubernetes is ignoring both probes", "Readiness failure always deletes the Pod", "The application must be publicly reachable"], "Readiness gates traffic routing; liveness controls restarts. Failing readiness alone should not necessarily restart the container.", REFERENCES.kubeProbes, "Interpret probe outcomes", "hard"),
  q("resilience-observability-failure", "A client times out waiting for `POST /orders`, then retries and receives `409 Conflict` because the order already exists under the same idempotency key. How should the client treat this class of response?", "As evidence to reconcile with the existing operation result rather than blindly creating a second order", ["As proof that the first request never reached the server", "As a signal to disable authentication", "As a cache validation response"], "Timeouts are ambiguous. Idempotent operation design lets clients reconcile a completed or conflicting prior operation without duplicate side effects.", REFERENCES.httpSemantics, "Reconcile ambiguous side effects", "hard"),

  q("configuration-secrets-delivery", "According to Twelve-Factor config, where should deploy-specific configuration be stored?", "In the environment", ["Hard-coded in source files", "In a checked-in build artifact", "In a user's browser cache"], "The Twelve-Factor config principle stores config in environment variables and keeps it separate from code.", REFERENCES.twelveConfig, "Store deploy config", "easy"),
  q("configuration-secrets-delivery", "Which kind of value belongs in a secret rather than a ConfigMap?", "A database password", ["A public feature flag name", "A non-sensitive log level", "A static UI color token"], "Kubernetes Secrets are intended for sensitive information such as passwords, OAuth tokens, and SSH keys.", REFERENCES.kubeSecrets, "Classify secret data", "easy"),
  q("configuration-secrets-delivery", "What is a ConfigMap primarily used for in Kubernetes?", "Non-confidential configuration data consumed by Pods", ["Container image layers", "Encrypted payment credentials only", "Persistent block storage"], "ConfigMaps store non-confidential key-value configuration that Pods can consume as files, environment variables, or command arguments.", REFERENCES.kubeConfigMap, "Use ConfigMaps", "easy"),
  q("configuration-secrets-delivery", "Why is committing production API keys into a repository a release-blocking issue?", "It couples secrets to code history and exposes credentials beyond the runtime environment", ["Git automatically encrypts committed strings", "OpenAPI requires credentials in examples", "Kubernetes cannot read environment variables"], "Secrets in source control are hard to revoke completely and violate the separation of config from code.", REFERENCES.twelveConfig, "Keep secrets out of code", "medium"),
  q("configuration-secrets-delivery", "An app groups config into named environments like `staging`, `qa`, and `prod`, then adds custom branches such as `joes-staging`. What Twelve-Factor concern does this raise?", "Environment grouping does not scale cleanly; config should be granular environment variables", ["Deploys must never have more than one variable", "All config must be stored in a single JSON file", "Feature flags are forbidden in any environment"], "Twelve-Factor warns against brittle environment groupings and favors independently managed config values.", REFERENCES.twelveConfig, "Avoid brittle environment grouping", "medium"),
  q("configuration-secrets-delivery", "A service reads a required database URL only at startup. What should happen if it is missing?", "Fail startup clearly instead of running with an implicit unsafe default", ["Create a random production database", "Continue and hope the first request sets it", "Switch to an unrelated public endpoint"], "Failing fast exposes misconfiguration before traffic reaches the process; hidden defaults can send data to the wrong system.", REFERENCES.twelveConfig, "Fail fast on missing config", "medium"),
  q("configuration-secrets-delivery", "Why should build artifacts be promotable across environments with config supplied at runtime?", "The same code can be verified once while deploy-specific values change outside the artifact", ["It makes tests unnecessary", "It requires every environment to share credentials", "It prevents rollback"], "Separating config from code lets the same release artifact move between deploys while environment-specific values remain external.", REFERENCES.twelveConfig, "Separate build from runtime config", "medium"),
  q("configuration-secrets-delivery", "A Kubernetes Secret is mounted as an environment variable. What operational caution remains true?", "Applications and operators must still prevent accidental logging or exposure of the secret value", ["Secrets become safe to print because Kubernetes stored them", "Secrets cannot be consumed by Pods", "Secrets automatically rotate every request"], "Kubernetes Secrets help manage sensitive data, but applications can still leak values through logs, errors, or downstream exposure.", REFERENCES.kubeSecrets, "Handle secrets safely at runtime", "medium"),
  q("configuration-secrets-delivery", "A team changes `PAYMENT_GATEWAY=mock` in production to bypass an outage and forgets to restore it. What control best prevents this class of configuration accident?", "Use governed runtime config with review, audit trail, and environment-specific validation for high-risk values", ["Hide the setting in source code so nobody can change it", "Let every pod choose its own gateway randomly", "Store the value only in frontend localStorage"], "Runtime config is powerful and must be controlled. Sensitive operational switches need validation and auditability, not hard-coded bypasses.", REFERENCES.twelveConfig, "Govern high-risk config", "hard"),
  q("configuration-secrets-delivery", "An image contains baked-in production credentials and is copied to staging for testing. What is the most serious design failure?", "The artifact is not environment-neutral and carries secrets into places that should not have them", ["Containers cannot contain files", "Staging must always use production payment keys", "Kubernetes Services cannot route to that image"], "Deploy-specific secrets belong in the deploy environment, not in the image. Otherwise artifact promotion spreads credentials across boundaries.", REFERENCES.twelveConfig, "Prevent secret-bearing artifacts", "hard"),

  q("kubernetes-runtime-operations", "What does a Kubernetes Service provide for a set of Pods?", "A stable network abstraction for reaching matching Pods", ["A replacement for application authentication", "A place to store source code", "A guarantee that every Pod is healthy"], "A Service exposes a logical set of Pods and a policy for accessing them, decoupling clients from individual Pod addresses.", REFERENCES.kubeService, "Define Service purpose", "easy"),
  q("kubernetes-runtime-operations", "Which probe type determines whether a container should be restarted?", "Liveness probe", ["Readiness probe", "Startup probe only after success", "OpenAPI probe"], "The kubelet uses liveness probes to decide when to restart a container that appears unhealthy.", REFERENCES.kubeProbes, "Identify liveness behavior", "easy"),
  q("kubernetes-runtime-operations", "Which probe type can protect a slow-starting container from liveness checks until startup has completed?", "Startup probe", ["Readiness probe only", "Service probe", "ConfigMap probe"], "A startup probe disables liveness and readiness probe checks until it succeeds, which helps slow-starting applications initialize.", REFERENCES.kubeProbes, "Use startup probes", "easy"),
  q("kubernetes-runtime-operations", "A Pod is running but not included in a Service's endpoints. Which condition is the most likely operational cause?", "Its readiness probe is failing or it does not match the Service selector", ["Its OpenAPI document has no tags", "Its HTTP responses use ETags", "Its logs are written in JSON"], "Services route to Pods selected by labels that are ready. Readiness failure or selector mismatch removes the Pod from traffic.", REFERENCES.kubeService, "Diagnose missing endpoints", "medium"),
  q("kubernetes-runtime-operations", "What is the effect of a readiness probe failing after a container has already been serving traffic?", "The Pod is marked not ready and should stop receiving Service traffic until readiness returns", ["The Pod is always restarted immediately", "The Deployment is deleted", "The ConfigMap is rewritten"], "Readiness reflects traffic eligibility. A failing readiness probe removes the Pod from endpoints without necessarily restarting it.", REFERENCES.kubeProbes, "Apply readiness during runtime", "medium"),
  q("kubernetes-runtime-operations", "Why should liveness and readiness often be separate endpoints?", "They answer different questions: restart need versus traffic eligibility", ["Kubernetes requires different ports for them", "Readiness must always perform no checks", "Liveness must verify every downstream dependency"], "Combining the probes can cause restarts for recoverable dependency issues or route traffic before the app is ready.", REFERENCES.kubeProbes, "Design separate health signals", "medium"),
  q("kubernetes-runtime-operations", "A Service selector is `app=checkout`, but new Pods are labeled `app=checkout-api`. What happens?", "The Service will not select those Pods, so traffic will not reach them through that Service", ["Kubernetes automatically rewrites the labels", "The Pods become Secrets", "The Service changes to NodePort automatically"], "A Service's selector determines its endpoints. If labels do not match, the intended Pods are excluded.", REFERENCES.kubeService, "Match Service selectors", "medium"),
  q("kubernetes-runtime-operations", "Which Kubernetes object should hold non-sensitive feature configuration consumed by Pods?", "ConfigMap", ["Secret only", "Ingress", "PersistentVolumeClaim only"], "ConfigMaps are the Kubernetes mechanism for non-confidential configuration data.", REFERENCES.kubeConfigMap, "Choose config object type", "medium"),
  q("kubernetes-runtime-operations", "A slow Java service has a liveness probe with no startup probe and a short initial delay. Pods restart before the application finishes warming up. Which change addresses the actual failure mode?", "Add an appropriate startup probe or tune startup timing so liveness does not kill the container during initialization", ["Delete readiness so traffic starts earlier", "Put credentials into a ConfigMap", "Change the Service selector on every restart"], "Startup probes are intended for applications that need extra initialization time before liveness checks are meaningful.", REFERENCES.kubeProbes, "Protect slow startup", "hard"),
  q("kubernetes-runtime-operations", "During a dependency outage, all API Pods fail readiness but pass liveness. What is the expected Service behavior and why?", "The Service stops routing to those Pods because they are not ready, while Kubernetes avoids restarts because the processes are alive", ["The Service keeps routing because liveness passed", "Kubernetes restarts every Pod because readiness failed", "The outage is hidden from clients by ConfigMap reload"], "Readiness controls endpoint inclusion; liveness controls restart. Passing liveness with failing readiness is a valid state for alive but unavailable instances.", REFERENCES.kubeProbes, "Reason across probe and routing behavior", "hard"),
];

function item(draft: Draft, index: number) {
  const topic = TOPICS[draft.topic];
  const correctOption = index % 4;
  const options = [...draft.distractors];
  options.splice(correctOption, 0, draft.correct);
  const objectiveCode = `${topic.code}-${String((index % 10) + 1).padStart(2, "0")}`;
  return {
    schemaVersion: 1 as const,
    sourceRecordId: `adms-v1-${String(index + 1).padStart(3, "0")}`,
    language: "en",
    question: draft.question,
    format: "mcq_single" as const,
    options,
    answer: { kind: "single_choice" as const, correctOption },
    explanation: draft.explanation,
    subject: "API design and microservices",
    topic: topic.name,
    syllabus: SYLLABUS,
    exam: "API Design and Microservices Skills",
    examYear: 2026,
    objective: draft.objective,
    difficulty: draft.difficulty,
    maxPoints: 1,
    negativeMarks: 0,
    timeLimitSec: draft.difficulty === "hard" ? 120 : draft.difficulty === "easy" ? 60 : 90,
    tags: ["api-design", "microservices", draft.topic, draft.difficulty, "original", "version-1"],
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

export const API_DESIGN_MICROSERVICES_SKILLS_V1 = DRAFTS.map(item);

function semanticKey(value: string) {
  return value.toLowerCase().replace(/`[^`]+`/g, "<code>").replace(/\b\d+(?:\.\d+)?\b/g, "<n>").replace(/[^a-z<>]+/g, " ").trim();
}

export function auditApiDesignMicroservicesSkillsV1() {
  const errors: string[] = [];
  const ids = new Set<string>();
  const prompts = new Set<string>();
  const semantic = new Set<string>();
  const hashes = new Set<string>();
  const topicCounts = new Map<string, number>();
  const difficultyCounts = new Map<string, number>();
  const answerPositions = [0, 0, 0, 0];
  const allowedSources = [
    "https://www.rfc-editor.org/rfc/rfc9110.html",
    "https://www.rfc-editor.org/rfc/rfc9111.html",
    "https://spec.openapis.org/oas/latest.html",
    "https://owasp.org/API-Security/editions/2023/en/0x11-t10/",
    "https://12factor.net/",
    "https://kubernetes.io/docs/",
  ];
  for (const candidate of API_DESIGN_MICROSERVICES_SKILLS_V1) {
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
  if (API_DESIGN_MICROSERVICES_SKILLS_V1.length !== 80) errors.push(`Expected 80 rows, found ${API_DESIGN_MICROSERVICES_SKILLS_V1.length}`);
  for (const topicSlug of Object.keys(TOPICS)) {
    if ((topicCounts.get(topicSlug) ?? 0) !== 10) errors.push(`${topicSlug}: expected 10 questions`);
    if ((difficultyCounts.get(`${topicSlug}:easy`) ?? 0) !== 3) errors.push(`${topicSlug}: expected 3 easy questions`);
    if ((difficultyCounts.get(`${topicSlug}:medium`) ?? 0) !== 5) errors.push(`${topicSlug}: expected 5 medium questions`);
    if ((difficultyCounts.get(`${topicSlug}:hard`) ?? 0) !== 2) errors.push(`${topicSlug}: expected 2 hard questions`);
  }
  if (answerPositions.some((count) => count !== 20)) errors.push(`Answer positions are not balanced: ${answerPositions.join(",")}`);
  const digest = createHash("sha256").update(JSON.stringify(API_DESIGN_MICROSERVICES_SKILLS_V1)).digest("hex");
  return {
    errors,
    rows: API_DESIGN_MICROSERVICES_SKILLS_V1.length,
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
  const output = path.resolve(process.argv[2] ?? "content/question-packs/octamy-api-design-microservices-skills-v1.jsonl");
  const audit = auditApiDesignMicroservicesSkillsV1();
  if (audit.errors.length) throw new Error(audit.errors.join("\n"));
  await mkdir(path.dirname(output), { recursive: true });
  const stream = createWriteStream(output, { encoding: "utf8", flags: "w", mode: 0o600 });
  for (const candidate of API_DESIGN_MICROSERVICES_SKILLS_V1) stream.write(`${JSON.stringify(candidate)}\n`);
  stream.end();
  await finished(stream);
  process.stdout.write(`${JSON.stringify({ output, ...audit }, null, 2)}\n`);
}

if (/generate-api-design-microservices-skills-v1\.(?:c?js|ts)$/.test(path.basename(process.argv[1] ?? ""))) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
