/**
 * Single source of truth for available word banks.
 *
 * popup/index.tsx, onboarding/index.ts, and any future UI
 * must read from this registry — NOT hardcode bank lists.
 *
 * To add/remove a bank:
 * 1. Add/remove the JSON file in data/word-banks/
 * 2. Add/remove the entry here
 * 3. That's it — popup and onboarding auto-update
 */

export type DifficultyTier = 1 | 2 | 3 | 4;

export interface BankInfo {
  /** File name without .json (used as settings key and file path) */
  id: string;
  /** Short label for popup chip (max 5 chars) */
  label: string;
  /** Human-readable name */
  name: string;
  /** Chinese name for onboarding */
  nameCn: string;
  /** Difficulty tier: 1=基础, 2=进阶, 3=专业, 4=垂直领域 */
  tier: DifficultyTier;
}

export const TIER_LABELS: Record<DifficultyTier, { name: string; nameCn: string }> = {
  1: { name: 'Foundation', nameCn: '基础' },
  2: { name: 'Intermediate', nameCn: '进阶' },
  3: { name: 'Advanced', nameCn: '专业' },
  4: { name: 'Domain', nameCn: '垂直领域' },
};

export const BANKS: BankInfo[] = [
  // Tier 1: Foundation — common exams, basic academic
  { id: 'ielts',    label: 'IELTS',  name: 'IELTS',              nameCn: '雅思',     tier: 1 },
  { id: 'toefl',    label: 'TOEFL',  name: 'TOEFL',              nameCn: '托福',     tier: 1 },
  { id: 'cet4',     label: 'CET4',   name: 'CET-4',              nameCn: '四级',     tier: 1 },
  { id: 'cefr-b2',  label: 'B2',     name: 'CEFR B2',            nameCn: '欧标B2',   tier: 1 },

  // Tier 2: Intermediate — harder exams, academic, business
  { id: 'gre',      label: 'GRE',    name: 'GRE',                nameCn: 'GRE',      tier: 2 },
  { id: 'sat',      label: 'SAT',    name: 'SAT',                nameCn: 'SAT',      tier: 2 },
  { id: 'gmat',     label: 'GMAT',   name: 'GMAT',               nameCn: 'GMAT',     tier: 2 },
  { id: 'npee',     label: 'NPEE',   name: 'NPEE (Postgrad)',     nameCn: '考研',     tier: 2 },
  { id: 'academic', label: 'ACAD',   name: 'Academic',            nameCn: '学术',     tier: 2 },
  { id: 'business', label: 'BIZ',    name: 'Business',            nameCn: '商务',     tier: 2 },

  // Tier 3: Advanced — content-specific, editorial
  { id: 'tech',     label: 'HN/SO',  name: 'Tech (HN+SO)',       nameCn: '科技',     tier: 3 },
  { id: 'news',     label: 'NEWYC',  name: 'News',               nameCn: '新闻',     tier: 3 },
  { id: 'editorial',label: 'EDIT',   name: 'Editorial',          nameCn: '长文阅读',  tier: 3 },

  // Tier 4: Domain — specialized professional
  { id: 'finance',  label: 'FINC',   name: 'Finance',            nameCn: '金融',     tier: 4 },
  { id: 'medical',  label: 'MED',    name: 'Medical',            nameCn: '医学',     tier: 4 },
  { id: 'legal',    label: 'LAW',    name: 'Legal',              nameCn: '法律',     tier: 4 },
  { id: 'cybersec', label: 'SEC',    name: 'Cybersecurity',      nameCn: '安全',     tier: 4 },
];

export const BANK_IDS = BANKS.map(b => b.id);

export function getBankLabel(id: string): string {
  return BANKS.find(b => b.id === id)?.label ?? id.toUpperCase();
}

export function getBankNameCn(id: string): string {
  return BANKS.find(b => b.id === id)?.nameCn ?? id;
}

export function getBanksByTier(tier: DifficultyTier): BankInfo[] {
  return BANKS.filter(b => b.tier === tier);
}
