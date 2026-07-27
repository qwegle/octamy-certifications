# Question Bank — CSV / XLSX Import Format

Endpoint: `POST /api/question-banks/:id/questions/import`
- Field name: `file` (multipart)
- Optional field: `dryRun=true` (returns preview without inserting)

## Required header row

```
topic,question,format,optionA,optionB,optionC,optionD,correctAnswer,marks,negativeMarks,timeLimitSec,difficulty,tags,explanation
```

## Column reference

| Column          | Required | Description |
|-----------------|----------|-------------|
| `topic`         | no       | Topic name; auto-created if not present in bank |
| `question`      | yes      | Question prompt text |
| `format`        | yes      | One of: `mcq_single`, `mcq_multi`, `true_false`, `fill_blank`, `short`, `long`, `code`, `numeric`, `match` |
| `optionA-D`     | mcq      | Option text (used for `mcq_single`, `mcq_multi`) |
| `correctAnswer` | yes      | See per-format mapping below |
| `marks`         | no       | Integer, default 1 |
| `negativeMarks` | no       | Integer, default 0 |
| `timeLimitSec`  | no       | Integer; per-question time limit |
| `difficulty`    | no       | `easy` \| `medium` \| `hard`; default `medium` |
| `tags`          | no       | Comma-separated list, e.g. `math,arithmetic` |
| `explanation`   | no       | Shown after submission |

### `correctAnswer` per format

- **mcq_single** — single letter `A`/`B`/`C`/`D` mapped to optionA-D.
- **mcq_multi** — comma-separated letters, e.g. `A,C`.
- **true_false** — literal `true` or `false`.
- **fill_blank / short / long / code / numeric / match** — free-text expected answer (stored in `expectedAnswer`).

## Sample rows

```csv
"Algebra","What is 2+2?","mcq_single","2","3","4","5","C",1,0,60,"easy","math,arithmetic","Basic addition"
"Algebra","Pick primes","mcq_multi","2","3","4","5","A,B",2,1,90,"medium","math,primes",""
"Trivia","Earth orbits the Sun","true_false",,,,,"true",1,0,30,"easy","science",""
"Coding","Write add(a,b)","code",,,,,"def add(a,b): return a+b",5,0,300,"hard","python,code",""
```

## Behaviour

- Topics are auto-created when first referenced in the file.
- Each invalid row is reported with `{ row, message }`; valid rows still commit.
- `dryRun=true` returns `{ totalRows, valid, errors, preview }` and inserts nothing.
- The import respects the bank owner's plan limits — exceeding them returns `402` with `code: PLAN_LIMIT_QUESTIONS`.

## Certification-grade imports (JSONL only)

The CSV/XLSX endpoint above is a convenience intake path for manually reviewed,
private draft banks. It does **not** create immutable question-pack source,
import-run, or per-record provenance rows and must not be used to make imported
certification questions publishable.

Certification and first-party Practice content must use the versioned JSONL
workflow:

1. Register an immutable source manifest with a separate rights reviewer, the
   acquiring legal entity, and a local contract/assignment/permission artifact:

   ```sh
   npm run questions:register-source -- \
     --manifest content/question-packs/<pack>.manifest.json \
     --evidence-file /restricted/rights-register/<proof-file> \
     --acquiring-entity "<exact legal entity>" \
     --operator "<named rights reviewer>" \
     --confirm-rights
   ```

   Only the proof file name, byte length, and SHA-256 are stored in provenance;
   the proof document itself remains in the restricted rights register. A Git
   commit, publisher credit, or free-text ownership claim is not sufficient.

2. Validate and import through `scripts/import-question-pack.ts`. Imports remain
   `pending` and inactive; registration or import never approves or publishes.
3. Every item intended for release must include
   `metadata.releaseEvidence` with:
   - `syllabusVersion`
   - `objectiveCode`
   - `answerValidation.status = "verified"`
   - `answerValidation.method` and `answerValidation.reference`
   - `distractorReview.status = "verified"` and `distractorReview.note`
4. A named reviewer distinct from the attributable author must review every
   exact item version through the normal review service. Activation, blueprint
   configuration, acceptance checks, and publication are separate guarded acts.

Do not relabel CSV-imported rows as human-authored or use direct SQL to bypass
provenance and independent-review requirements.
