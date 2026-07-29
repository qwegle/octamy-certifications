# Octamy learner mobile API contract

**Audit date:** 2026-07-28  
**Scope:** end-user learner mobile app. This file records routes proved reachable in the current Express server; it is not inferred from README copy or the dead `octamy-mobile/OctamyMobile` scaffold.

## Verification and mounting

`registerRoutes(app)` mounts Google routes at `/api` early, declares several direct `/api/...` routes, then mounts the modular router at `/api`. The modular router mounts its child routers as shown below. Therefore every path in this document is a full externally visible path.

- Google mount: `server/routes.ts:485`; direct learner routes include `server/routes.ts:1135-1206`, `1378-2029`, `2343-3507`, and `4097-4209`.
- Modular mount: `server/routes.ts:4078`; child mounts: `server/routes/index.ts:31-54`.
- Duplicate registration exists for `certificateRoutes` (`server/routes/index.ts:35` and `server/routes.ts:4079`) and `userProfileRoutes` (`server/routes.ts:1232` and `server/routes/index.ts:36`). The contracts are identical and Express's first completed response wins.
- `/api/auth/register` and `/api/auth/login` are declared directly before the modular auth router. Their effective response/token lifetime is therefore the direct implementation (24-hour JWT), not `AuthController`'s otherwise reachable 7-day implementation. Sources: `server/routes.ts:1074-1199`, mount at `4078`, modular declarations at `server/routes/authRoutes.ts:10-11`.
- Unknown `/api/*` paths return `404 { message: "API route not found" }`: `server/index.ts:195-198`.

Conventions used below: `JWT` means the learner JWT accepted by `authenticateToken`; `optional JWT` means a valid token is used when present but anonymous access continues when absent/invalid. Timestamps returned from JSON are ISO strings. A “DB row” uses the camel-cased Drizzle fields defined in `shared/schema.ts`.

# AUTH TOKEN MECHANICS

- Send learner credentials as `Authorization: Bearer <token>`. The middleware reads `req.headers.authorization`, splits on a space, and verifies the second segment with `JWT_SECRET`; it then reloads the user and populates `req.user = { userId, email, isAdmin }`. Missing token: `401 {message:"Access token required"}`; expired: `401 {message:"Token expired",code:"TOKEN_EXPIRED"}`; invalid/user missing: `401 {message:"Invalid token",code:"INVALID_TOKEN"}`. Source: `server/middleware/auth.ts:39-75`.
- The parser does not literally validate the word `Bearer`, but mobile must use the standard Bearer scheme. Tokens in query strings are not supported.
- Password registration/login's effective direct handlers issue a 24-hour JWT containing `userId`, `email`, `isAdmin`. Google and the modular-only controller issue 7-day JWTs. Sources: `server/routes.ts:1109-1118,1174-1183`; `server/google-auth.ts` via `server/routes/google-auth-routes.ts:70`; `server/controllers/authController.ts:38-42,76-80`.
- There is no server session, refresh-token, token-revocation, or cookie-authenticated learner session. Logout only acknowledges; deletion of the locally stored JWT is the logout operation. `passport.authenticate(..., {session:false})` confirms Google does not establish a Passport session: `server/routes/google-auth-routes.ts:63`.
- Google OAuth uses a random, 10-minute, `HttpOnly; SameSite=Lax; Path=/api/auth/google` state cookie (plus `Secure` in production), checks it with constant-time comparison, clears it, then redirects to **web** `/login#token=<encoded JWT>&success=true`. URL fragments are not sent to the server. Sources: `server/routes/google-auth-routes.ts:27-51,54-79`. This is not a native deep-link callback contract.
- Recruiter JWTs are distinct: payload `{recruiterId,email}`, 7-day lifetime, same `Authorization` header, checked by `authenticateRecruiterToken`. A learner token cannot call recruiter-role endpoints. Source: `server/routes/recruiterRoutes.ts:45-70,125-129,177-181`.

# 1. Authentication (14 verified endpoints)

### `POST /api/register` and `POST /api/auth/register`
- **Auth:** public. **Body:** `{name:string, email:string, password:string, phone?:string}`. `name/email/password` must be truthy; email is trimmed/lowercased; password must satisfy `assertStrongPassword`.
- **Success:** `201 {token:string,user:{id:number,name:string,email:string,isAdmin:boolean}}`.
- **Errors:** `400` missing fields, duplicate user, or weak password; `500` registration failed. **Source:** `server/routes.ts:1074-1136`.

### `POST /api/login` and `POST /api/auth/login`
- **Auth:** public. **Body:** `{email:string,password:string}`; email is trimmed/lowercased.
- **Success:** `200 {token:string,user:{id:number,name:string,email:string,isAdmin:boolean}}`.
- **Errors:** `400` missing credentials; `401` invalid credentials; `429` temporary account lock after failures; `500`. **Source:** `server/routes.ts:1138-1199`.

### `POST /api/logout`
- **Auth:** public (no token is inspected). **Body/query:** none.
- **Success:** `200 {message:"Logout successful"}`. Local token removal is required. **Source:** `server/routes.ts:1201-1204`.

### `POST /api/auth/logout`
- **Auth:** public. **Body/query:** none.
- **Success:** `200 {message:"Logout successful"}`. **Source:** `server/routes/authRoutes.ts:12`; handler `server/controllers/authController.ts:118-121`; mounts `server/routes/index.ts:31`, `server/routes.ts:4078`.

### `POST /api/auth/forgot-password`
- **Auth:** public. **Body:** `{email:string}`; must contain `@`.
- **Success:** always `200 {message:"If an account exists for this email, a reset link has been sent."}` for syntactically valid email, including unknown/Google-only users.
- **Errors:** `400 {message:"Valid email required"}`; `500`. The emailed link is a web `/reset-password?token=...` link. **Source:** route `server/routes/authRoutes.ts:13`; handler `server/controllers/authController.ts:126-168`.

### `POST /api/auth/reset-password`
- **Auth:** public. **Body:** `{token:string,password:string}`; basic minimum 8 plus server strong-password policy.
- **Success:** `200 {message:"Password updated. You can now sign in."}`.
- **Errors:** `400` missing/short input, weak password, or invalid/expired/used token; `500`. **Source:** route `server/routes/authRoutes.ts:14`; handler `server/controllers/authController.ts:170-205`.

### `GET /api/user`
- **Auth:** JWT. **Input:** none.
- **Success:** `{id:number,name:string,email:string,isAdmin:boolean}`.
- **Errors:** standard JWT `401`; `404` user not found; `500`. **Source:** `server/routes.ts:1206-1224`.

### `GET /api/auth/user` and `GET /api/auth/me`
- **Auth:** JWT. **Input:** none.
- **Success:** `{id:number,email:string,name:string,isAdmin:boolean}`.
- **Errors:** standard JWT `401`; `404`; `500`. **Source:** routes `server/routes/authRoutes.ts:17-18`; handler `server/controllers/authController.ts:93-116`.

### `GET /api/auth/google/status`
- **Auth:** public. **Input:** none.
- **Success:** `{enabled:boolean}`, `Cache-Control:no-store`. **Source:** `server/routes/google-auth-routes.ts:8-11`; mount `server/routes.ts:485`.

