# Data Changelog

## 2026-04-14

### Word Banks
- **IELTS**: 20 → 3,500 words (imported from kajweb/dict 有道雅思)
- **TOEFL**: 18 → 3,500 words (imported from kajweb/dict 有道托福)
- **GRE**: 26 → 3,500 words (imported from kajweb/dict 有道GRE)
- **Business**: 18 → 1,500 words (imported from kajweb/dict 有道BEC)
- **Academic**: 19 → 1,500 words (imported from kajweb/dict 有道CET6)
- **Editorial**: 30 words (hand-curated from longform reading)
- Total: 131 → 13,530 words

### Roots & Affixes
- **roots.json**: 42 → 147 entries (added 105 Latin/Greek roots)
- **affixes.json**: 35 entries (unchanged)
- Auto-morphology analyzer now covers significantly more vocabulary

### Etymology
- **core-5000.json**: 30 entries (unchanged — needs expansion)

## Import Pipeline
- `scripts/import-kajweb.ts` — import from kajweb/dict format
- `scripts/build-wordbanks.ts` — build from CSV translations + wordsta data
- Source: https://github.com/kajweb/dict (有道词典开源数据)
