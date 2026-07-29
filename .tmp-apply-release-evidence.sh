#!/usr/bin/env bash
set -euo pipefail
ATTESTATION="User 1 is the single accountable officer. Verification results were produced by automated execution rather than independent human review. Recording was executed by the platform owner's agent under the owner's explicit instruction."
METHOD="Automated exhaustive attainable-score verification against the configured passing threshold using server scoreExam; no independent human cut-score review represented."
TAKEDOWN="The platform owner disables public visibility and active status, preserves attempts and evidence, corrects content through a new immutable blueprint revision, reruns machine verification, and records new release evidence before republication."
for slug in api-design-microservices-foundations grade-3-arithmetic-time-and-perimeter-practice software-testing-qa-foundations; do
  hash=$(SLUG="$slug" node --input-type=module -e "import fs from 'fs';const m=JSON.parse(fs.readFileSync('.tmp-release-artifacts-20260729/manifest.json'));process.stdout.write(m.results.find(x=>x.target.slug===process.env.SLUG).cutScoreApprovalSha256)")
  revision=$(SLUG="$slug" node --input-type=module -e "import fs from 'fs';const m=JSON.parse(fs.readFileSync('.tmp-release-artifacts-20260729/manifest.json'));process.stdout.write(String(m.results.find(x=>x.target.slug===process.env.SLUG).target.blueprintRevision))")
  npx tsx scripts/record-assessment-release-evidence.ts \
    --assessment "$slug" \
    --operator "Platform owner's instructed agent; automated execution" --operator-user-id 1 \
    --attestation-mode single_accountable_officer --accountable-officer-user-id 1 \
    --single-officer-attestation "$ATTESTATION" \
    --form-simulation-artifact ".tmp-release-artifacts-20260729/$slug/form-simulation-artifact.json" \
    --representative-attempt-qa-artifact ".tmp-release-artifacts-20260729/$slug/representative-attempt-qa-artifact.json" \
    --accessibility-audit-artifact ".tmp-release-artifacts-20260729/$slug/accessibility-content-audit-artifact.json" \
    --accessibility-standard "WCAG 2.2 AA automated content checks" \
    --cut-score-method "$METHOD" \
    --cut-score-approval-reference "automated-threshold-verification/$slug/revision-$revision" \
    --cut-score-approval-sha256 "$hash" \
    --release-commit 52afdb3fb68d41335c30f85aaac3f10283f00661 \
    --takedown-procedure "$TAKEDOWN" \
    --apply --confirm-release-evidence
done