### `GET /api/auth/google/user`
- **Auth:** public browser OAuth start. **Input:** no app-defined query fields.
- **Success:** `302` to Google after setting the state cookie; scope is `profile email`.
- **Errors:** `302 /login?error=google_not_configured`. **Source:** `server/routes/google-auth-routes.ts:13-35,54-57`; mount `server/routes.ts:485`.

### `GET /api/auth/google/user/callback`
- **Auth:** public OAuth callback. **Query:** Google OAuth values including `state:string`; state must match cookie.
- **Success:** `302 /login#token=<JWT>&success=true`.
- **Errors:** redirects with `invalid_oauth_state`, `google_link_required`, or `auth_failed`. **Source:** `server/routes/google-auth-routes.ts:37-51,59-79`.

**No verified route:** `/api/session`, `/api/auth/session`, token refresh, revoke-all-sessions, authenticated password change for learners, or native Google token exchange.

# 2. Catalog: categories, courses, certifications and assessments (12 verified endpoints)

### `GET /api/categories`
- **Auth:** public. **Input:** none.
- **Success:** category DB-row array: `{id,name,description,icon,slug,parentId,kind,isActive,sortOrder,metaTitle,metaDescription,createdAt,updatedAt}[]`.
- **Errors:** `500 {message:"Failed to fetch categories"}`. **Source:** `server/routes.ts:1378-1385`; fields `shared/schema.ts:262-279`.

### `GET /api/courses`
- **Auth:** public. **Input:** none.
- **Success:** storage course-list array (course fields such as `id,title,description,slug,categoryId,duration,passingScore,price,productType,level,...`).
- **Errors:** `500`. **Source:** `server/routes.ts:1387-1394`; fields `shared/schema.ts:281-326`.

### `GET /api/courses/:id`
- **Auth:** public. **Path:** `id` accepts a positive-looking numeric ID **or a slug string**.
- **Success:** full course storage object.
- **Errors:** `404` absent/inactive/non-public/unapproved/institute-owned; `409 {code:"ASSESSMENT_BANK_NOT_READY"}` for an assessment not using the blueprint engine; `500`. **Source:** `server/routes.ts:1396-1418`.

### `GET /api/courses/slug/:slug`
- **Auth:** public. **Path:** `slug:string` (numeric is also accepted).
- **Success:** full course storage object, often with category join.
- **Errors:** `404`; `500`. Caveat: the nonnumeric branch only checks existence here, so prefer the purpose-specific assessment detail routes below. **Source:** `server/routes.ts:1420-1444`.

### `GET /api/assessments`, `GET /api/practice-assessments`, `GET /api/creator-assessments`
- **Auth:** public. **Query (strict):** `page?:integer>=1` default 1; `pageSize?:integer 1..48` default 12; `search?:string<=120`; `category?:string<=120`; `audience?:string<=80`; `level?:"novice"|"intermediate"|"advanced"|"expert"`; `language?:string 2..20`; `featured?:"true"|"false"`.
- **Success:** `{items:Array<{id,title,description,slug,duration,passingScore,price,level,language,thumbnailUrl,certificationMode,assessmentPurpose,subscriptionEligible,featuredAt,createdAt,category,creator,origin,originLabel,certificationLabel,canonicalPath,audienceBands[]}>,pagination:{page,pageSize,total,totalPages},facets:{categories,audienceBands,levels}}`. Routes select respectively Octamy certification, Octamy practice, and creator certification inventory.
- **Errors:** `400 {message:"Review the assessment filters",errors}`; `500`. **Source:** schema/handler `server/routes/catalogRoutes.ts:25-263`; routes `264-266`; mounts `server/routes/index.ts:51`, `server/routes.ts:4078`.

### `GET /api/certification-navigation`
- **Auth:** public. **Input:** none.
- **Success:** `{items:Array<{id,title,slug,isActive,visibility,reviewStatus,category,availability:"available"}>,pagination:{total:number}}` (max 100, only career-certification blueprint inventory).
- **Errors:** `500`. **Source:** `server/routes/catalogRoutes.ts:268-308`.

### `GET /api/assessment-categories/:slug` and `GET /api/practice-categories/:slug`
- **Auth:** public. **Path:** canonicalized `slug:string`.
- **Success:** `{category,ancestors:Category[],children:Category[],canonicalPath:string}` where projected category fields are `id,name,description,icon,slug,parentId,kind,sortOrder,metaTitle,metaDescription`.
- **Errors:** `404`; `500`. **Source:** `server/routes/catalogRoutes.ts:310-364`; hierarchy shape `55-80`.

### `GET /api/assessments/:slug`
- **Auth:** public. **Path:** certification slug or positive numeric ID.
- **Success:** public certification detail with `id,title,description,slug,categoryId,duration,passingScore,price,productType,level,language,thumbnailUrl,metaTitle,metaDescription,ownerType,certificationMode,assessmentPurpose,subscriptionEligible,category,creator,origin,originLabel,certificationLabel,canonicalPath`.
- **Errors:** `404`; `500`. **Source:** `server/routes/catalogRoutes.ts:366-434`.

### `GET /api/practice-assessments/:slug`
- **Auth:** public. **Path:** practice slug or positive numeric ID.
- **Success:** analogous practice detail, with `creator:null`, `origin:"practice"`, `certificationLabel:"Practice only"`.
- **Errors:** `404`; `500`. **Source:** `server/routes/catalogRoutes.ts:436-502`.

# 3. Enrollment and content access (3 verified endpoints)

### `GET /api/courses/:id/access`
- **Auth:** optional JWT. **Path:** `id:positive integer`.
- **Success:** `{courseId,productType,contentPrice,requiresPurchase:boolean,hasAccess:boolean,entitlement:null|{status,source,grantedAt,expiresAt},lessonCount,previewCount}`. Assessments return `hasAccess:true` independent of course-content entitlement; Practice Pass is checked only when starting/submitting a practice exam.
- **Errors:** `400` bad ID; `404`; `500`. **Source:** `server/routes/featureRoutes.ts:369-405`.

### `POST /api/courses/:id/enrol-free`
- **Auth:** JWT. **Body:** none. **Path:** positive course ID.
- **Success:** `201` course-entitlement DB row.
- **Errors:** `404`; `400` assessment/free-enrolment mismatch; `402` paid enrollment required; JWT `401`; `500`. **Source:** `server/routes/featureRoutes.ts:407-431`; entitlement fields `shared/schema.ts:1383-1397`.

### `POST /api/courses/:id/access-checkout`
- **Auth:** JWT. **Body:** `{couponCode?:string,sellerCode?:string,phone?:string}`.
- **Success:** `{success:true,gateway:"cashfree",orderId,statusToken,paymentSessionId,paymentLink,amount:string,discountAmount:string}`. Access is granted only later by the verified Cashfree webhook.
- **Errors:** `404`; `400` assessment/free mismatch; `409` already entitled; coupon-specific `4xx`; `500`. **Source:** `server/routes/featureRoutes.ts:433-491`; webhook `server/routes.ts:2606`.

