# Flipword Lexicon Audit — Design Spec

**Date:** 2026-04-14
**Status:** Approved
**Scope:** Round 1 word-bank audit for obvious translation quality issues

## 1. Context

Flipword is a browser extension that replaces Chinese words on Chinese web pages with English vocabulary for immersive language learning. The product serves users who want English to appear inside their normal Chinese reading flow rather than in a separate flashcard workflow.

On 2026-04-14, the main word banks expanded from 131 entries to 13,530 entries through bulk import. That expansion increased coverage, but it also introduced a predictable quality risk: many `chineseMappings` are dictionary-derived fragments rather than replacement-ready Chinese expressions. The current runtime matcher does not yet perform real context disambiguation. It matches Chinese segments, applies a coarse domain score, and then picks an entry using progressive release by SM-2 state. That means obvious mistranslations or overly broad mappings in the data will surface directly in page replacements.

This round exists to move the word banks from "bulk-imported and risky" to "basically trustworthy for visible inline replacement."

## 2. Goal and Non-Goals

### 2.1 Goal

Audit the existing files under `data/word-banks/` and correct entries that are clearly wrong, clearly misleading, structurally dirty, or obviously unnatural for Flipword's inline replacement model.

### 2.2 Non-Goals

This round does not attempt to solve full context disambiguation.

- Do not introduce runtime LLM disambiguation.
- Do not redesign the matching engine.
- Do not try to perfect every near-synonym choice.
- Do not mass-edit entries whose correctness depends on sentence-level context that the current runtime cannot represent.

Ambiguous cases that require real context handling should be recorded for a later round instead of being force-fixed in this one.

## 3. Quality Standard

This round treats an entry as in-scope for correction only if it falls into one or more of these categories:

### 3.1 Clearly Wrong

The English word does not match the core meaning of the Chinese gloss, or the mapping crosses part-of-speech boundaries in a way that would mislead the user during inline replacement.

### 3.2 Clearly Unnatural

The Chinese gloss is dictionary-like, too fragmentary, too broad, too stiff, or otherwise not suitable as a real Chinese expression that Flipword should trigger on inside live web text.

### 3.3 Clearly Misleading

The mapping is technically possible in some contexts but is too risky under the current matcher because it would frequently push users toward the wrong English word when they encounter the Chinese trigger on real pages.

### 3.4 Structural Data Dirt

The entry contains import residue such as poor POS labeling, malformed or low-value `chineseMappings`, or duplicated low-quality mappings that make the bank noisier without improving real replacement quality.

## 4. Review Decisions

Every reviewed entry must end in exactly one of these decisions:

- `keep` — current entry is acceptable for this round
- `revise` — update one or more of `meanings`, `chineseMappings`, or POS data
- `defer` — the problem is real, but it belongs to the later context-disambiguation round

When revising, prefer this order of intervention:

1. Remove clearly bad mappings.
2. Narrow overly broad mappings.
3. Correct POS or Chinese glosses.
4. Add new mappings only when the new mapping is clearly better and clearly safe.

The working rule is that `chineseMappings` exist to support inline trigger quality, not to preserve every dictionary gloss.

## 5. Audit Order

The audit proceeds in layers rather than treating all banks identically.

### 5.1 `editorial`

Audit all 30 entries manually. This is the calibration bank for deciding what "natural enough for inline replacement" means in Flipword.

### 5.2 `business` and `academic`

Audit these banks next with manual review as the default and simple rule-based surfacing as support. These banks are small enough to inspect directly and domain-focused enough that bad mappings are usually obvious.

### 5.3 `ielts`, `toefl`, and `gre`

Audit these banks last. Use rule-based surfacing first, then manually review the flagged clusters. The initial flags should prioritize:

- Chinese mappings attached to many English entries
- POS or gloss mismatches
- Chinese strings that read like dictionary fragments instead of normal page text
- Same English word carrying materially different quality across multiple banks

## 6. Review Workflow Per Entry

Each entry review follows the same sequence:

1. Check the English headword (`word`) and confirm the entry's intended lexical category.
2. Check `meanings`, especially `partOfSpeech` and `definitionCn`.
3. Check `chineseMappings`, because these mappings directly drive runtime replacement.
4. Check cross-bank collisions when the same Chinese mapping points to many different English words.
5. Record one outcome: `keep`, `revise`, or `defer`.

Specific editing rules:

- Remove mappings that are too broad or too risky under the current runtime.
- Remove mappings that look like explanatory glosses rather than natural Chinese triggers.
- Keep `meanings.definitionCn` and `chineseMappings` conceptually aligned, but they do not need to be identical.
- When uncertain, prefer deletion or deferment over speculative expansion.

## 7. Required Project Policy Update

This requirement is mandatory, not optional:

`CLAUDE.md` must be updated to encode the lexicon-audit strategy as project policy.

That policy update must state at minimum:

- Bulk-imported word-bank data is not assumed correct by default.
- `chineseMappings` are replacement triggers, not raw dictionary dumps.
- For translation-quality work, reviewers should prefer deleting bad or overly broad mappings over preserving coverage.
- Cases that require real context disambiguation should be deferred and recorded rather than forced into a brittle one-to-one mapping.
- Future word-bank expansion work must preserve auditability by keeping explicit records of revised and deferred items.

This policy belongs in `CLAUDE.md` because the audit strategy is a rigid product constraint, not just a temporary task note.

## 8. Outputs

Round 1 produces four outputs:

1. Updated files under `data/word-banks/*.json`
2. A written audit record at `docs/lexicon-audit/2026-04-14-round-1.md`
3. A shortlist of context-disambiguation cases, either as a dedicated section in that audit record or as a separate appendix
4. An update to `CLAUDE.md` that codifies the review policy

The audit record should be easy to diff and review. It does not need to be fully exhaustive for every `keep` decision, but it must explain all `revise` and `defer` decisions.

## 9. Tooling Boundary

Helper scripts are allowed, but only for surfacing risk and accelerating review.

- Scripts may identify suspicious entries.
- Scripts may generate candidate review lists or summaries.
- Scripts must not auto-decide correctness without human review.

Human review remains the final authority for all translation-quality changes.

## 10. Validation

Each batch of corrections should be validated with lightweight integrity checks before claiming completion:

- JSON remains parseable
- Required fields still exist
- `chineseMappings` remain non-empty for retained entries
- No accidental structural regressions are introduced into the bank format

Where useful, add tests or validation scripts that catch obvious regressions in translation-quality rules or bank structure.

## 11. Deferred Work

The following work is explicitly deferred to later rounds:

- Frequency-based reordering of competing candidates
- Context-hint enrichment for ambiguous mappings
- Runtime disambiguation changes
- Systematic ranking of one-to-many Chinese-to-English collisions

Round 1 is about removing obvious quality hazards first.
