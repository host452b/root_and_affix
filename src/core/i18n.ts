/**
 * Minimal i18n — Chinese (default) + English.
 * No heavy framework, just a flat key→string map.
 */

export type Locale = 'zh' | 'en';

const ZH: Record<string, string> = {
  // Header
  'header.active': '运行中',
  'header.off': '已关闭',

  // Tabs
  'tab.main': '主页',
  'tab.custom': '我的词汇',
  'tab.stats': '统计',
  'tab.more': '设置',

  // Stats
  'stats.today': '今日',
  'stats.total': '总计',
  'stats.cleared': '已掌握',
  'stats.bestCombo': '最佳连击',

  // Level
  'level.title': '沉浸强度',

  // Theme
  'theme.title': '主题',

  // Word Bank
  'bank.title': '词库',
  'bank.tier1': '基础',
  'bank.tier2': '进阶',
  'bank.tier3': '专业',
  'bank.tier4': '垂直领域',

  // Decode Panel
  'decode.cleared': '标记已会',
  'decode.review': '继续复习',
  'decode.origin': '词源',
  'decode.context': '语境',
  'decode.decode': '拆解',
  'decode.nativeFeel': '语感',

  // More Tab
  'more.import': '导入 / 导出',
  'more.audio': '音效',
  'more.export': '数据导出',
  'more.blocklist': '跳过的网站',
  'more.blockCurrent': '跳过此站',
  'more.reflip': '重新 FLIP',
  'more.reset': '重置插件',
  'more.resetConfirm': '确认重置？',
  'more.resetWarning': '将清除所有学习记录、设置和自定义词库。此操作不可撤销。',

  // Radar
  'radar.title': '英文标注',
  'radar.desc': '浏览英文网站时，标注词库中的单词',

  // Custom Bank
  'custom.title': '我的词汇',
  'custom.add': '添加',
  'custom.importCsv': '导入 CSV (english,chinese,tags)',
  'custom.empty': '暂无自定义词汇',

  // Community
  'community.export': '导出',
  'community.exportDesc': '导出我的词汇为 JSON 文件。',
  'community.exportBtn': '导出我的词汇',
  'community.import': '导入',
  'community.importDesc': '导入 Flipword 词库文件 (.json)。',
  'community.importBtn': '选择文件',
  'community.importSuccess': '成功导入',
  'community.importError': '格式无效，请使用 Flipword 导出文件。',
  'community.words': '个词',

  // Stats Tab
  'stats.streak': '连续天数',
  'stats.streakStart': '今天开始吧！',
  'stats.streakKeep': '保持下去！',
  'stats.streakGoal': '天达成周目标',
  'stats.last7': '最近 7 天',
  'stats.mastery': '掌握进度',
  'stats.allWords': '全部词汇',
  'stats.noWords': '暂无词汇记录',
  'stats.loading': '加载中...',
  'stats.weekSummary': '本周摘要',
  'stats.expressions': '个表达',
  'stats.vsLastWeek': 'vs 上周',
  'stats.domains': '主要领域',
  'stats.masteryRate': '已掌握',
  'stats.recentMastered': '最近掌握',
  'stats.viewAll': '查看全部 →',
  'stats.noMastered': '继续浏览，掌握的词会出现在这里',
  'stats.emptyHint': '开始浏览网页，FlipWord 会自动记录你的进度',

  // Home — immersion summary
  'home.todayTitle': '今日沉浸',
  'home.expressions': '个表达',
  'home.vsYesterday.more': '比昨天多',
  'home.vsYesterday.less': '比昨天少',
  'home.vsYesterday.same': '和昨天一样',
  'home.weekTrend': '本周趋势',
  'home.currentMode': '当前模式',
  'home.adjustSettings': '调整设置 →',
  'home.noActivity': '今天还没开始浏览',

  // Presence indicator
  'presence.paused': '已暂停',
  'presence.resume': '恢复',
  'presence.pause': '暂停',
  'presence.skipSite': '跳过本站',

  // Language
  'lang.switch': 'EN',
};