# 4. Career certification and Practice Pass exam attempts (6 verified endpoints)

## Recovery model (important)

The server persists a server-issued question mapping, question snapshot, start time, deadline, consent, and optional user ID. It does **not** expose a GET/resume endpoint for that session and does **not** accept periodic answer-progress saves. Mobile must persist `questions`, `sessionId`, `startedAt`, `deadlineAt`, and local answers securely on-device until submit. Submission is network-retry safe: replaying the same `sessionId` returns the already committed result and practice-attempt insertion is unique by session. The temporary result remains server-side for 24 hours. Sources: start persistence `server/routes.ts:1655-1706`; idempotent replay `1768-1794`; atomic commit `1918-1948`; result `1981-2029`; unique persisted practice attempt `server/routes.ts:190-213`, schema `shared/schema.ts:1170-1189`.

### `POST /api/courses/:id/questions` — start an attempt
- **Auth:** optional JWT for certification; **JWT plus active Practice Pass** for practice. **Path:** positive course ID. **Body:** `{evidenceConsent:true}` exactly (extra fields are tolerated by this small schema).
- **Success:** `{questions:Array<{id:number,question:string,options:string[]}>,sessionId:string,startedAt:string,deadlineAt:string,proctorMode:"browser_evidence",evidenceConsentVersion:string}`. Correct answers are removed.
- **Errors:** `400 EVIDENCE_CONSENT_REQUIRED`/invalid ID; practice `401` unsigned or `402 PRACTICE_SUBSCRIPTION_REQUIRED`; `404`; `409 ASSESSMENT_BANK_NOT_READY`, `ASSESSMENT_QUESTION_POOL_NOT_READY`, or no questions; `500`. **Source:** `server/routes.ts:1447-1723`.

### `POST /api/exam/submit`
- **Auth:** optional JWT for certification; JWT + active Practice Pass for practice. **Body:** `{courseId:number|string,sessionId:string,answers:Record<string,number>,userEmail?:string,userName?:string,tabSwitches?:nonnegative integer}`. Guest name/email are required only without JWT; authenticated identity is loaded server-side.
- **Success:** `{tempExamId,score:number,passed:boolean,correctAnswers:number,totalQuestions:number,isRetake:boolean,previousBestScore:number,passingThreshold:number,recoveryEmailSent:boolean,resultExpiresAt:string,timedOut:boolean,message:string,redirectTo:string}`. Same-session retry replays this shape.
- **Errors:** `400` invalid inputs or `SESSION_EXPIRED`; `401/402 PRACTICE_SUBSCRIPTION_REQUIRED`; `403` session owner mismatch; `404`; `409 SESSION_EXPIRED` after deadline/already consumed; `429` rate limit; `500`. **Source:** response helper `server/routes.ts:163-189`; route `1727-1977`.

### `GET /api/exam-results-temp/:tempExamId`
- **Auth:** optional JWT. Guest-owned results are readable by possession of the random ID; account-owned results require matching JWT.
- **Success:** `{tempExamId,score,passed,correctAnswers,totalQuestions,course,assessmentPurpose,timeTaken,timedOut,mastered,isRetake,previousBestScore,review:Array<{questionId,question,options,selectedAnswer,correctAnswer,isCorrect}>,isGuest,maskedEmail?,resultExpiresAt,recoveryEmailSent,message,needsPayment}`.
- **Errors:** `403` another account; `404` absent/expired; `500`. **Source:** `server/routes.ts:1981-2029`.

### `GET /api/exam/history`
- **Auth:** JWT. **Query:** `courseId?:integer` (invalid text becomes `NaN` and is passed to storage; callers should send valid integer only).
- **Success:** exam-attempt DB-row array.
- **Errors:** JWT `401`; `500`. **Source:** route `server/routes/examRoutes.ts:11`; handler `server/controllers/examController.ts:40-56`.

### `GET /api/exam/results/:id`
- **Auth:** JWT owner. **Path:** exam attempt `id:integer`.
- **Success:** exam-attempt DB row `{id,userId,courseId,userEmail,userName,score,totalQuestions,answers,timeTaken,passed,mastered,sessionId,ipAddress,userAgent,tabSwitches,createdAt}`.
- **Errors:** `400` invalid ID; `404` absent/not owned; JWT `401`; `500`. **Source:** route `server/routes/examRoutes.ts:12`; handler `server/controllers/examController.ts:12-38`; fields `shared/schema.ts:1170-1189`.

### `GET /api/user/exam-history`
- **Auth:** JWT. **Input:** none.
- **Success:** max-50 array `{id,courseId,score,totalQuestions,passed,createdAt,courseTitle,courseSlug,passingScore,hasCertificate}`.
- **Errors:** JWT `401`; `500`. **Source:** `server/routes/dashboardRoutes.ts:966-988`.

**No endpoint exists for:** saving answer progress, fetching an active public exam session/questions, extending/restarting a session in place, or syncing client timer state. Do not call `/api/exam/start`, `/api/exam/progress`, `/api/exam/session/:id`, or `/api/exam/save`; they do not exist.

# 5. Certificates and verification (8 verified endpoints)

### `POST /api/certificates/create`
- **Auth:** effectively JWT (route uses optional auth, controller returns `401` without user). **Body:** `{examAttemptId:number}`.
- **Success:** `201` certificate DB row with unpaid `isPaid:false`.
- **Errors:** `401`; `404` attempt/course/user; `400` score below passing; `500`. **Source:** route `server/routes/certificateRoutes.ts:11`; handler `server/controllers/certificateController.ts:35-101`.

### `GET /api/certificates/user/certificates`
- **Auth:** JWT. **Input:** none.
- **Success:** the authenticated user's certificate storage-row array.
- **Errors:** `401`; `500`. **Source:** route `server/routes/certificateRoutes.ts:13`; handler `server/controllers/certificateController.ts:288-304`.

### `GET /api/user/certificates`
- **Auth:** JWT. **Input:** none.
- **Success:** certificate storage-row array (matching user ID/email).
- **Errors:** `401`; `500`. **Source:** `server/routes.ts:4097-4120`.

### `GET /api/certificates/:id`
- **Auth:** public. **Path:** `id` is the string `certificateId`, not numeric DB ID.
- **Success (display-safe):** `{certificateId,certificateNumber,userName,courseTitle,score,badge,mastered,issuedAt,expiresAt,issuedBy,issuer:{platform,coIssuer},isPaid,isActive}`.
- **Errors:** `404`; `500`. **Source:** route `server/routes/certificateRoutes.ts:17`; handler `server/controllers/certificateController.ts:103-139`.

### `GET /api/certificates/verify/:id`
- **Auth:** public. **Path:** certificate ID.
- **Success:** `{authentic:true,valid:boolean,status:"pending_activation"|"revoked"|"expired"|"active",certificateId,userName,courseTitle,score,issuedAt,expiresAt,badge,issuedBy,issuer,assessment:{passingScore,questionCount,durationSeconds,completedAt,level}}`.
- **Errors:** `404`; `500`. **Source:** route `server/routes/certificateRoutes.ts:14`; handler `server/controllers/certificateController.ts:240-286`.

