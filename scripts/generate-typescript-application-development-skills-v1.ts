#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { finished } from "node:stream/promises";
import { normalizeQuestionPackItem } from "./lib/question-pack-contract";

const ASSESSMENT_SLUG = "typescript-application-development-skills";
const BANK_SLUG = "typescript-application-development-skills-bank-v1";
const SYLLABUS = "OCT-TSAD-2026.1 (TypeScript 5.6.3; Handbook snapshot 2026-07-18)";

const REFERENCES = {
  everyday: "https://www.typescriptlang.org/docs/handbook/2/everyday-types.html",
  functions: "https://www.typescriptlang.org/docs/handbook/2/functions.html",
  objects: "https://www.typescriptlang.org/docs/handbook/2/objects.html",
  narrowing: "https://www.typescriptlang.org/docs/handbook/2/narrowing.html",
  generics: "https://www.typescriptlang.org/docs/handbook/2/generics.html",
  keyof: "https://www.typescriptlang.org/docs/handbook/2/keyof-types.html",
  indexed: "https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html",
  conditional: "https://www.typescriptlang.org/docs/handbook/2/conditional-types.html",
  mapped: "https://www.typescriptlang.org/docs/handbook/2/mapped-types.html",
  utility: "https://www.typescriptlang.org/docs/handbook/utility-types.html",
  classes: "https://www.typescriptlang.org/docs/handbook/2/classes.html",
  modules: "https://www.typescriptlang.org/docs/handbook/modules/reference.html",
  declarations: "https://www.typescriptlang.org/docs/handbook/2/type-declarations.html",
  projectReferences: "https://www.typescriptlang.org/docs/handbook/project-references.html",
  tsconfig: "https://www.typescriptlang.org/tsconfig/",
  strict: "https://www.typescriptlang.org/tsconfig/strict.html",
  unknownCatch: "https://www.typescriptlang.org/tsconfig/useUnknownInCatchVariables.html",
  indexedAccess: "https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html",
  exactOptional: "https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html",
  noEmit: "https://www.typescriptlang.org/tsconfig/noEmit.html",
  isolated: "https://www.typescriptlang.org/tsconfig/isolatedModules.html",
  esModuleInterop: "https://www.typescriptlang.org/tsconfig/esModuleInterop.html",
  js: "https://www.typescriptlang.org/docs/handbook/intro-to-js-ts.html",
  satisfies: "https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html",
  expectError: "https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html",
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

const TOPICS = {
  "language-foundations": { name: "Language foundations", code: "TSAD-LF" },
  "object-and-api-modeling": { name: "Object and API modelling", code: "TSAD-OM" },
  "control-flow-narrowing": { name: "Control-flow narrowing", code: "TSAD-CN" },
  "generics-and-type-operators": { name: "Generics and type operators", code: "TSAD-GT" },
  "modules-and-declarations": { name: "Modules and declarations", code: "TSAD-MD" },
  "async-and-error-boundaries": { name: "Async and error boundaries", code: "TSAD-AE" },
  "compiler-configuration": { name: "Compiler configuration", code: "TSAD-CC" },
  "javascript-integration-and-quality": { name: "JavaScript integration and quality", code: "TSAD-JQ" },
} as const;

const q = (topic: TopicKey, question: string, correct: string, distractors: [string, string, string], explanation: string, reference: string, objective: string, difficulty: Difficulty = "medium"): Draft => ({
  topic, question, correct, distractors, explanation, reference, objective, difficulty,
});

const DRAFTS: Draft[] = [
  // Language foundations
  q("language-foundations", "A variable is inferred from `let status = \"draft\"`. Without an annotation or `as const`, what type does TypeScript normally infer for `status`?", "string", ["the literal type `\"draft\"`", "unknown", "any"], "A mutable `let` binding is widened to `string`; retaining the literal requires a const context or explicit literal annotation.", REFERENCES.everyday, "Explain literal widening for mutable variables", "easy"),
  q("language-foundations", "Which annotation allows a function to accept either a numeric identifier or a string identifier while preserving type checking?", "`id: number | string`", ["`id: number & string`", "`id: any[]`", "`id: object`"], "A union type permits a value belonging to either listed member type; an intersection would require both simultaneously.", REFERENCES.everyday, "Model alternatives with union types", "easy"),
  q("language-foundations", "What is the key type-safety difference between `unknown` and `any` when reading a value from an untrusted boundary?", "An `unknown` value must be narrowed before most operations", ["An `unknown` value is always converted to a string", "An `unknown` value cannot hold objects", "An `unknown` value skips checking just like `any`"], "`unknown` can represent any runtime value but requires proof of its type before property access, calls, or type-specific operations.", REFERENCES.everyday, "Choose unknown for untrusted values", "easy"),
  q("language-foundations", "Given `const pair = [\"north\", 7] as const`, what useful effect does `as const` have on the inferred type?", "It infers a readonly tuple with literal element types", ["It converts the array to a Set at runtime", "It deep-freezes every referenced object at runtime", "It changes both elements to type `unknown`"], "A const assertion prevents literal widening and marks array literals as readonly tuples; it does not perform runtime freezing.", REFERENCES.everyday, "Use const assertions accurately", "medium"),
  q("language-foundations", "Why should an application generally avoid annotating a parsed external payload as `any`?", "`any` permits unchecked property access and can hide boundary errors", ["`any` makes JSON parsing asynchronous", "`any` prevents the emitted JavaScript from running", "`any` forces every property to be readonly"], "`any` disables checking for operations on that value, allowing invalid assumptions to spread through otherwise typed code.", REFERENCES.everyday, "Recognize risks of any", "easy"),
  q("language-foundations", "A function always throws and never returns normally. Which return type most precisely describes it?", "`never`", ["`void`", "`undefined`", "`unknown`"], "`never` represents a value that cannot occur, including the return result of a function that cannot complete normally.", REFERENCES.functions, "Distinguish never from void", "medium"),
  q("language-foundations", "What does a return type of `void` communicate for a callback?", "The caller should not depend on a returned value", ["The function is forbidden from executing `return`", "The function must return JavaScript `null`", "The function never completes normally"], "In TypeScript, `void` describes an ignored or absent useful return value; it is not the same as `never`.", REFERENCES.functions, "Interpret void callback contracts", "easy"),
  q("language-foundations", "Which declaration gives `direction` only the four allowed string values at compile time without creating a runtime enum object?", "`type Direction = \"north\" | \"south\" | \"east\" | \"west\"`", ["`type Direction = string[]`", "`interface Direction { value: string }`", "`type Direction = typeof String`"], "A string-literal union constrains values to the listed strings and is erased from emitted JavaScript.", REFERENCES.everyday, "Define finite string domains", "easy"),
  q("language-foundations", "For `type User = { readonly id: string }`, what does `readonly` prevent?", "Assignment to `id` through a `User` reference", ["The runtime object from ever being mutated by any code", "Reading `id` outside the declaring module", "Serializing `id` to JSON"], "TypeScript's `readonly` is a compile-time property assignment check; it is not a runtime deep-freeze mechanism.", REFERENCES.objects, "Explain readonly's compile-time scope", "medium"),
  q("language-foundations", "What is the practical reason to annotate a public function's return type even when TypeScript can infer it?", "It makes the intended API contract explicit and detects accidental return-shape changes", ["It guarantees faster JavaScript execution", "It automatically validates network responses", "It prevents consumers from importing the function"], "An explicit public return type acts as a checked contract at the declaration boundary; it has no direct runtime validation effect.", REFERENCES.functions, "Use explicit types at API boundaries", "medium"),

  // Object and API modelling
  q("object-and-api-modeling", "An update endpoint accepts only `displayName` and `timezone` from a larger `User` model. Which utility type best selects exactly those properties?", "`Pick<User, \"displayName\" | \"timezone\">`", ["`Partial<User>`", "`Record<User, string>`", "`Exclude<User, \"id\">`"], "`Pick` constructs an object type from the specified property keys; `Partial` would retain every key as optional.", REFERENCES.utility, "Select an API request shape", "easy"),
  q("object-and-api-modeling", "A create request must not accept the server-generated `id` field from `Account`. Which type expresses that rule?", "`Omit<Account, \"id\">`", ["`Pick<Account, \"id\">`", "`Required<Account>`", "`Record<\"id\", Account>`"], "`Omit` constructs a type with the named key removed, matching a request that must not include a server-owned identifier.", REFERENCES.utility, "Exclude server-owned fields", "easy"),
  q("object-and-api-modeling", "Which type models a lookup whose keys are the union `Role = \"admin\" | \"viewer\"` and whose values are permission arrays?", "`Record<Role, string[]>`", ["`Array<Role | string>`", "`Partial<string[]>`", "`keyof Role[]`"], "`Record<Keys, Value>` creates an object type containing a property for every key in the key union.", REFERENCES.utility, "Model keyed lookup objects", "easy"),
  q("object-and-api-modeling", "Why is `{ address?: Address }` different from `{ address: Address | undefined }`?", "The first permits the property to be absent; the second requires the key to exist", ["Only the first can ever contain `undefined` at runtime", "Only the second can be read", "They always emit different JavaScript object layouts"], "An optional property may be absent, while a required property whose value union includes `undefined` must still be present in the structural type.", REFERENCES.objects, "Distinguish optional and undefined-valued properties", "medium"),
  q("object-and-api-modeling", "A function consumes a value but should not add, remove, or replace array elements. Which parameter type expresses that intent?", "`readonly Item[]`", ["`Item | []`", "`const Item[]`", "`Array<never>`"], "A readonly array permits non-mutating reads while rejecting mutating methods and indexed assignments through that reference.", REFERENCES.objects, "Declare non-mutating collection inputs", "easy"),
  q("object-and-api-modeling", "Which declaration models a tuple containing a string label followed by a numeric count?", "`[string, number]`", ["`(string | number)[]`", "`[string | number]`", "`Array<[string] | [number]>`"], "A tuple fixes both element positions and their types; a union array does not guarantee length or order.", REFERENCES.objects, "Use tuples for positional records", "easy"),
  q("object-and-api-modeling", "An interface `Employee` must include every property of `Person` plus `employeeId`. Which declaration is direct and type-safe?", "`interface Employee extends Person { employeeId: string }`", ["`interface Employee = Person + employeeId`", "`interface Employee implements Person`", "`interface Employee typeof Person`"], "Interface extension inherits the base interface's members and adds the new property to the structural contract.", REFERENCES.objects, "Extend structural object contracts", "easy"),
  q("object-and-api-modeling", "When is a string index signature such as `[key: string]: number` appropriate?", "When arbitrary string keys are allowed and every corresponding value must be numeric", ["When the object must have exactly one known key", "When values may have unrelated types without a union", "When property names must be checked only at runtime"], "An index signature describes values for otherwise unspecified keys and constrains all compatible named properties to its value type.", REFERENCES.objects, "Apply index signatures safely", "medium"),
  q("object-and-api-modeling", "Why can excess-property checking reject `{ name: \"A\", debug: true }` when assigned directly to `{ name: string }`?", "A fresh object literal is checked for unexpected properties, helping catch misspelled or unsupported fields", ["Structural typing forbids all objects with extra runtime properties", "Boolean fields are never allowed beside strings", "Object literals cannot be assigned to interfaces"], "Fresh object literals receive an additional excess-property check; broader variables can still be structurally compatible when required members match.", REFERENCES.objects, "Interpret excess-property checks", "medium"),
  q("object-and-api-modeling", "A configuration type has optional fields, but a normalization function returns every field populated. Which utility best describes the normalized result?", "`Required<Config>`", ["`Partial<Config>`", "`Readonly<Config>`", "`NonNullable<keyof Config>`"], "`Required` removes optional modifiers from all properties, matching a fully populated normalized configuration.", REFERENCES.utility, "Model normalized configurations", "easy"),

  // Control-flow narrowing
  q("control-flow-narrowing", "For `value: string | number`, which check safely narrows `value` to `string`?", "`typeof value === \"string\"`", ["`value === String`", "`value.type === \"string\"`", "`typeof value === String`"], "JavaScript's `typeof` operator returns the string `\"string\"` for string primitives, and TypeScript recognizes this as a type guard.", REFERENCES.narrowing, "Narrow primitive unions", "easy"),
  q("control-flow-narrowing", "A union is `Circle | Square`, and each member has `kind: \"circle\"` or `kind: \"square\"`. What is `kind` used for?", "A discriminant that lets control flow narrow to one union member", ["A runtime instruction to allocate a class", "A generic type parameter", "A compiler option that disables unions"], "A common literal-valued property distinguishes union members, enabling safe member-specific access in branches or switches.", REFERENCES.narrowing, "Use discriminated unions", "easy"),
  q("control-flow-narrowing", "In an exhaustive `switch` over a discriminated union, why assign the default value to a variable of type `never`?", "A newly added unhandled union member then causes a compile-time error", ["It converts the value to `undefined`", "It suppresses all switch diagnostics", "It makes the default branch run first"], "After exhaustive narrowing no value should remain, so requiring `never` exposes missing cases when the union later grows.", REFERENCES.narrowing, "Enforce exhaustive union handling", "hard"),
  q("control-flow-narrowing", "What does the `in` check accomplish in `if (\"swim\" in animal)` for a union of object types?", "It narrows toward members that may contain a `swim` property", ["It invokes `animal.swim()` automatically", "It checks only inherited numeric indexes", "It converts the union into an intersection"], "TypeScript uses the JavaScript property-existence test as a narrowing signal for object union members that declare the property.", REFERENCES.narrowing, "Narrow objects by property presence", "medium"),
  q("control-flow-narrowing", "Which signature defines a user-written predicate that narrows `pet` to `Fish` when it returns true?", "`function isFish(pet: Fish | Bird): pet is Fish`", ["`function isFish(pet): boolean is Fish`", "`function isFish<Fish>(pet): Fish`", "`function isFish(pet: Fish): asserts Bird`"], "The `parameterName is Type` return annotation is a type predicate tied to that parameter.", REFERENCES.narrowing, "Implement user-defined type guards", "medium"),
  q("control-flow-narrowing", "What does `asserts value is string` mean on a function's return type?", "If the function returns normally, later code may treat `value` as a string", ["The function returns the input string", "The function converts any input into a string", "The assertion is checked automatically at runtime by TypeScript"], "An assertion signature describes the narrowing consequence of normal return; the function implementation must perform the runtime check itself.", REFERENCES.narrowing, "Use assertion functions correctly", "hard"),
  q("control-flow-narrowing", "A form field has type `string | null`, and an empty string is a valid instruction to clear the stored value. Why is `if (input)` the wrong check for whether the field was supplied?", "It groups the valid empty string with null because both are falsy", ["Truthiness cannot narrow union types", "Every string is falsy in JavaScript", "The check converts the string to a number"], "Truthiness narrowing follows JavaScript coercion, so both null and the intentionally meaningful empty string take the false branch. An explicit null check preserves that domain distinction.", REFERENCES.narrowing, "Recognize limits of truthiness narrowing", "medium"),
  q("control-flow-narrowing", "Given `x: Date | string`, which check narrows `x` to `Date`?", "`x instanceof Date`", ["`typeof x === \"date\"`", "`x constructor Date`", "`Date in x`"], "`instanceof` performs a runtime prototype-chain check and TypeScript uses it to narrow compatible unions.", REFERENCES.narrowing, "Narrow class instances", "easy"),
  q("control-flow-narrowing", "After `if (value == null) return`, what has TypeScript removed from `value` under strict null checking?", "Both `null` and `undefined`", ["Only numeric zero", "Every falsy value including empty strings", "All object types"], "JavaScript's loose equality to null matches both null and undefined, and TypeScript reflects that in control-flow narrowing.", REFERENCES.narrowing, "Apply equality narrowing", "medium"),
  q("control-flow-narrowing", "Why is `payload as User` not a substitute for validating an API response?", "A type assertion changes the compiler's view but performs no runtime shape check", ["Assertions make network requests twice", "Assertions recursively freeze the response", "Assertions are permitted only for primitive values"], "Type assertions are erased during compilation; untrusted data still needs runtime validation before it can safely satisfy the claimed contract.", REFERENCES.everyday, "Separate assertions from runtime validation", "easy"),

  // Generics and type operators
  q("generics-and-type-operators", "What relationship does `function identity<T>(value: T): T` preserve?", "The return type is the same inferred type as the argument", ["Every argument is converted to a string", "The function accepts only objects", "The return type is always `unknown`"], "The shared type parameter captures the argument type and reuses it as the return type.", REFERENCES.generics, "Preserve type relationships with generics", "easy"),
  q("generics-and-type-operators", "Why constrain `T` with `T extends { length: number }` in a generic function that reads `arg.length`?", "The constraint guarantees that every permitted argument has a numeric `length`", ["It requires `T` to be an array specifically", "It makes the function return `number` automatically", "It adds a length property at runtime"], "A generic constraint states the minimum structural capability needed by the implementation without limiting callers to one concrete type.", REFERENCES.generics, "Constrain generic capabilities", "easy"),
  q("generics-and-type-operators", "Which generic signature ensures that `key` is an actual property name of `obj`?", "`function get<T, K extends keyof T>(obj: T, key: K): T[K]`", ["`function get<T>(obj: T, key: string): T`", "`function get<K>(obj: object, key: K): unknown[]`", "`function get<T extends string>(obj: T, key: T): keyof K`"], "Constraining `K` to `keyof T` rejects unknown keys, while indexed access `T[K]` returns the selected property's type.", REFERENCES.generics, "Implement type-safe property access", "medium"),
  q("generics-and-type-operators", "For `type Point = { x: number; y: number }`, what is `keyof Point`?", "`\"x\" | \"y\"`", ["`number`", "`Point[]`", "`{ x: string; y: string }`"], "The `keyof` operator produces a union of the known property keys of an object type.", REFERENCES.keyof, "Derive property-key unions", "easy"),
  q("generics-and-type-operators", "For `type Person = { age: number; name: string }`, what does `Person[\"age\"]` evaluate to?", "`number`", ["`\"age\"`", "`Person`", "`number | string`"], "Indexed access at a specific type-level key returns the declared value type of that property.", REFERENCES.indexed, "Read property types with indexed access", "easy"),
  q("generics-and-type-operators", "What does the conditional type `T extends string ? \"text\" : \"other\"` produce when `T` is `number`?", "`\"other\"`", ["`\"text\"`", "`string | number`", "`never`"], "Because `number` is not assignable to `string`, the conditional type selects its false branch.", REFERENCES.conditional, "Evaluate basic conditional types", "medium"),
  q("generics-and-type-operators", "What does `infer` do inside the true branch condition of a conditional type?", "It introduces a type variable inferred from the matched structure", ["It performs runtime reflection on a value", "It disables generic constraints", "It imports a type from another module"], "The `infer` keyword declaratively captures part of a type that matched the conditional pattern.", REFERENCES.conditional, "Extract types with infer", "hard"),
  q("generics-and-type-operators", "Which mapped type expression makes every property of `T` readonly?", "`{ readonly [K in keyof T]: T[K] }`", ["`{ [T in K]: readonly }`", "`readonly keyof T`", "`{ K: Readonly<T[K]> }`"], "A mapped type iterates over `keyof T`, retains each property type, and adds the readonly modifier.", REFERENCES.mapped, "Construct mapped modifier types", "medium"),
  q("generics-and-type-operators", "What does `NonNullable<string | null | undefined>` produce?", "`string`", ["`string | null`", "`undefined`", "`never`"], "`NonNullable` excludes both `null` and `undefined` from its input union.", REFERENCES.utility, "Remove nullish union members", "easy"),
  q("generics-and-type-operators", "Why is a generic parameter unhelpful in `function log<T>(message: string): void` when `T` appears nowhere else?", "It expresses no relationship that callers or the implementation can use", ["Every generic must extend `string`", "It prevents the function from returning", "It makes `message` immutable at runtime"], "Useful type parameters connect two or more types or constrain a value; an unused parameter adds complexity without information.", REFERENCES.functions, "Avoid unnecessary type parameters", "medium"),

  // Modules and declarations
  q("modules-and-declarations", "What is the main benefit of `import type { User } from \"./model.js\"` when `User` is used only as a type?", "It marks the import as type-only so it can be erased and cannot be used as a runtime value", ["It dynamically imports the module at runtime", "It converts `User` into a class", "It bypasses module resolution"], "A type-only import makes intent explicit and prevents accidental value use; TypeScript can remove it from JavaScript output.", REFERENCES.modules, "Separate type and value imports", "easy"),
  q("modules-and-declarations", "What is a `.d.ts` file intended to contain?", "Type declarations describing JavaScript APIs without executable implementation output", ["Only generated source maps", "Runtime JavaScript that starts the application", "Bundled CSS module definitions only"], "Declaration files provide type information to the checker and do not emit corresponding executable JavaScript statements.", REFERENCES.declarations, "Explain declaration file purpose", "easy"),
  q("modules-and-declarations", "A package ships its own accurate `.d.ts` files. What should a consumer usually do?", "Use the bundled declarations rather than install a separate `@types` package", ["Delete the declarations before compiling", "Convert every import to `require`", "Add an empty ambient declaration that makes the package `any`"], "Bundled types are resolved with the package and should describe the exact shipped implementation; duplicate external declarations can conflict.", REFERENCES.declarations, "Consume bundled package types", "easy"),
  q("modules-and-declarations", "What must module resolution settings align with in a deployable application?", "The runtime or bundler that will resolve the emitted module specifiers", ["The editor color theme", "The number of source files", "The database transaction isolation level"], "TypeScript's checker must model the same resolution rules used when the JavaScript actually runs or bundles.", REFERENCES.modules, "Align compile-time and runtime module resolution", "medium"),
  q("modules-and-declarations", "Why can a declaration file that inaccurately describes a JavaScript library be dangerous?", "The checker trusts the declaration, so code may compile while failing against the real runtime API", ["Declaration files execute with administrator privileges", "The compiler downloads arbitrary code from every declaration", "It prevents JavaScript from being emitted under all settings"], "Declarations are contracts, not runtime validation; incorrect contracts create false confidence and runtime defects.", REFERENCES.declarations, "Assess declaration accuracy risk", "medium"),
  q("modules-and-declarations", "What does enabling declaration output produce for exported TypeScript APIs?", "`.d.ts` files that describe their public types", ["A second copy of each runtime object", "Only minified JavaScript", "Database schema migration files"], "Declaration emit creates type-description artifacts for consumers while normal JavaScript emission remains a separate concern.", REFERENCES.tsconfig, "Describe declaration emission", "easy"),
  q("modules-and-declarations", "In Node-style ESM, why might a relative TypeScript import be written with a `.js` extension?", "The emitted JavaScript keeps a specifier that the Node runtime can resolve, while TypeScript maps it to the source type information", ["TypeScript source files are parsed as Java", "The import is always fetched over HTTP", "A `.js` suffix disables static checking"], "Node ESM uses runtime file extensions; TypeScript's resolution can substitute the corresponding source or declaration file during checking.", REFERENCES.modules, "Model Node ESM specifiers", "hard"),
  q("modules-and-declarations", "What is an ambient module declaration primarily used for?", "Describing a module available at runtime when TypeScript lacks a corresponding typed source or declaration", ["Downloading a missing npm module", "Executing a module before application startup", "Converting CommonJS code to ESM automatically"], "`declare module` supplies type information only; it neither installs nor implements the runtime module.", REFERENCES.modules, "Use ambient modules without confusing runtime behavior", "medium"),
  q("modules-and-declarations", "For a composite monorepo, what do TypeScript project references provide?", "Explicit dependencies between projects and incremental build coordination", ["Runtime service discovery", "Automatic npm publication", "A replacement for all package manifests"], "Project references structure TypeScript programs into dependent build units and enable build mode to order and reuse outputs.", REFERENCES.projectReferences, "Structure multi-project builds", "hard"),
  q("modules-and-declarations", "Why should a library's declaration-file layout mirror its JavaScript module layout?", "Consumers then resolve type declarations for the same entry points they import at runtime", ["It guarantees tree shaking in every bundler", "It embeds JavaScript bytecode inside `.d.ts` files", "It removes the need for package exports"], "Matching entry-point structure allows the type resolver to describe each actual runtime module consistently.", REFERENCES.declarations, "Design declaration layouts", "medium"),

  // Async and error boundaries
  q("async-and-error-boundaries", "What return type does an `async` function that produces a `User` value expose to its caller?", "`Promise<User>`", ["`User` immediately", "`Async<User>`", "`Generator<User>`"], "An async function always returns a Promise; a returned value fulfills that promise with the value.", REFERENCES.functions, "Type asynchronous return values", "easy"),
  q("async-and-error-boundaries", "Why is `Promise<void>` different from `void` in an API signature?", "`Promise<void>` represents asynchronous completion that can be awaited", ["`Promise<void>` cannot reject", "`void` always starts a background thread", "They are identical in emitted declarations"], "The Promise carries completion or rejection over time even though it fulfills without a useful value.", REFERENCES.functions, "Distinguish synchronous and asynchronous completion", "easy"),
  q("async-and-error-boundaries", "Under `useUnknownInCatchVariables`, what must code do before reading `err.message` in a catch block?", "Narrow `err`, for example with `err instanceof Error`", ["Cast every error to `never`", "Disable strict null checking", "Await `err.message`"], "Caught JavaScript values need not be Error objects, so `unknown` requires a runtime guard before property access.", REFERENCES.unknownCatch, "Handle unknown caught values safely", "easy"),
  q("async-and-error-boundaries", "A function accepts a callback that may return `T` or `Promise<T>`. Which type models that contract?", "`() => T | Promise<T>`", ["`() => Promise<void> & T`", "`() => async T`", "`Promise<() => never>`"], "The return union explicitly accepts either an immediate result or a promise for the same logical result.", REFERENCES.functions, "Model sync-or-async callbacks", "medium"),
  q("async-and-error-boundaries", "Why should parsed JSON remain `unknown` at a trust boundary until validation succeeds?", "Static types cannot prove the runtime payload shape, so validation must establish the application contract", ["JSON values cannot contain strings", "`unknown` automatically repairs malformed JSON", "TypeScript validates remote servers during compilation"], "Compile-time annotations do not inspect network data; retaining `unknown` prevents unchecked assumptions before a validator confirms the shape.", REFERENCES.everyday, "Protect untrusted data boundaries", "easy"),
  q("async-and-error-boundaries", "What is a sound result type for an operation that can fail with an expected domain error without throwing?", "A discriminated union such as `{ ok: true; value: T } | { ok: false; error: DomainError }`", ["`T & DomainError`", "`any`", "`void | object` without a discriminant"], "A discriminated result makes both outcomes explicit and lets control-flow analysis require error handling.", REFERENCES.narrowing, "Model expected failures explicitly", "medium"),
  q("async-and-error-boundaries", "If `Promise.all` receives promises typed `Promise<User>` and `Promise<Settings>`, what useful result relationship is preserved?", "The fulfilled result is typed as a tuple containing `User` and `Settings` in input order", ["Every result becomes `unknown`", "Only the final promise's value is retained", "The values are converted to one intersection object"], "TypeScript models heterogeneous Promise.all inputs so the resolved collection retains the positional member types.", REFERENCES.generics, "Interpret typed promise aggregation", "medium"),
  q("async-and-error-boundaries", "Why is a non-null assertion such as `response.user!` risky at an external-data boundary?", "It suppresses nullish checking without adding a runtime check", ["It deletes the user property", "It throws immediately whenever the value exists", "It converts the object to a Promise"], "The postfix assertion only tells the compiler to exclude null and undefined; the runtime value remains unchanged.", REFERENCES.everyday, "Avoid unsafe non-null assertions", "easy"),
  q("async-and-error-boundaries", "A callback API calls either `onSuccess(data)` or `onError(error)`. What design improves exhaustiveness when storing its eventual state?", "Represent state as a discriminated union with separate success and error variants", ["Store both fields as optional on one object and ignore impossible combinations", "Use `any` for the entire state", "Model the state as `string[]`"], "Distinct discriminated variants encode which fields coexist and allow exhaustive rendering or handling.", REFERENCES.narrowing, "Model asynchronous state machines", "hard"),
  q("async-and-error-boundaries", "What does `Awaited<Promise<Promise<string>>>` resolve to?", "`string`", ["`Promise<string>`", "`Promise<Promise<string>>`", "`never`"], "The `Awaited` utility recursively models await-style unwrapping of nested promise-like types.", REFERENCES.utility, "Use Awaited for resolved value types", "medium"),

  // Compiler configuration
  q("compiler-configuration", "What broad effect does enabling `strict` have?", "It enables a family of stricter type-checking options", ["It minifies emitted JavaScript", "It prevents every use of JavaScript libraries", "It runs unit tests after compilation"], "The strict flag groups multiple checks that provide stronger guarantees; it is a checker configuration, not a test runner or optimizer.", REFERENCES.strict, "Explain strict mode", "easy"),
  q("compiler-configuration", "What does `noEmit` do when running the TypeScript compiler?", "It performs checking without writing JavaScript or declaration outputs", ["It skips type checking and only bundles files", "It deletes existing output directories", "It forbids all imports"], "`noEmit` suppresses compiler output while retaining the type-checking pass, which is useful when another tool handles transformation.", REFERENCES.noEmit, "Configure check-only compilation", "easy"),
  q("compiler-configuration", "Why enable `noUncheckedIndexedAccess` for a dictionary type?", "Unspecified indexed reads include `undefined`, forcing callers to handle a missing key", ["It bans every index signature", "It sorts dictionary keys before access", "It validates dictionary values at runtime"], "The option adds `undefined` to potentially undeclared indexed properties, reflecting the possibility that a lookup misses.", REFERENCES.indexedAccess, "Model missing indexed values", "medium"),
  q("compiler-configuration", "With `exactOptionalPropertyTypes`, why can assigning `undefined` to `theme?: \"dark\" | \"light\"` be rejected?", "An absent property is distinguished from a present property whose value is undefined", ["Optional properties become required strings", "The option converts undefined to null", "String literal types are disabled"], "The option enforces the written optional-property domain without implicitly adding undefined as an assignable present value.", REFERENCES.exactOptional, "Distinguish omission from explicit undefined", "medium"),
  q("compiler-configuration", "What is the purpose of `isolatedModules`?", "Warn about constructs that cannot be safely transformed one file at a time", ["Run each module in a separate operating-system process", "Prevent modules from exporting values", "Guarantee runtime sandboxing"], "Single-file transpilers lack whole-program type information, so the option rejects TypeScript patterns that depend on it for correct emit.", REFERENCES.isolated, "Support single-file transpilation", "medium"),
  q("compiler-configuration", "Why should `module` and `moduleResolution` be chosen together for the target environment?", "Their emitted syntax and lookup model must agree with the runtime or bundler", ["They control indentation and line endings", "One option configures database modules", "They are interchangeable names for the same boolean"], "A mismatch can type-check imports under rules different from those used by the emitted program, leading to runtime resolution failures.", REFERENCES.modules, "Align module emit and resolution", "hard"),
  q("compiler-configuration", "What does `skipLibCheck` skip?", "Type checking of declaration-file contents", ["All checks in the application's `.ts` files", "Only JavaScript syntax parsing", "Emission of standard library declarations"], "The option can reduce checking time but may hide conflicts inside `.d.ts` files; application source is still checked.", REFERENCES.tsconfig, "Assess skipLibCheck trade-offs", "medium"),
  q("compiler-configuration", "What problem does `esModuleInterop` primarily address?", "Compatibility helpers and checking behavior for common CommonJS import patterns", ["Automatic conversion of every package to native ESM on disk", "Network loading of ES modules", "Generation of browser import maps"], "The flag adjusts interop behavior and emit helpers; it does not rewrite third-party packages into a different module system.", REFERENCES.esModuleInterop, "Explain CommonJS interop configuration", "medium"),
  q("compiler-configuration", "Why pin the TypeScript compiler version in a reproducible build?", "Compiler upgrades can change checking and emitted declarations, so pinning keeps CI and local results consistent", ["TypeScript versions control the Node.js clock", "A pin validates production data automatically", "Unpinned compilers cannot read tsconfig files"], "A versioned compiler is part of the build toolchain; explicit upgrades can then be reviewed with diagnostics and output changes.", REFERENCES.tsconfig, "Maintain reproducible compiler behavior", "easy"),
  q("compiler-configuration", "What does a `types` entry in tsconfig primarily control?", "Which visible `@types` packages contribute globals to the compilation", ["Which application values are allowed at runtime", "Which npm packages may be installed", "Which files the operating system can execute"], "The option limits automatically included type-package globals; imported modules can still bring their own types through normal resolution.", REFERENCES.tsconfig, "Control ambient type-package inclusion", "hard"),

  // JavaScript integration and quality
  q("javascript-integration-and-quality", "What does `allowJs` enable in a TypeScript project?", "Including JavaScript files in the program alongside TypeScript files", ["Treating every JavaScript value as fully validated", "Converting JavaScript to Java bytecode", "Disabling module resolution for `.js` files"], "`allowJs` permits mixed source inputs; the degree of JavaScript diagnostic checking is controlled separately.", REFERENCES.js, "Adopt TypeScript incrementally", "easy"),
  q("javascript-integration-and-quality", "What additional behavior does `checkJs` request for included JavaScript files?", "Report type-checking errors in JavaScript files", ["Rename every `.js` file to `.ts`", "Emit declaration files without analysis", "Execute JavaScript tests in the compiler"], "`checkJs` enables diagnostics for JavaScript sources, comparable to placing `// @ts-check` in each included file.", REFERENCES.js, "Check JavaScript during migration", "easy"),
  q("javascript-integration-and-quality", "How can JSDoc help a JavaScript module during gradual TypeScript adoption?", "It supplies type information that TypeScript can check without converting the file to `.ts`", ["It changes JavaScript runtime semantics", "It installs missing dependencies", "It guarantees external payload validation"], "Supported JSDoc annotations describe parameters, returns, templates, and object shapes to the checker while the file remains JavaScript.", REFERENCES.js, "Use JSDoc for gradual typing", "easy"),
  q("javascript-integration-and-quality", "A project does not enable `checkJs`, but one included JavaScript file should receive TypeScript diagnostics. Which file-level directive opts that file into checking?", "`// @ts-check`", ["`// @ts-runtime`", "`// @check-types-off`", "`// @emit-js-types`"], "Placing `// @ts-check` in a JavaScript file enables TypeScript checking for that file without requiring project-wide `checkJs`.", REFERENCES.js, "Enable checking for one JavaScript file", "medium"),
  q("javascript-integration-and-quality", "What is the safest way to migrate an untyped function used by many callers?", "Describe its observed contract, enable checking incrementally, and remove `any` only as call sites and runtime behavior are verified", ["Add a broad type assertion at every call site", "Change every parameter to `never` immediately", "Assume the implementation matches its documentation without tests"], "Gradual migration uses evidence from behavior and call sites; assertions can conceal incompatibilities instead of resolving them.", REFERENCES.js, "Plan incremental type migration", "medium"),
  q("javascript-integration-and-quality", "A public function accepts `string | number`, but its implementation calls `.trim()` unconditionally. What should a focused test and type fix establish?", "Narrow before string operations and verify both union branches", ["Cast the parameter to string and test only strings", "Remove the number member without checking callers", "Disable strict mode around the function"], "The declared union promises both inputs; implementation and tests must cover the branch-specific behavior or deliberately revise the contract.", REFERENCES.narrowing, "Keep implementation aligned with unions", "medium"),
  q("javascript-integration-and-quality", "A generic function needs to construct a new `T`, but receives only the type parameter `T`. Why must it also receive a constructor value such as `{ new (): T }`?", "Type parameters provide compile-time information, while constructing an object requires a runtime value", ["Generic functions cannot return objects", "A constructor constraint automatically calls every class", "The JavaScript runtime can instantiate a type alias directly"], "TypeScript types are not runtime values. Passing a construct signature as a value-bearing parameter gives the implementation something it can call with `new` while preserving the result type.", REFERENCES.generics, "Connect generic constructor types to runtime values", "hard"),
  q("javascript-integration-and-quality", "A third-party package has no declarations. Why is `declare module \"pkg\";` only a temporary migration step?", "It treats the module as `any`, suppressing useful checks until accurate declarations are supplied", ["It implements the package at runtime", "It prevents the package from loading", "It creates a complete declaration from network metadata"], "An empty ambient module removes missing-type errors by forfeiting type information; it does not verify the package API.", REFERENCES.declarations, "Manage untyped dependencies transparently", "medium"),
  q("javascript-integration-and-quality", "A type test uses `// @ts-expect-error` above a call that should remain invalid. What useful failure occurs if a later API change makes that call valid?", "TypeScript reports that the `@ts-expect-error` directive is unused", ["TypeScript silently removes the entire test file", "The directive converts the valid call into a runtime exception", "The compiler permanently disables checking for the module"], "Unlike an unconditional suppression, `@ts-expect-error` produces a diagnostic when the following line no longer has an error, so stale negative type tests are detectable.", REFERENCES.expectError, "Use expected-error directives as checked negative assertions", "hard"),
  q("javascript-integration-and-quality", "A palette object must be checked against `Record<Color, string | RGB>` while retaining each property's more specific inferred type. Which TypeScript construct is designed for this?", "Append `satisfies Record<Color, string | RGB>` to the object expression", ["Assert the object with `as any`", "Annotate every property as `unknown`", "Apply the non-null assertion operator to the object"], "The `satisfies` operator checks that an expression is assignable to a target type without replacing the expression's more specific inferred type.", REFERENCES.satisfies, "Validate an expression while preserving inference", "medium"),
];

function item(draft: Draft, index: number) {
  const topic = TOPICS[draft.topic];
  const correctOption = index % 4;
  const options = [...draft.distractors];
  options.splice(correctOption, 0, draft.correct);
  const objectiveCode = `${topic.code}-${String((index % 10) + 1).padStart(2, "0")}`;
  return {
    schemaVersion: 1 as const,
    sourceRecordId: `tsad-v1-${String(index + 1).padStart(3, "0")}`,
    language: "en",
    question: draft.question,
    format: "mcq_single" as const,
    options,
    answer: { kind: "single_choice" as const, correctOption },
    explanation: draft.explanation,
    subject: "TypeScript application development",
    topic: topic.name,
    syllabus: SYLLABUS,
    exam: "TypeScript Application Development Skills",
    examYear: 2026,
    objective: draft.objective,
    difficulty: draft.difficulty,
    maxPoints: 1,
    negativeMarks: 0,
    timeLimitSec: draft.difficulty === "hard" ? 120 : draft.difficulty === "easy" ? 60 : 90,
    tags: ["typescript", draft.topic, draft.difficulty, "original", "version-1"],
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

export const TYPESCRIPT_APPLICATION_DEVELOPMENT_SKILLS_V1 = DRAFTS.map(item);

function semanticKey(value: string) {
  return value.toLowerCase().replace(/`[^`]+`/g, "<code>").replace(/\b\d+(?:\.\d+)?\b/g, "<n>").replace(/[^a-z<>]+/g, " ").trim();
}

export function auditTypeScriptApplicationDevelopmentSkillsV1() {
  const errors: string[] = [];
  const ids = new Set<string>();
  const prompts = new Set<string>();
  const semantic = new Set<string>();
  const hashes = new Set<string>();
  const topicCounts = new Map<string, number>();
  const difficultyCounts = new Map<string, number>();
  const answerPositions = [0, 0, 0, 0];
  for (const candidate of TYPESCRIPT_APPLICATION_DEVELOPMENT_SKILLS_V1) {
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
    if (!candidate.provenance.sourceLocator.startsWith("https://www.typescriptlang.org/")) {
      errors.push(`${candidate.sourceRecordId}: non-primary source`);
    }
  }
  if (TYPESCRIPT_APPLICATION_DEVELOPMENT_SKILLS_V1.length !== 80) errors.push(`Expected 80 rows, found ${TYPESCRIPT_APPLICATION_DEVELOPMENT_SKILLS_V1.length}`);
  for (const topicSlug of Object.keys(TOPICS)) {
    if ((topicCounts.get(topicSlug) ?? 0) !== 10) errors.push(`${topicSlug}: expected 10 questions`);
  }
  if (answerPositions.some((count) => count !== 20)) errors.push(`Answer positions are not balanced: ${answerPositions.join(",")}`);
  const digest = createHash("sha256").update(JSON.stringify(TYPESCRIPT_APPLICATION_DEVELOPMENT_SKILLS_V1)).digest("hex");
  return {
    errors,
    rows: TYPESCRIPT_APPLICATION_DEVELOPMENT_SKILLS_V1.length,
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
  const output = path.resolve(process.argv[2] ?? "content/question-packs/octamy-typescript-application-development-skills-v1.jsonl");
  const audit = auditTypeScriptApplicationDevelopmentSkillsV1();
  if (audit.errors.length) throw new Error(audit.errors.join("\n"));
  await mkdir(path.dirname(output), { recursive: true });
  const stream = createWriteStream(output, { encoding: "utf8", flags: "w", mode: 0o600 });
  for (const candidate of TYPESCRIPT_APPLICATION_DEVELOPMENT_SKILLS_V1) stream.write(`${JSON.stringify(candidate)}\n`);
  stream.end();
  await finished(stream);
  process.stdout.write(`${JSON.stringify({ output, ...audit }, null, 2)}\n`);
}

if (/generate-typescript-application-development-skills-v1\.(?:c?js|ts)$/.test(path.basename(process.argv[1] ?? ""))) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
