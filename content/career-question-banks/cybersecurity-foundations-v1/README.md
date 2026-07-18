# Cybersecurity Foundations — question bank v1

Assessment slug: `cybersecurity-foundations`

Syllabus version: `OCT-CSF-2026.1`

Status: content-complete private draft. This bank has not been independently reviewed, imported, activated, or published.

## Scope and blueprint

This assessment measures vendor-neutral entry-level cybersecurity judgment. It excludes penetration-testing procedures, product-specific configuration, legal advice, and recalled vendor exam content. The intended exam draws 20 questions using the exact quotas below.

| Topic | Inventory | Draw | Rotation |
| --- | ---: | ---: | ---: |
| Security principles and risk governance | 12 | 3 | 4x |
| Identity and access management | 12 | 3 | 4x |
| Threats and secure user behavior | 12 | 3 | 4x |
| Network and application security | 8 | 2 | 4x |
| Data protection and cryptography | 8 | 2 | 4x |
| Vulnerability and configuration management | 8 | 2 | 4x |
| Monitoring and incident response | 12 | 3 | 4x |
| Resilience and recovery | 8 | 2 | 4x |
| **Total** | **80** | **20** | **4x** |

Every item has a stable record ID, objective code, difficulty, topic, primary source locator, answer evidence, and explicit pending reviewer/distractor status in its metadata. Correct-answer positions are balanced at 20 each bank-wide and within every topic.

## Dated primary reference set

References were checked on 18 July 2026. The questions use original wording; references establish behavior and syllabus scope.

- NIST Cybersecurity Framework 2.0 (`NIST CSWP 29`): https://doi.org/10.6028/NIST.CSWP.29
- NIST Digital Identity Guidelines, Authentication and Authenticator Management (`SP 800-63B-4`, final August 2025): https://pages.nist.gov/800-63-4/sp800-63b.html
- NIST Incident Response Recommendations and Considerations (`SP 800-61r3`, final April 2025): https://doi.org/10.6028/NIST.SP.800-61r3
- NIST Zero Trust Architecture (`SP 800-207`): https://doi.org/10.6028/NIST.SP.800-207
- CISA Secure Our World: https://www.cisa.gov/secure-our-world
- CISA Cross-Sector Cybersecurity Performance Goals: https://www.cisa.gov/cybersecurity-performance-goals
- OWASP Top 10:2025: https://owasp.org/Top10/
- IETF TLS 1.3 (`RFC 8446`): https://www.rfc-editor.org/rfc/rfc8446
- IETF Service Identity in TLS (`RFC 9525`): https://www.rfc-editor.org/rfc/rfc9525
- NIST Security and Privacy Controls (`SP 800-53r5`, release 5.2.0): https://doi.org/10.6028/NIST.SP.800-53r5
- NIST Key Management (`SP 800-57 Part 1 Rev. 5`): https://doi.org/10.6028/NIST.SP.800-57pt1r5
- NIST Media Sanitization (`SP 800-88r2`, final September 2025): https://doi.org/10.6028/NIST.SP.800-88r2
- NIST National Checklist Program (`SP 800-70r5`, final May 2026): https://doi.org/10.6028/NIST.SP.800-70r5
- NIST Enterprise Patch Management (`SP 800-40r4`): https://doi.org/10.6028/NIST.SP.800-40r4
- NIST Contingency Planning (`SP 800-34r1`): https://doi.org/10.6028/NIST.SP.800-34r1
- NIST Security Categorization (`SP 800-60 Vol. 1 Rev. 1`): https://doi.org/10.6028/NIST.SP.800-60v1r1
- NIST Secure Hash Standard (`FIPS 180-4`): https://doi.org/10.6028/NIST.FIPS.180-4

## Reproduction and validation

```bash
npx tsx scripts/generate-cybersecurity-foundations-v1.ts
npx tsx scripts/validate-cybersecurity-foundations-v1.ts
```

The generator deterministically writes `questions.jsonl`. The validator applies the repository question-pack schemas and checks the manifest, all 80 rows, exact and normalized duplicates, options, evidence metadata, blueprint counts, 4x rotation, difficulty coverage, and answer-position balance.

## Mandatory release blockers

The following are intentionally unresolved and must remain fail-closed:

1. A named human cybersecurity author/owner must accept responsibility for the candidate; `AI-assisted original draft` is not attributable human authorship.
2. A different named human cybersecurity SME must review every exact stem, key, distractor, explanation, difficulty, objective, and cited evidence. Sampling and service-account approval are prohibited.
3. Reviewer identity, item-version hash, timestamp, verification decision, and distractor note must be persisted through governance. Any edit invalidates approval.
4. Register the proprietary source and import only into a private inactive `cybersecurity-foundations-pool-v1` bank after a dry run reports 80 valid rows and zero errors.
5. Replace the shell blueprint with the eight exact topic quotas above and confirm the guarded readiness report has zero blockers.
6. Run representative scoring, timing, accessibility, mobile, randomization, recovery, and retired/pending-selection tests.
7. A separately authorized publisher must activate and publish through guarded mutations. Do not update publication fields directly.

Until every blocker is closed, the assessment must stay private, pending, inactive, and absent from the public catalog.