### `GET /api/certificates/:id/activation`
- **Auth:** JWT owner. **Path:** certificate ID.
- **Success:** `{certificateId,certificateNumber,userName,courseTitle,score,badge,issuedAt,expiresAt,status:"activated"|"revoked"|"ready",isPaid,isActive,pricing:{currency:"INR",digital:string,physicalShipping:"50.00",originalDigital:string|null,isOnSale:boolean}}`.
- **Errors:** standard JWT plus ownership/context `CredentialActivationError` status/code; `500`. **Source:** route `server/routes/certificateRoutes.ts:15`; handler `server/controllers/certificateController.ts:141-188`.

### `GET /api/certificates/:id/download`
- **Auth:** public-by-certificate-ID; no ownership middleware. **Query:** `format?:"pdf"`; anything else returns HTML.
- **Success:** PDF attachment or HTML inline certificate.
- **Errors:** `403` unpaid; `404`; `410` revoked/expired; `500`. Mobile should treat the certificate ID as sensitive until product policy confirms public download is intended. **Source:** route `server/routes/certificateRoutes.ts:16`; handler `server/controllers/certificateController.ts:190-238`.

### `GET /api/certificate/:certificateNumber`
- **Auth:** public. **Path:** certificate ID/number used by storage lookup.
- **Success:** shareable certificate HTML with controls.
- **Errors:** HTML `403`, `404`, or `500`. **Source:** `server/routes.ts:4208-4409`.

# 6. Payments, server confirmation, and Practice Pass (12 verified endpoints)

**Trust rule:** client return/navigation is not fulfillment. Cashfree fulfillment occurs only in the signature-verified webhook; PayU fulfillment occurs only after callback hash, transaction, amount and reservation checks. A status GET only reports state. Sources: `server/routes.ts:2606-3001,3004-3420`.

### `POST /api/payment/initiate`
- **Auth:** optional JWT for temp-exam certificate checkout; JWT required when body uses `certificateId` activation.
- **Body, temp result:** `{tempExamId:string,userPhone?:string,sellerCode?:string,couponCode?:string,includesPhysicalCopy?:boolean,selectedAddressId?:number|null}`. Client-supplied `courseId/userEmail/userName/amount` may be read by fallback destructuring but authoritative exam/course/price comes from persisted server state; do not send or trust them.
- **Body, existing credential activation:** `{certificateId:string,userPhone?:string,sellerCode?:string,includesPhysicalCopy?:boolean,selectedAddressId?:positive integer|null}`.
- **Success:** Cashfree `{success:true,gateway:"cashfree",orderId,transactionId,statusToken,amount,currency?,paymentSessionId,paymentLink}` or PayU `{success:true,gateway?:"payumoney",paymentForm,transactionId,amount,currency?}`.
- **Errors:** `400`; `401 AUTH_REQUIRED`; `403` pending-result ownership; `404` expired result; `409` already activated/revoked; coupon errors; `500/503 CHECKOUT_UNAVAILABLE`. **Source:** activation schema/handler `server/routes.ts:2032-2215`; route `2343-2534`.

### `POST /api/payments/cashfree/create-order`
- **Auth:** optional JWT. **Body:** `{tempExamId:string,userPhone?:string,sellerCode?:string,couponCode?:string,includesPhysicalCopy?:boolean,selectedAddressId?:number|null}`.
- **Success:** `{success:true,gateway:"cashfree",orderId,statusToken,paymentSessionId,paymentLink,amount,currency:"INR"}`.
- **Errors:** `400`, `403`, coupon `4xx`, `500`. **Source:** `server/routes.ts:2537-2583`.

### `GET /api/payments/cashfree/:orderId/status?token=<statusToken>`
- **Auth:** short-lived order-bound status token returned by Cashfree checkout; no JWT. **Path:** `orderId` must match the signed token.
- **Success:** `{orderId,localStatus:"pending"|"completed"|"failed"}` with `Cache-Control: private, no-store`; it reads only a matching local reservation.
- **Errors:** `404` for malformed, expired, tampered, mismatched, or unknown order/token; `500`. It neither calls Cashfree nor fulfills an order. **Source:** `server/routes.ts:2658-2682`; token policy `server/lib/cashfree.ts:173-202`.

### `POST /api/webhooks/cashfree`
- **Auth:** provider signature, not JWT. **Headers read:** `x-webhook-signature` (fallback `x-cashfree-signature`/`x-signature`) and timestamp counterpart. **Body fields read:** Cashfree payload including `data.order.order_id`, `data.payment.cf_payment_id`, status, amount and order note.
- **Success:** generally `200 {ok:true,status:string}`. After signature and amount validation, credential activation is transactional/idempotent, subscription activation locks its reservation, and course access uses an entitlement upsert; unknown orders are ignored. Client status reads never enter this handler.
- **Errors:** `401` invalid signature; `400` missing order ID; `500` processing failure. Mobile must never call this. **Source:** `server/routes.ts:2606-3001`.

### `POST /api/payment/success`
- **Auth:** PayU reverse-hash callback, not JWT. **Form fields read:** `txnid,amount,status,unmappedstatus,mihpayid,udf1..udf5,error_Message,hash` plus PayU hash inputs.
- **Success/failure transport:** HTTP redirect to web `/payment-success?...` or `/payment-failed?...`; it creates/activates only after hash + reservation checks and is idempotent.
- **Errors:** represented as failure redirects; unexpected exception also redirects. Mobile must not synthesize this callback. **Source:** `server/routes.ts:3004-3420`.

### `POST /api/payment/failure`
- **Auth:** PayU reverse-hash callback. **Form:** same relevant PayU fields.
- **Result:** redirect to web failure page; only marks a matching pending activation failed after validation.
- **Errors:** invalid hash/processing are failure redirects. **Source:** `server/routes.ts:3423-3482`.

### `GET /api/payment/status/:transactionId?token=<statusToken>`
- **Auth:** short-lived transaction-bound status token; no JWT. **Success:** `{status:"pending"|"completed"|"failed",amount,transactionId,createdAt}` with no-store headers.
- **Errors:** `404` for invalid/mismatched/expired token or unknown transaction; `500`. It reports local state and does not confirm/fulfill payment. **Source:** `server/routes.ts:3588-3620`.

### `GET /api/user/payments`
- **Auth:** JWT. **Success:** max-50 array `{id,amount,status,paymentMethod,gateway,courseId,certificateId,createdAt}`.
- **Errors:** `500` plus JWT errors. **Source:** `server/routes/dashboardRoutes.ts:947-964`.

### `POST /api/subscriptions/checkout`
- **Auth:** JWT. **Body for Practice Pass:** `{ownerType:"learner",plan:"all_access",cycle?:"monthly"|"yearly"}`. Server price is ₹299 monthly or 10 months' price for yearly; this is a Cashfree one-off order, not a recurring store subscription.
- **Success:** `{orderId,statusToken,paymentSessionId,paymentLink,subscriptionId,amount,currency:"INR"}`. `statusToken` is a required checkout response field and must be retained with this order; it is short-lived and cannot fulfill access. A paid order remains pending until Cashfree webhook activation.
- **Errors:** `400` missing/unknown/invalid cycle; `409 PRACTICE_INVENTORY_UNAVAILABLE`, `SUBSCRIPTION_ALREADY_ACTIVE`, or `SUBSCRIPTION_CHECKOUT_PENDING` (the pending response includes `orderId,statusToken`); role `403` for nonlearner plans; `500`. **Source:** `server/routes/dashboardRoutes.ts:1045-1165`; token policy `server/lib/cashfree.ts:173-202`; schema caveat `shared/schema.ts:492-511`.

