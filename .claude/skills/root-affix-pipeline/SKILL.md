---
name: root-affix-pipeline
description: Use when working on the 词根词缀 morpheme library — adding word banks, running the Stage 0-6 pipeline, fixing WordEntry data, dispatching Stage 1b subagents, or maintaining the dataset.
user-invocable: true
---

# 词根词缀库 Pipeline Skill

**Mission**: Build the most comprehensive English roots/affixes collection library.

## When to Use This Skill

- Adding new word banks to `data/word-banks/`
- Running or resuming Stage 1b subagent dispatch
- Debugging pipeline errors (JSON malformed, relations schema mismatch, etc.)
- Running Stage 2–6 to rebuild the published dataset
- Answering questions about dataset coverage or structure

---

## Pipeline Overview

```
Stage 0  →  manifest.json (dedup 17 word banks)
Stage 1a →  morphemes/ (roots, affixes, linkers)
Stage 1b →  words/ (454 buckets × ~50 WordEntry JSON)   ← LLM-heavy
Stage 2  →  morphemes/ memberWords backfill
Stage 3  →  relations/graph.json
Stage 4  →  QA sampling (optional, needs ANTHROPIC_API_KEY)
Stage 5  →  package (META.md, README, types.d.ts)
Stage 6  →  git tag + push to https://github.com/host452b/root_and_affix
```

All scripts run with: `bun run scripts/our_roots_affixes/<script>.ts`

---

## Session Restart Protocol

`/tmp/` is cleared on restart. Always run first:
```bash
python3 scripts/our_roots_affixes/prep-stage1b-inputs.py
```
This regenerates `/tmp/s1b-{bucket}.json`, `/tmp/s1b-inventory.json`, `/tmp/s1b-fewshot.json`.

---

## Gap Check

```python
python3 -c "
import json, os
plan = json.load(open('data/our_roots_affixes/_staging/bucket-plan.json'))
done = set(f.replace('.json','') for f in os.listdir('data/our_roots_affixes/words/') if f.endswith('.json'))
missing = [b['id'] for b in plan['buckets'] if b['id'] not in done]
print(f'Missing {len(missing)}:', missing)
"
```

---

## Stage 1b Dispatch Templates

**Standard (50 words):**
```
Decompose 50 English words from `/tmp/s1b-{bucket}.json` into WordEntry JSON objects.
IMPORTANT: Write DIRECTLY to `/Users/joejiang/Desktop/词根词缀/data/our_roots_affixes/words/{bucket}.json` using the Write tool.
Reference `/tmp/s1b-fewshot.json` (COPY structure exactly) and `/tmp/s1b-inventory.json`.
Rules: (1) canonical prefers inventory ids; (2) phrases/abbrevs/proper-nouns→pseudo-morpheme role=root canonical=word; (3) same count and order as input; (4) controlled vocabs; (5) relations 2-5 items.
Report ONLY: "Done. {bucket}.json written, N entries." in ≤20 words.
```

**Split A (when bucket stalls at 32K — un-/under- prefix buckets):**
```
Read `/tmp/s1b-{bucket}.json`. Take only items index 0-24 (FIRST 25).
Write to `.../words/{bucket}a-tmp.json`.
Report ONLY: "Done. {bucket}a-tmp.json written, 25 entries."
```

**Split B:**
```
Read `/tmp/s1b-{bucket}.json`. Take only items index 25-49 (LAST 25).
Write to `.../words/{bucket}b-tmp.json`.
Report ONLY: "Done. {bucket}b-tmp.json written, 25 entries."
```

**Merge after both halves complete:**
```python
import json, os
base = '/Users/joejiang/Desktop/词根词缀/data/our_roots_affixes/words/'
for b in ['{bucket}']:
    a = json.load(open(f'{base}{b}a-tmp.json'))
    b_ = json.load(open(f'{base}{b}b-tmp.json'))
    json.dump(a + b_, open(f'{base}{b}.json', 'w'), ensure_ascii=False, indent=2)
    os.remove(f'{base}{b}a-tmp.json'); os.remove(f'{base}{b}b-tmp.json')
```

---

## Common Data Fixes

### 1. Validate all JSON before Stage 2
```python
import json, os
bad = []
for f in os.listdir('data/our_roots_affixes/words/'):
    if not f.endswith('.json'): continue
    try: json.load(open(f'data/our_roots_affixes/words/{f}'))
    except Exception as e: bad.append((f, str(e)[:60]))
print(f'Bad: {len(bad)}'); [print(x) for x in bad]
```

### 2. Fix unescaped inner double quotes
```python
def fix_unescaped_quotes(text):
    result = []; in_string = False; i = 0
    while i < len(text):
        c = text[i]
        if in_string:
            if c == '\\': result.append(c); i += 1
            elif c == '"':
                j = i + 1
                while j < len(text) and text[j] in ' \t\r\n': j += 1
                if j >= len(text) or text[j] in ':,]}':
                    result.append(c); in_string = False
                else: result.append('\\"')
            else: result.append(c)
        else:
            if c == '"': in_string = True; result.append(c)
            else: result.append(c)
        i += 1
    return ''.join(result)
```

### 3. Fix relations format (array → object)
```python
REQUIRED_KEYS = ["sameRoot","sameAffix","synonyms","antonyms","domainCohort","derivationPair","morphVariants","sameImagery"]
for entry in data:
    rels = entry.get('relations')
    if isinstance(rels, dict):
        for k in REQUIRED_KEYS:
            if k not in rels: rels[k] = []
```

---

## Adding a New Word Bank

1. Add `data/word-banks/{name}.json` (array of `{word, phonetic?, definitionCn, sourceBanks}`)
2. Run Stage 0: `bun run scripts/our_roots_affixes/stage-0-manifest.ts`
3. Rebuild inputs: `python3 scripts/our_roots_affixes/prep-stage1b-inputs.py`
4. Gap check → dispatch only new buckets
5. Run Stage 2–6

---

## Key Numbers (v1.0.0)

| Metric | Value |
|--------|-------|
| Source word banks | 17 |
| Raw words (pre-dedup) | 43,882 |
| Unique words (manifest) | 21,923 |
| Buckets | 454 |
| Morpheme roots | 1,628 |
| Morpheme affixes | 307 |
| Relation edges | 68,980 |
| GitHub | host452b/root_and_affix |

---

## Known Limitations

- INV-1 warnings (70K+): stage-1b nonce canonicals not in inventory — expected, warn-only
- Stage 4 QA requires `ANTHROPIC_API_KEY`
- `un-`/`under-` prefix buckets (u-002 to u-010) must use 25+25 split to avoid 32K token limit
- `data/etymology/core-5000.json` only has 30 entries — needs expansion
- `data/roots-affixes/` has 4,844 roots + 1,499 affixes (reference format, not yet fully merged into morphemes/)
