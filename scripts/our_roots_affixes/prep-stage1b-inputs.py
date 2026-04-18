#!/usr/bin/env python3
"""
Rebuild /tmp Stage 1b input files after a session restart.
Run this before dispatching any Stage 1b subagents.
"""
import json, os

BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(BASE, 'data', 'our_roots_affixes')
WORDS_DIR = os.path.join(DATA, 'words')

def main():
    # Load bucket plan
    plan = json.load(open(os.path.join(DATA, '_staging', 'bucket-plan.json')))
    bucket_map = {b['id']: b['words'] for b in plan['buckets']}

    # Find missing buckets (not yet written)
    done = set(f.replace('.json', '') for f in os.listdir(WORDS_DIR) if f.endswith('.json'))
    missing = [bid for bid in bucket_map if bid not in done]
    missing.sort()

    if not missing:
        print('All buckets complete — nothing to prepare.')
        return

    # Write word lists for missing buckets
    for bid in missing:
        words = bucket_map[bid]
        with open(f'/tmp/s1b-{bid}.json', 'w') as f:
            json.dump(words, f, ensure_ascii=False)

    print(f'Written {len(missing)} bucket files: {missing}')

    # Build compact inventory from morphemes/
    roots = json.load(open(os.path.join(DATA, 'morphemes', 'roots.json')))
    affixes = json.load(open(os.path.join(DATA, 'morphemes', 'affixes.json')))
    linkers = json.load(open(os.path.join(DATA, 'morphemes', 'linkers.json')))
    inventory = {}
    for e in roots + affixes + linkers:
        inventory[e['id']] = {'role': e['role'], 'cn': e['coreMeaning']['cn']}
    with open('/tmp/s1b-inventory.json', 'w') as f:
        json.dump(inventory, f, ensure_ascii=False)
    print(f'Inventory: {len(inventory)} entries ({os.path.getsize("/tmp/s1b-inventory.json")//1024}KB)')

    # Build fewshot from first completed bucket
    completed = sorted([f for f in os.listdir(WORDS_DIR) if f.endswith('.json')])
    if completed:
        sample = json.load(open(os.path.join(WORDS_DIR, completed[0])))
        fewshot = sample[:2]
        with open('/tmp/s1b-fewshot.json', 'w') as f:
            json.dump(fewshot, f, ensure_ascii=False, indent=2)
        print(f'Fewshot: 2 examples from {completed[0]}')
    else:
        print('WARNING: No completed buckets found — fewshot file not created.')

if __name__ == '__main__':
    main()