### `GET /api/subscriptions/orders/:orderId/status`
- **Auth:** JWT. **Path:** `orderId` must match `SUB_<UUID>` and belong to `req.user.userId`; the issued `statusToken` is not accepted by this owner-bound endpoint.
- **Success:** `{orderId,status,plan,ownerType,startsAt,renewsAt}` with private/no-store headers. This is a local, non-fulfilling reservation read.
- **Errors:** `400 {code:"INVALID_SUBSCRIPTION_ORDER"}`; `404` for an unknown or other user's order; JWT/rate-limit errors. **Source:** `server/routes/dashboardRoutes.ts:1219-1241`.

### `GET /api/me/subscription`
- **Auth:** JWT. **Success:** `{learner:null|{plan,renewsAt,status},creator:null|{plan,renewsAt},institute:null|{plan,renewsAt,memberRole},recruiter:null|{plan,renewsAt,credits}}`.
- **Errors:** `500` plus JWT errors. This is the authoritative Practice Pass entitlement check for mobile. **Source:** `server/routes/dashboardRoutes.ts:1121-1141`.

### `POST /api/subscriptions/learner/redeem`
- **Auth:** JWT. **Body:** ignored.
- **Result:** always `409 {message,code:"PRACTICE_PASS_ONLY"}`; Practice Pass cannot issue certification credentials. **Source:** `server/routes/learnerSubscriptionRoutes.ts:26-33`.

# 7. Private AI Interview Studio, audio, video, and media (13 supported learner endpoints)

Interview Studio is private practice only. Its readiness object hard-codes `verifiedEnabled:false`, `recordingEnabled:false`, and `recruiterSharingEnabled:false`. Camera and screen consent/permissions are readiness events only. Raw voice audio is transient, transcribed, then deleted. Sources: `server/routes/interviewStudioRoutes.ts:218-244,251-299,412-425,874-941`.

A common session payload contains `{id,templateId,templateKey,templateVersion,mode,status,blueprint,navigation,consent,permissions,deadlineAt,serverNow,startedAt,submittedAt,completedAt,retentionUntil,overallScore,evaluationStatus,evaluation,recruiterSharingEnabled:false,responses}`. `blueprint.items` contains only the currently revealed sanitized item (or none), never the full future prompt set. `navigation` is `{currentIndex,revealedCount,totalItems,canRevealNext,cursor}`; its signed cursor binds the learner, session and current index. Response summaries contain `itemKey,itemKind,responseText,answerText,code,language,timeSpentSeconds,sampleTestResult,evaluationStatus,evaluation,isFinal,updatedAt`; hidden test results and internal response IDs are omitted. Source: `server/routes/interviewStudioRoutes.ts:251-321`.

### `GET /api/interview-studio/status`
- **Auth:** public. **Input:** none.
- **Success:** `{practiceEnabled,verifiedEnabled:false,aiEvaluationEnabled,voiceTranscriptionEnabled,codeRunnerEnabled,recordingEnabled:false,evaluationWorkerEnabled,consentVersion,limitations:string[]}`.
- **Errors:** none explicitly. **Source:** `server/routes/interviewStudioRoutes.ts:324-327`.

### `GET /api/interview-studio/templates`
- **Auth:** JWT. **Success:** `{items:Array<{id,key,templateKey,version,title,targetRole,description,summary,skills,difficulty,durationMinutes,availableModes,blueprint}>}`.
- **Errors:** `503 INTERVIEW_STUDIO_DISABLED`; integrity errors `500`; JWT errors. **Source:** `server/routes/interviewStudioRoutes.ts:329-363`.

### `GET /api/interview-studio/sessions`
- **Auth:** JWT. **Success:** `{items:Array<{id,templateKey,templateVersion,mode,status,overallScore,evaluationStatus,startedAt,completedAt,retentionUntil,createdAt}>}` (max 50).
- **Errors:** JWT/unhandled `500`. **Source:** `server/routes/interviewStudioRoutes.ts:365-384`.

### `POST /api/interview-studio/sessions`
- **Auth:** JWT. **Body (strict):** `{templateId?:positive integer,templateKey?:string 3..120,mode:"practice"|"verified",consent:{aiProcessing:boolean,microphone:boolean,camera:boolean,screen:boolean,consentVersion:string 3..120}}`; one template identifier required.
- **Success:** `201` common session payload. Practice retention is 30 days.
- **Errors:** `400`; `404`; `409 VERIFIED_INTERVIEW_NOT_READY`, `INTERVIEW_CONSENT_OUTDATED`, or unsupported mode; `503`; `429`. **Source:** schema `server/routes/interviewStudioRoutes.ts:54-70`; route `386-467`.

### `GET /api/interview-studio/sessions/:sessionId`
- **Auth:** JWT owner. **Success:** common session payload.
- **Errors:** `404`; JWT errors. **Source:** `server/routes/interviewStudioRoutes.ts:469-474`.

### `POST /api/interview-studio/sessions/:sessionId/start`
- **Auth:** JWT owner. **Body (strict, optional):** `{permissions?:{camera:boolean,microphone:boolean,screen:boolean}}`.
- **Success:** common session payload revealing only item index 0 plus its signed navigation cursor; idempotently returns an already in-progress session.
- **Errors:** `400`; `404`; `409 INTERVIEW_INVALID_STATE`; `410 INTERVIEW_SESSION_EXPIRED`; `429`. **Source:** schema `server/routes/interviewStudioRoutes.ts:110-116`; route `server/routes/interviewStudioRoutes.ts:519-590`.

### `POST /api/interview-studio/sessions/:sessionId/items/next`
- **Auth:** JWT owner. **Body (strict):** `{cursor:string}` using the current payload's signed cursor.
- **Success:** common session payload revealing only the next sanitized item and a new cursor; private/no-store.
- **Errors:** `400` missing/invalid cursor; `404`; `409 INTERVIEW_INVALID_STATE`, `INTERVIEW_DEADLINE_PASSED`, `INTERVIEW_NAVIGATION_STALE`, `INTERVIEW_NO_NEXT_ITEM`, or `INTERVIEW_CURRENT_RESPONSE_REQUIRED`; `429`. The current response must already be saved. **Source:** schema `server/routes/interviewStudioRoutes.ts:72-74`; route `server/routes/interviewStudioRoutes.ts:592-637`.

