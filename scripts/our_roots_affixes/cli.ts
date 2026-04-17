import { runStage0 } from './stage-0-manifest.js';
import { runStage1aPlanner } from './stage-1a-planner.js';
import { runStage1aConsolidate } from './stage-1a-consolidate.js';
import { runStage1b } from './stage-1b-runner.js';
import { runStage2 } from './stage-2-morpheme-index.js';
import { runStage3 } from './stage-3-relations.js';
import { runStage4 } from './stage-4-qa.js';
import { runStage5 } from './stage-5-package.js';
import { runStage6 } from './stage-6-github.js';
import { logger } from './logger.js';

const STAGES: Record<string, () => Promise<void>> = {
  'stage-0': runStage0,
  'stage-1a-plan': runStage1aPlanner,
  'stage-1a-consolidate': async () => { await runStage1aConsolidate(); },
  'stage-1b': runStage1b,
  'stage-2': runStage2,
  'stage-3': runStage3,
  'stage-4': runStage4,
  'stage-5': runStage5,
  'stage-6': runStage6,
};

const ALL_SEQUENCE = [
  'stage-0', 'stage-1a-plan', 'stage-1a-consolidate', 'stage-1b',
  'stage-2', 'stage-3', 'stage-4', 'stage-5', 'stage-6',
] as const;

async function main() {
  const arg = process.argv[2] ?? 'help';

  if (arg === 'help' || arg === '--help' || arg === '-h') {
    console.log(`Usage: bun scripts/our_roots_affixes/cli.ts <command>

Commands:
  all                   Run the full 9-step pipeline
  stage-0               Build manifest from data/word-banks/
  stage-1a-plan         LLM: extract morpheme candidates per 1k-word batch
  stage-1a-consolidate  LLM: merge candidates into canonical inventory
  stage-1b              LLM: decompose words in 50-word buckets (resumable)
  stage-2               Backfill MorphemeEntry.memberWords
  stage-3               Build RelationsGraph + run INV-1..8
  stage-4               QA sampling (200 words)
  stage-5               Package META.md / README / schema / types.d.ts
  stage-6               Git push to https://github.com/host452b/root_and_affix.git
  help                  Print this message

Env:
  ANTHROPIC_API_KEY     Required for Stage 1a/1b/4
`);
    return;
  }

  if (arg === 'all') {
    for (const stage of ALL_SEQUENCE) {
      logger.info('cli', { stage, action: 'start' });
      await STAGES[stage]();
      logger.info('cli', { stage, action: 'complete' });
    }
    return;
  }

  const fn = STAGES[arg];
  if (!fn) {
    console.error(`Unknown command: ${arg}. Run with 'help' for usage.`);
    process.exit(2);
  }
  await fn();
}

main().catch(e => {
  logger.error('cli', { err: String(e) });
  process.exit(1);
});
