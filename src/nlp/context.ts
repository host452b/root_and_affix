import type { WordEntry } from '../core/types.js';

// Domain keywords that suggest topical context
const DOMAIN_HINTS: Record<string, string[]> = {
  economy: ['经济', '市场', '投资', '金融', '贸易', '通胀', '货币', '财政'],
  technology: ['技术', '科技', '数据', '算法', '网络', '人工智能', '数字', '创新'],
  environment: ['环境', '气候', '污染', '生态', '排放', '能源', '碳', '可持续'],
  health: ['健康', '医疗', '疾病', '治疗', '症状', '疫苗', '药物', '患者'],
  education: ['教育', '学生', '课程', '教师', '学校', '研究', '学术', '考试'],
  politics: ['政治', '政府', '政策', '选举', '民主', '立法', '改革', '制度'],
};

export interface ContextScore {
  domain: string | null;
  domainScore: number;    // 0-1
  confidence: number;     // final weighted score 0-1
}

/**
 * Analyze surrounding text to detect domain context.
 * Returns the most likely domain and a confidence boost.
 */
export function analyzeContext(text: string): ContextScore {
  let bestDomain: string | null = null;
  let bestCount = 0;

  for (const [domain, keywords] of Object.entries(DOMAIN_HINTS)) {
    let count = 0;
    for (const kw of keywords) {
      if (text.includes(kw)) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      bestDomain = domain;
    }
  }

  const domainScore = bestCount >= 3 ? 1.0 : bestCount >= 2 ? 0.7 : bestCount >= 1 ? 0.4 : 0;

  return {
    domain: bestDomain,
    domainScore,
    confidence: domainScore,
  };
}

/**
 * Score a specific match given surrounding context.
 * Returns adjusted confidence 0-1.
 */
export function scoreMatch(
  originalText: string,
  sentenceContext: string,
  entry: WordEntry,
  contextAnalysis: ContextScore,
): number {
  // Base score: exact Chinese match is inherently high-confidence
  let score = 0.85;

  // Boost if word difficulty tags align with context domain
  if (contextAnalysis.domain && contextAnalysis.domainScore > 0) {
    score += contextAnalysis.domainScore * 0.1;
  }

  // Boost/penalize based on contextHint if present
  // contextHint narrows when this English word is appropriate for this Chinese trigger
  for (const mapping of entry.chineseMappings) {
    if (mapping.chinese === originalText && mapping.contextHint) {
      // Has a context hint — check if surrounding text contains hint keywords
      const hintChars = mapping.contextHint.replace(/[（）()\/]/g, '');
      const hasHintContext = hintChars.split('').some(ch => sentenceContext.includes(ch));
      if (hasHintContext) {
        score += 0.15; // boost: context matches hint
      } else {
        score -= 0.1; // penalize slightly: context doesn't match hint
      }
      break;
    }
  }

  return Math.min(1.0, Math.max(0, score));
}