### `PUT /api/interview-studio/sessions/:sessionId/responses/:itemKey`
- **Auth:** JWT owner. **Body (strict):** `{responseText?:string<=20000,answerText?:string<=20000,code?:string<=50KB UTF-8,language?:"javascript",navigationCursor:string,timeSpentSeconds?:integer 0..86400}`. The cursor must currently reveal `itemKey`.
- **Success:** `{saved:true,response:<response DB row>,serverNow}` or `{saved:false,reason:"empty_response",serverNow}`.
- **Errors:** `400`; `404`; `409` state/deadline; `422 INTERVIEW_RESPONSE_WORD_LIMIT`; `429`. **Source:** schema `server/routes/interviewStudioRoutes.ts:72-86`; route `537-598`.

### `POST /api/interview-studio/sessions/:sessionId/events`
- **Auth:** JWT owner. **Body:** discriminated event allowlist: `eventType` one of `camera_microphone_ready`, `camera_microphone_unavailable`, `camera_permission_ended`, `microphone_permission_ended`, `screen_share_ready`, `screen_share_ended`, `screen_share_unavailable`, `network_offline`, `network_online`, `focus_left`, `focus_returned`; optional `idempotencyKey`, `occurredAt`, `severity`; event-specific bounded metadata.
- **Success:** `202 {accepted:true}`.
- **Errors:** `400`; `404`; `409`; `429`. No image/video/device fingerprint payload is accepted. **Source:** schema `server/routes/interviewStudioRoutes.ts:96-143`; route `600-662`.

### `POST /api/interview-studio/sessions/:sessionId/run-samples`
- **Auth:** JWT owner. **Body (strict):** `{itemKey:string 3..120,code:string<=50KB,language:"javascript",navigationCursor:string}`. The cursor must currently reveal the coding item.
- **Success:** sanitized code-run result spread plus `{result:<same>,responseId:number}`.
- **Errors:** `400`; `404`; `409` state/deadline; `503 CODE_RUNNER_DISABLED`; `429 INTERVIEW_RUN_LIMITED`; runner failure usually `502 CODE_RUN_FAILED`. **Source:** schema `server/routes/interviewStudioRoutes.ts:96-107`; route `664-724`.

### `POST /api/interview-studio/sessions/:sessionId/submit`
- **Auth:** JWT owner. **Body:** none.
- **Success:** normally `202 {status:"evaluating",evaluationStatus:"pending",message}`; already finished returns common payload; already evaluating returns `202` status/message.
- **Errors:** `404`; `409 INTERVIEW_SUBMISSION_STATE_CHANGED`/invalid state; configured quota/worker errors; `429`. **Source:** `server/routes/interviewStudioRoutes.ts:726-790`.

### `POST /api/interview-studio/sessions/:sessionId/transcribe/:itemKey`
- **Auth:** JWT owner. **Body:** `multipart/form-data`, fields `audio` and the current `navigationCursor`; MIME `audio/webm|audio/mp4|audio/mpeg|audio/wav|audio/x-wav`, max 15 MiB. Container signatures reject video tracks.
- **Success:** `{text:string,model:string,rawAudioRetained:false}`; file is deleted in `finally`.
- **Errors:** `400 INTERVIEW_AUDIO_INVALID`; `403` missing microphone + AI consent; `404`; `409`; `413`; `429 INTERVIEW_TRANSCRIPTION_RATE_LIMITED`; `502/503 INTERVIEW_TRANSCRIPTION_FAILED`. **Source:** upload/schema `server/routes/interviewStudioRoutes.ts:792-892`; route `893-941`.

### `DELETE /api/interview-studio/sessions/:sessionId`
- **Auth:** JWT owner. **Input:** none.
- **Success:** `204`; if an evaluation job is running, `202 {deleted:false,deletionPending:true}`.
- **Errors:** `404`; `409` shared/nonpractice evidence; `429`. **Source:** `server/routes/interviewStudioRoutes.ts:943-993`.

## Adjacent upload/media routes that are **not** interview video support

- `POST /api/upload` is JWT multipart resume upload only: field `file`, PDF/DOC/DOCX, max 5 MiB; returns `{success,fileUrl,fileName,fileSize}`. `GET /api/uploads/resumes/:filename` returns only the current user's prefixed file. Sources: `server/routes/upload.ts:12-80`.
- `POST /api/uploads/sign` is JWT and accepts `{kind,filename,contentType,sizeBytes}`, but `kind` is limited to `course.thumbnail`, `lesson.video`, `lesson.pdf`, `avatar`; it returns a public S3-compatible PUT contract or `503 configured:false`. It has no interview/profile-video kind and no endpoint linking a resulting video to a learner profile/interview. Source: `server/routes/featureRoutes.ts:215-337`.
- `POST /api/media` can upload MP4/WebM/MOV, but it and media management (`GET /api/media`, `GET/PATCH/DELETE /api/media/:id`) require a **creator or institute author workspace**, returning `403 MEDIA_AUTHOR_WORKSPACE_REQUIRED` for ordinary learners. Sources: `server/routes/mediaRoutes.ts:125-231,260-324`.
- `GET /api/media/files/:filename` serves only image kinds; video/document direct access deliberately returns 404. Owner preview uses `/api/media/:id/content-session` then an HttpOnly cookie at `/api/media/:id/content`. Sources: `server/routes/mediaRoutes.ts:234-258`; `server/routes/featureRoutes.ts:793-850`.

# 8. Learner profile and preferences (6 verified endpoints)

### `GET /api/user/profile`
- **Auth:** JWT. **Success:** `{name,email,phone,company,position,location,experience,currentRole,skills,availability,noticePeriod,expectedSalary,workType,category,linkedinProfile,portfolioUrl,bio,careerGoals,profileVisibility,evidencePassportPublic,profileCompleteness,resume}`.
- **Errors:** `404 {error:"User not found"}`; `500`. **Source:** `server/routes/userProfileRoutes.ts:38-80`.

### `PUT /api/user/profile`
- **Auth:** JWT. **Body (all optional):** `name:string(min2)`, `phone/company/position/location/currentRole/availability/noticePeriod/expectedSalary/bio/careerGoals:string`, `experience:number 0..50`, `skills/workType/category:string[]`, `linkedinProfile/portfolioUrl:http(s) URL or ""`, `profileVisibility:boolean`, `evidencePassportPublic:boolean`, `resume:string<=500`.
- **Success:** `{message:"Profile updated successfully",profileCompleteness:number}`.
- **Errors:** `400 {error:"Invalid data",details}`; `404`; `500`. **Source:** schema/route `server/routes/userProfileRoutes.ts:9-35,83-125`.

### `GET /api/preferences`
- **Auth:** JWT. **Success:** saved preference row or defaults `{id:0,userId,preferredCategories:[],skillLevel:"novice",learningGoals:[],notificationSettings:{email:true,push:true,frequency:"weekly",courseRecommendations:true,newCourses:true,achievements:true}}`.
- **Errors:** `500`. **Source:** `server/routes/preferenceRoutes.ts:10-46`.

### `PUT /api/preferences`
- **Auth:** JWT. **Body (strict, optional fields):** `preferredCategories:string[<=30]` (each 1..80), `skillLevel:"novice"|"beginner"|"intermediate"|"advanced"|"expert"`, `learningGoals:string[<=20]` (each 1..100), `notificationSettings:{email:boolean,push:boolean,frequency:"daily"|"weekly"|"monthly",courseRecommendations:boolean,newCourses:boolean,achievements:boolean}`.
- **Success:** saved preference DB row.
- **Errors:** `400 {message:"Invalid preferences",errors}`; `500`. **Source:** `server/routes/preferenceRoutes.ts:7-28,48-69`.

