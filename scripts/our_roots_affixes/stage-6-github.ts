import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { PATHS, PIPELINE, GITHUB, OUTPUT_DIR } from './config.js';
import { logger } from './logger.js';

function run(cmd: string, cwd: string): string {
  logger.info('stage-6', { cmd });
  return execSync(cmd, { cwd, encoding: 'utf-8' }).trim();
}

export async function runStage6(): Promise<void> {
  logger.info('stage-6', { phase: 'start', repo: GITHUB.remoteUrl });

  if (!existsSync(PATHS.meta) || !existsSync(join(PATHS.relations, 'graph.json'))) {
    throw new Error('Stage 5 must complete before Stage 6. Missing META.md or relations/graph.json.');
  }

  // Init repo if not already
  if (!existsSync(join(OUTPUT_DIR, '.git'))) {
    run('git init', OUTPUT_DIR);
    run(`git checkout -b ${GITHUB.defaultBranch}`, OUTPUT_DIR);
  }

  // Ensure remote
  try {
    run('git remote get-url origin', OUTPUT_DIR);
  } catch {
    run(`git remote add origin ${GITHUB.remoteUrl}`, OUTPUT_DIR);
  }

  run('git add .', OUTPUT_DIR);

  // Only commit if there are changes
  let hasChanges = true;
  try {
    run('git diff --cached --quiet', OUTPUT_DIR);
    hasChanges = false;
  } catch {
    hasChanges = true;
  }

  if (hasChanges) {
    const msg = `${PIPELINE.releaseVersion}: initial dataset of ${(await fetchTotalWords())} words with full morphological decomposition`;
    run(`git -c user.name="our_roots_affixes bot" -c user.email="bot@local" commit -m "${msg.replace(/"/g, '\\"')}"`, OUTPUT_DIR);
    logger.info('stage-6', { phase: 'committed' });
  } else {
    logger.info('stage-6', { phase: 'no-changes' });
  }

  // Tag
  try {
    run(`git tag ${PIPELINE.releaseVersion}`, OUTPUT_DIR);
  } catch {
    logger.warn('stage-6', { phase: 'tag-exists', tag: PIPELINE.releaseVersion });
  }

  // Push
  run(`git push -u origin ${GITHUB.defaultBranch}`, OUTPUT_DIR);
  run(`git push origin ${PIPELINE.releaseVersion}`, OUTPUT_DIR);

  logger.info('stage-6', { phase: 'done', release: PIPELINE.releaseVersion });
}

async function fetchTotalWords(): Promise<number> {
  const { readFileSync } = await import('fs');
  const manifest = JSON.parse(readFileSync(PATHS.manifest, 'utf-8'));
  return manifest.totalWords;
}

if (import.meta.main) {
  runStage6().catch(e => {
    logger.error('stage-6', { err: String(e) });
    process.exit(1);
  });
}