const EN: Record<string, string> = {
  'header.active': 'ACTIVE',
  'header.off': 'OFF',

  'tab.main': 'HOME',
  'tab.custom': 'MY WORDS',
  'tab.stats': 'STATS',
  'tab.more': 'SETTINGS',

  'stats.today': 'TODAY',
  'stats.total': 'TOTAL',
  'stats.cleared': 'CLEARED',
  'stats.bestCombo': 'BEST COMBO',

  'level.title': 'Immersion Level',
  'theme.title': 'Theme',

  'bank.title': 'Word Bank',
  'bank.tier1': 'Foundation',
  'bank.tier2': 'Intermediate',
  'bank.tier3': 'Advanced',
  'bank.tier4': 'Domain',

  'decode.cleared': 'Cleared',
  'decode.review': 'Re-flip',
  'decode.origin': 'Origin',
  'decode.context': 'Context',
  'decode.decode': 'Decode',
  'decode.nativeFeel': 'Native Feel',

  'more.import': 'Import / Export',
  'more.audio': 'Sound Effects',
  'more.export': 'Data Export',
  'more.blocklist': 'Skip Sites',
  'more.blockCurrent': 'Skip This Site',
  'more.reflip': 'Re-flip Page',
  'more.reset': 'Reset',
  'more.resetConfirm': 'Confirm Reset?',
  'more.resetWarning': 'This will erase all learning data, settings, and custom words. Cannot be undone.',

  'radar.title': 'English Annotation',
  'radar.desc': 'Annotate word-bank words on English pages',

  'custom.title': 'My Words',
  'custom.add': 'Add',
  'custom.importCsv': 'Import CSV (english,chinese,tags)',
  'custom.empty': 'No custom words yet.',

  'community.export': 'Export',
  'community.exportDesc': 'Export custom words as JSON.',
  'community.exportBtn': 'Export My Words',
  'community.import': 'Import',
  'community.importDesc': 'Import a Flipword bank file (.json).',
  'community.importBtn': 'Choose File',
  'community.importSuccess': 'Imported',
  'community.importError': 'Invalid format. Use a Flipword export file.',
  'community.words': 'words',

  'stats.streak': 'Day Streak',
  'stats.streakStart': 'Start today!',
  'stats.streakKeep': 'Keep it up!',
  'stats.streakGoal': ' days to Weekly Warrior',
  'stats.last7': 'Last 7 Days',
  'stats.mastery': 'Mastery Progress',
  'stats.allWords': 'All Words',
  'stats.noWords': 'No words encountered yet.',
  'stats.loading': 'Loading...',
  'stats.weekSummary': 'This Week',
  'stats.expressions': 'expressions',
  'stats.vsLastWeek': 'vs last week',
  'stats.domains': 'Main Domains',
  'stats.masteryRate': 'Mastered',
  'stats.recentMastered': 'Recently Mastered',
  'stats.viewAll': 'View All →',
  'stats.noMastered': 'Keep browsing — mastered words will appear here',
  'stats.emptyHint': 'Start browsing to track your progress',

  'home.todayTitle': 'Today',
  'home.expressions': 'expressions',
  'home.vsYesterday.more': 'more than yesterday',
  'home.vsYesterday.less': 'less than yesterday',
  'home.vsYesterday.same': 'same as yesterday',
  'home.weekTrend': 'This Week',
  'home.currentMode': 'Current Mode',
  'home.adjustSettings': 'Adjust Settings →',
  'home.noActivity': 'Start browsing to begin',

  'presence.paused': 'paused',
  'presence.resume': 'resume',
  'presence.pause': 'pause',
  'presence.skipSite': 'skip site',

  'lang.switch': '中',
};

const LOCALES: Record<Locale, Record<string, string>> = { zh: ZH, en: EN };

let currentLocale: Locale = 'zh';

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  // Persist to storage so it survives popup close
  try { chrome.storage.local.set({ wg_locale: locale }); } catch {}
}

export function getLocale(): Locale {
  return currentLocale;
}

/** Load persisted locale — call once on popup open */
export async function loadLocale(): Promise<Locale> {
  try {
    const result = await chrome.storage.local.get('wg_locale');
    if (result['wg_locale'] === 'en' || result['wg_locale'] === 'zh') {
      currentLocale = result['wg_locale'];
    }
  } catch {}
  return currentLocale;
}

export function t(key: string): string {
  return LOCALES[currentLocale][key] ?? LOCALES.zh[key] ?? key;
}