### `POST /api/upload`
- **Auth:** JWT. **Body:** multipart `file` (PDF/DOC/DOCX, max 5 MiB).
- **Success:** `{success:true,fileUrl,fileName,fileSize}`. Save `fileUrl` separately through `PUT /api/user/profile {resume:fileUrl}`.
- **Errors:** `400`; multer `4xx`; `500`. **Source:** `server/routes/upload.ts:12-65`.

### `GET /api/uploads/resumes/:filename`
- **Auth:** JWT owner by filename prefix. **Success:** file bytes.
- **Errors:** `403`; `404`. **Source:** `server/routes/upload.ts:68-80`.

# 9. Learner account deletion (4 verified endpoints)

All four routes require the learner JWT and derive the deletion subject only from `req.user.userId`; clients never send a user ID. Responses set `Cache-Control: private, no-store`. A state response is `{state:"none"}` when no request exists, otherwise `{requestId,state:"requested"|"verified"|"completed"|"cancelled"|"rejected",requestedAt,tokenExpiresAt,verifiedAt,completedAt,cancelledAt,rejectedAt,irreversible}`. `tokenExpiresAt` is present only while requested; `irreversible` is true only after completion. Sources: routes/response projection `server/routes/accountRoutes.ts`; transactional policy and lifecycle `server/lib/account-deletion.ts`.

### `GET /api/account/deletion`
- **Auth:** JWT owner. **Input:** none.
- **Success:** `200` current state response, including `{state:"none"}` when no request exists.
- **Errors:** standard JWT `401`; `500 {message:"Account deletion could not be completed",code:"ACCOUNT_DELETION_FAILED"}`.

### `POST /api/account/deletion`
- **Auth:** JWT owner. **Body:** none. Rate-limited to three requests per learner per hour.
- **Success:** `202` state response. A new request emails a random verification token that expires after 30 minutes; an existing requested/verified/completed request is returned without creating another.
- **Errors:** `429 ACCOUNT_DELETION_RATE_LIMITED`; `503 ACCOUNT_DELETION_EMAIL_UNAVAILABLE` when verification email delivery fails (the created request is rejected); standard JWT `401`; `500`.

### `POST /api/account/deletion/confirm`
- **Auth:** JWT owner. **Body:** `{token:string}`; token length must be 20–200 characters.
- **Success:** `200` completed state response. Completion is irreversible and transactionally erases/de-identifies the learner account; replay of an already completed request is idempotent at the service layer.
- **Errors:** `400 INVALID_DELETION_TOKEN`; `403 INVALID_DELETION_TOKEN`; `404 DELETION_REQUEST_NOT_FOUND` or `ACCOUNT_NOT_FOUND`; `409 LEARNER_ACCOUNT_REQUIRED` for creator/institute/admin accounts and artifact-cleanup policy errors; `410 DELETION_TOKEN_EXPIRED_OR_USED`; standard JWT `401`; `500 ACCOUNT_DELETION_FAILED`.

### `DELETE /api/account/deletion`
- **Auth:** JWT owner. **Body:** none.
- **Success:** `200` cancelled state response; the token hash and expiry are removed.
- **Errors:** `409 NO_PENDING_DELETION`; standard JWT `401`; `500`.

**Completion policy:** authentication/profile/contact data, addresses, resume files, preferences/notifications, learning progress/reviews, Interview Studio responses/artifact references, and active evidence grants are erased or revoked. Issued credentials/public verification, assessment attempts/aggregate statistics, payment/tax/coupon records, and audit/recruiter-evidence events are retained only in de-identified form. Credentials remain verifiable; financial records remain for legal/accounting obligations; audit records remain for security/compliance. The user row loses password/OAuth identifiers and becomes `Deleted account` with a non-routable deleted email. Mobile must clear its token and all user-scoped local data after a completed response.

# 10. Recruiter discovery and learner evidence-sharing consent (15 verified endpoints)

There are two separate learner opt-ins:

1. `profileVisibility` controls recruiter discovery. Search also requires a current paid/active/unexpired certificate; an actively affiliated institute must be verified and have its own recruiter-discovery policy enabled. Sources: schema `shared/schema.ts:177-190`; enforcement `server/storage.ts:2822-2975`.
2. `evidencePassportPublic` controls public evidence-passport-by-link. It does not make the learner recruiter-searchable by itself. Source: `server/routes/evidencePassportRoutes.ts:49-143`.

The two booleans are read and changed through `GET/PUT /api/user/profile`. They remain separate from the selected, expiring, revocable per-recruiter evidence-grant APIs below; `profileVisibility` is discovery-only and never grants evidence access.

### `GET /api/user/evidence-passport-link`
- **Auth:** JWT. **Success:** `{token:string,path:"/evidence/<token>",isPublic:boolean}`. Token is deterministic HMAC of user ID, not expiring.
- **Errors:** `404`; `500`. **Source:** `server/routes/evidencePassportRoutes.ts:13-66`.

### `GET /api/evidence/:token`
- **Auth:** public, but returns 404 unless token is valid and `evidencePassportPublic===true`.
- **Success:** `{holder:{name,currentRole,location,bio,selfReportedSkills,workType,portfolioUrl,linkedinProfile},summary:{activeEvidenceCount,totalEvidenceCount,averageScore,lastIssuedAt},evidence:Array<{certificateId,courseTitle,score,badge,issuedAt,expiresAt,issuedBy,status,assessment:{completedAt,questionCount,durationSeconds,passingScore,level}}>,generatedAt}`.
- **Errors:** `404` invalid/private/unknown; `500`. **Source:** `server/routes/evidencePassportRoutes.ts:68-143`.

### Selected recruiter evidence grants

All learner routes require a learner JWT. Grant creation requires a prior legitimate recruiter profile-view interaction, an active/KYC-approved recruiter, purpose, consent version `candidate-evidence-consent.v1`, expiry within 30 days, and 1–50 selected current learner-owned items. Certification credentials must remain active, paid, unexpired, approved, and certification-purpose. Optional Practice entries are summary-only from approved Practice-purpose assessments; answers, question data, raw integrity telemetry, device/network data, and Interview Studio are excluded.

- `GET /api/user/evidence-grants/eligible-recruiters` — eligible active/KYC recruiters with prior interaction.
- `GET /api/user/evidence-grants/options` — allowlisted learner certification and non-Interview Practice summary options.
- `POST /api/user/evidence-grants` — create a purpose-bound grant with `{targetRecruiterId,purpose,jobReference?,consentVersion,expiresAt?,certificateIds,practiceSummaryIds}`; omitted `expiresAt` defaults to seven days.
- `GET /api/user/evidence-grants` — newest-first grant history, status, recruiter company, and selected evidence.
- `POST /api/user/evidence-grants/:grantId/revoke` — immediate learner revocation with `{version,reason?}` optimistic concurrency.
- `GET /api/user/evidence-grants/access-history` — bounded, learner-visible append-only access events.
- `GET /api/recruiter/selected-candidates/:learnerId/evidence-grants` — recruiter JWT; lists only active grants targeting that recruiter after recruiter/KYC and exact profile-interaction checks.
- `GET /api/recruiter/selected-candidates/:learnerId/evidence/:grantId` — recruiter JWT; revalidates recruiter state/KYC, target learner, profile-access relationship, grant target/state/purpose, ownership, and each selected item on every request. Returns only selected summaries with `private, no-store` and records access before responding.

The following legacy recruiter-role APIs are documented so mobile does not mistake them for learner calls:

### `POST /api/recruiter/search`
- **Auth:** recruiter JWT; recruiter must be active and KYC-approved. **Body:** `{filters?:object,page?:number,limit?:number}`; limit 1..50. Supported filters read by storage: `location`, `experience:{min,max}`, `availability`, `noticePeriod`, `skills[]`, `technology[]`, `workType[]`, `category[]`, `hasInterviews` (currently forces no results), `minScore`.
- **Success:** `{candidates:Array<{id,name,location,experience,currentRole,skills,availability,noticePeriod,workType,category,profileCompleteness,hasResume,interviewCount:0,profileUnlocked,cvUnlocked,interviewUnlocked:false,certificates:[],evidenceGrantRequired:true,access}>,total,page,totalPages,creditCosts,eligibility}`. Discovery never includes credential or activity evidence.
- **Errors:** `401`; `403`; `500`. **Source:** route `server/routes/recruiterRoutes.ts:351-379`; shape/enforcement `server/storage.ts:2822-2975`.

### `POST /api/recruiter/access-profile`
- **Auth:** active, KYC-approved recruiter JWT. **Body:** `{candidateId:positive integer,accessType:"view"|"cv"|"interview"}`.
- **Success:** storage unlock/credit result for view/CV, idempotently charged under DB locking.
- **Errors:** `400`; `402/403/404` policy/balance/consent errors; `410 VERIFIED_INTERVIEW_EVIDENCE_NOT_RELEASED` for interview; `500`. **Source:** `server/routes/recruiterRoutes.ts:381-423`; transaction `server/storage.ts:3063+`.

### `GET /api/recruiter/candidate/:id`
- **Auth:** active, KYC-approved recruiter JWT with prior profile-view unlock. **Success:** consent-rechecked discovery profile `{id,email,name,location,experience,currentRole,skills,availability,noticePeriod,expectedSalary,workType,category,linkedinProfile,portfolioUrl,bio,careerGoals,profileCompleteness,hasResume,certificates:[],interviews:[],evidenceGrantRequired:true,cvAccessUnlocked,interviewAccessUnlocked:false,creditCosts,profileViews:0}`.
- **Errors:** `400`; `402` unlock required; `403`; `404` (including withdrawn consent); `500`. **Source:** route `server/routes/recruiterRoutes.ts:530-570`; shape/gates `server/storage.ts:2977-3061`.

### `GET /api/recruiter/download-cv/:id`
- **Auth:** active, KYC-approved recruiter JWT with prior CV unlock; learner/institute consent and evidence are rechecked every request.
- **Success:** redirect to HTTPS resume or local file bytes.
- **Errors:** `400`; `403`; `404`; `500`. **Source:** `server/routes/recruiterRoutes.ts:572-608`.

### `POST /api/recruiter/access-interview-video`
- **Auth:** recruiter JWT. **Body:** ignored.
- **Result:** always `410 {message,code:"LEGACY_INTERVIEW_EVIDENCE_RETIRED"}`. **Source:** `server/routes/recruiterRoutes.ts:781-793`.

# FEATURES WITH NO BACKEND ENDPOINT

The following requested capabilities are not available as callable, released backend contracts:

1. **In-progress public exam answer save/sync/recovery:** no save-progress endpoint and no GET active-session endpoint. Only local answer recovery plus idempotent final submit/temp-result replay is possible.
2. **Interview video recording/upload:** Interview Studio explicitly reports `recordingEnabled:false`; camera/screen are local readiness checks only. No learner interview video upload, resumable upload, playback proxy, recording metadata, or retention endpoint exists.
3. **Learner profile video capture:** the user profile has no profile-video field and no learner profile-video linking endpoint. Generic signed/media uploads do not create this feature.
4. **Verified Interview Studio sessions/evidence:** `mode:"verified"` is rejected with `409 VERIFIED_INTERVIEW_NOT_READY`.
5. **Recruiter access to Interview Studio evidence:** session payload hard-codes `recruiterSharingEnabled:false`; no learner grant/revoke/playback endpoint exists. Legacy recruiter interview video access is `410`.
6. **Interview Studio recruiter sharing:** per-recruiter grants support selected certifications and optional non-Interview Practice summaries only. Interview Studio sessions, recordings, transcripts, and raw integrity evidence remain unavailable to recruiters.
7. **Native mobile subscription purchase / App Store or Play Store receipt validation:** Practice Pass has a Cashfree web checkout handoff and server webhook confirmation, but no Apple/Google IAP product, purchase-token, receipt-validation, restore-purchases, or store-subscription webhook endpoint.
8. **True recurring Practice Pass billing management:** current schema comments explicitly describe Cashfree one-off orders with renewal tracked manually. There is no cancel, pause, change-plan, billing portal, or auto-renew management endpoint for learners.
9. **Client-side payment confirmation:** deliberately absent. There is no trusted “mark paid/confirm subscription” mobile endpoint; fulfillment is provider-callback-only.
10. **Learner JWT refresh/revocation/session listing:** no refresh token, revoke, device-session, or server-side logout endpoint.
11. **Native Google OAuth token exchange/deep-link callback:** current callback redirects to the web `/login` fragment only.
12. **Practice Pass certification redemption:** endpoint exists only to reject this with `PRACTICE_PASS_ONLY`; Practice Pass unlocks practice exams, not recruiter-visible certification credentials.

## Retired legacy AI interview paths

Legacy `/api/interviews/...` declarations later in `server/routes.ts` are not usable: `app.all([...RETIRED_AI_INTERVIEW_PATHS], retiredAiInterviewHandler)` intercepts them before those handlers and returns Gone. Source: interceptor `server/routes.ts:504-507`; retired path source `server/lib/retired-ai-interview.ts` (import at `server/routes.ts:126-129`). Do not integrate `/api/interview-technologies`, `/api/interviews/initiate-payment`, `/api/interviews/:id`, `/api/interviews/:id/submit`, or payment/upload variants.

# Endpoint count summary

Counts are unique method + full-path contracts documented above (aliases count separately):

| Area | Verified endpoint count |
|---|---:|
| Authentication | 14 |
| Catalog | 12 |
| Enrollment/access | 3 |
| Exam attempts/results | 6 |
| Certificates | 8 |
| Payments/subscriptions | 12 |
| Private Interview Studio | 13 |
| Learner profile/preferences | 6 |
| Account deletion | 4 |
| Recruiter discovery/evidence consent | 15 |
| **Total** | **85** |

Adjacent generic upload/media routes and retired 410 intercepts are explained but not counted as supported learner feature endpoints.
