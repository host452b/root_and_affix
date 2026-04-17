import type { Message } from './core/messages.js';
import { loadSettings, saveSettings, loadDailyStats, saveDailyStats, getWordState, getWordStates, putWordState, newWordState, getCustomWords, addCustomWord, deleteCustomWord, getAllWordStates, getHistory, getUnlockedAchievements, unlockAchievement, loadLLMConfig, saveLLMConfig, loadAudioConfig, saveAudioConfig, localDateStr, type CustomWordEntry } from './core/storage.js';
import { sm2Update, actionToQuality } from './core/sm2.js';
import { ACHIEVEMENTS, type AchievementContext } from './crit/achievements.js';

/** Parse a CSV line handling quoted fields (e.g., "word, with comma","中文") */
function parseCSVLine(line: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current.trim());
  return parts;
}

let pageCount = 0;

chrome.runtime.onInstalled.addListener(async () => {
  // Ensure defaults exist
  await loadSettings();
});

chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
  handleMessage(msg).then(sendResponse);
  return true; // keep channel open for async response
});

async function handleMessage(msg: Message): Promise<unknown> {
  switch (msg.type) {
    case 'GET_SETTINGS':
      return loadSettings();

    case 'SAVE_SETTINGS':
      return saveSettings(msg.settings);

    case 'GET_STATS': {
      const stats = await loadDailyStats();
      // Cumulative totals from all word states
      const allStates = await getAllWordStates();
      const totalFlips = allStates.reduce((sum, s) => sum + s.exposureCount, 0);
      const totalCleared = allStates.filter(s => s.status === 'mastered').length;
      return {
        today: stats.flipCount,
        total: totalFlips,
        cleared: totalCleared,
        bestCombo: stats.bestCombo,
      };
    }

    case 'RECORD_EXPOSURE': {
      const stats = await loadDailyStats();
      stats.flipCount++;
      stats.uniqueWords.add(msg.wordId);
      // Track domain hits from active banks
      if (msg.bankIds) {
        for (const bankId of msg.bankIds) {
          stats.domainHits[bankId] = (stats.domainHits[bankId] ?? 0) + 1;
        }
      }
      await saveDailyStats(stats);

      // Check daily goal (30 flips = daily-complete)
      const DAILY_GOAL = 30;
      const hitGoal = stats.flipCount === DAILY_GOAL;

      let state = await getWordState(msg.wordId);
      if (!state) state = newWordState(msg.wordId);
      const wasLearning = state.status === 'seen' || state.status === 'learning';
      state.exposureCount++;
      state.lastExposureAt = Date.now();
      if (state.status === 'new') state.status = 'seen';
      if (wasLearning) {
        state = sm2Update(state, actionToQuality('recognized'));
      }
      await putWordState(state);

      // Return daily-complete flag to content script
      return hitGoal ? { dailyComplete: true } : undefined;
      return;
    }

    case 'RECORD_CLICK': {
      let state = await getWordState(msg.wordId);
      if (!state) state = newWordState(msg.wordId);
      state.clickCount++;
      if (state.decodedAt === null) state.decodedAt = Date.now();
      if (state.status === 'seen') state.status = 'learning';
      state = sm2Update(state, actionToQuality('clicked'));
      await putWordState(state);
      return;
    }

    case 'RECORD_HOVER': {
      let state = await getWordState(msg.wordId);
      if (!state) state = newWordState(msg.wordId);
      state.hoverCount++;
      await putWordState(state);
      return;
    }

    case 'MARK_CLEARED': {
      let state = await getWordState(msg.wordId);
      if (!state) state = newWordState(msg.wordId);
      state.status = 'mastered';
      state.masteredAt = Date.now();
      state.clearedCount = (state.clearedCount ?? 0) + 1;
      state = sm2Update(state, actionToQuality('cleared'));
      await putWordState(state);

      const stats = await loadDailyStats();
      stats.clearedCount++;
      await saveDailyStats(stats);

      // Trigger achievement check — return newly unlocked to content script for toast
      const newlyUnlocked = await handleMessage({ type: 'CHECK_ACHIEVEMENTS' } as Message).catch(() => []);
      return newlyUnlocked;
    }

    case 'MARK_REVIEW': {
      let state = await getWordState(msg.wordId);
      if (!state) state = newWordState(msg.wordId);
      state.status = 'reviewing';
      await putWordState(state);
      return;
    }

    case 'UPDATE_BEST_COMBO': {
      const stats = await loadDailyStats();
      if (msg.comboCount > stats.bestCombo) {
        stats.bestCombo = msg.comboCount;
        await saveDailyStats(stats);
      }
      return;
    }

    case 'GET_WORD_STATE':
      return getWordState(msg.wordId);

    case 'GET_WORD_STATES':
      return getWordStates(msg.wordIds);

    case 'GET_PAGE_COUNT':
      return pageCount;

    case 'GET_CUSTOM_WORDS':
      return getCustomWords();

    case 'ADD_CUSTOM_WORD': {
      // Deduplicate: use word as ID base (not timestamp) to prevent duplicates
      const wordId = msg.word.toLowerCase().replace(/\s+/g, '-');
      const existing = await getCustomWords();
      if (existing.some(w => w.word.toLowerCase() === msg.word.toLowerCase())) {
        return; // Already exists, skip silently
      }
      const entry: CustomWordEntry = {
        id: wordId,
        word: msg.word,
        chinese: msg.chinese,
        tags: msg.tags,
        addedAt: Date.now(),
      };
      await addCustomWord(entry);
      return;
    }

    case 'DELETE_CUSTOM_WORD':
      await deleteCustomWord(msg.id);
      return;

    case 'IMPORT_CUSTOM_CSV': {
      const lines = msg.csv.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      const startIdx = /^(english|word)/i.test(lines[0]) ? 1 : 0;
      // Load existing for dedup
      const existingCustom = await getCustomWords();
      const existingWords = new Set(existingCustom.map(w => w.word.toLowerCase()));

      for (const line of lines.slice(startIdx)) {
        const parts = parseCSVLine(line);
        if (parts.length < 2 || !parts[0] || !parts[1]) continue;
        const word = parts[0].trim();
        if (existingWords.has(word.toLowerCase())) continue; // skip duplicate
        existingWords.add(word.toLowerCase());

        const tags = parts[2]
          ? parts[2].split(';').map((t: string) => t.trim()).filter(Boolean)
          : ['CUSTOM'];
        const entry: CustomWordEntry = {
          id: word.toLowerCase().replace(/\s+/g, '-'),
          word,
          chinese: parts[1].trim(),
          tags,
          addedAt: Date.now(),
        };
        await addCustomWord(entry);
      }
      return;
    }

    case 'GET_WEEKLY_STATS': {
      const history = await getHistory();
      const result: { date: string; count: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const date = localDateStr(d);
        result.push({ date, count: history[date] ?? 0 });
      }
      return result;
    }

    case 'GET_ALL_WORD_STATES':
      return getAllWordStates();

    case 'GET_STREAK': {
      const history = await getHistory();
      let streak = 0;
      const today = new Date();
      // Start checking from today backwards
      for (let i = 0; i < 366; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const date = localDateStr(d);
        if ((history[date] ?? 0) > 0) {
          streak++;
        } else {
          break;
        }
      }
      return streak;
    }

    case 'GET_UNLOCKED_ACHIEVEMENTS':
      return getUnlockedAchievements();

    case 'GET_LLM_CONFIG':
      return loadLLMConfig();

    case 'SAVE_LLM_CONFIG':
      await saveLLMConfig(msg.config);
      return;

    case 'GET_AUDIO_CONFIG':
      return loadAudioConfig();

    case 'SAVE_AUDIO_CONFIG':
      await saveAudioConfig(msg.config);
      return;

    case 'GET_TODAY_SUMMARY': {
      const todayStats = await loadDailyStats();
      const history = await getHistory();

      // Yesterday's count — now same metric as today (unique words)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = localDateStr(yesterday);
      const yesterdayWords = history[yesterdayStr] ?? 0;

      // Domains from actual exposure, sorted by hit count descending
      const { getBankNameCn } = await import('./core/banks.js');
      const domains = Object.entries(todayStats.domainHits)
        .sort((a, b) => b[1] - a[1])
        .map(([bankId]) => getBankNameCn(bankId));

      // Streak
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 366; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const date = localDateStr(d);
        if ((history[date] ?? 0) > 0) {
          streak++;
        } else {
          break;
        }
      }

      return {
        todayWords: todayStats.uniqueWords.size,
        yesterdayWords,
        domains,
        streak,
      };
    }

    case 'GET_WEEK_SUMMARY': {
      const history = await getHistory();
      const allStates = await getAllWordStates();
      const { getBankNameCn } = await import('./core/banks.js');

      // This week vs last week — both use unique word counts from history
      let thisWeek = 0;
      let lastWeek = 0;
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        thisWeek += history[localDateStr(d)] ?? 0;
        const d2 = new Date(today);
        d2.setDate(d2.getDate() - 7 - i);
        lastWeek += history[localDateStr(d2)] ?? 0;
      }

      // Mastery rate (excl 'new' status)
      const tracked = allStates.filter(s => s.status !== 'new');
      const mastered = tracked.filter(s => s.status === 'mastered').length;
      const masteryRate = tracked.length > 0 ? Math.round((mastered / tracked.length) * 100) : 0;

      // Domains from today's actual exposure (best available signal)
      const todayStats = await loadDailyStats();
      const domains = Object.entries(todayStats.domainHits)
        .sort((a, b) => b[1] - a[1])
        .map(([bankId]) => getBankNameCn(bankId));

      // Streak
      let streak = 0;
      for (let i = 0; i < 366; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        if ((history[localDateStr(d)] ?? 0) > 0) streak++;
        else break;
      }

      return { thisWeek, lastWeek, domains, masteryRate, streak };
    }

    case 'CHECK_ACHIEVEMENTS': {
      const [dailyStats, allStates, customWords, unlockedIds] = await Promise.all([
        loadDailyStats(),
        getAllWordStates(),
        getCustomWords(),
        getUnlockedAchievements(),
      ]);
      const history = await getHistory();

      // Compute streak (using local date, not UTC)
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 366; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if ((history[date] ?? 0) > 0) {
          streak++;
        } else {
          break;
        }
      }

      const ctx: AchievementContext = {
        totalCleared: allStates.filter(s => s.status === 'mastered').length,
        totalExposures: allStates.reduce((sum, s) => sum + s.exposureCount, 0),
        bestCombo: dailyStats.bestCombo,
        streak,
        customWordsCount: customWords.length,
      };

      const newlyUnlocked: string[] = [];
      for (const achievement of ACHIEVEMENTS) {
        if (!unlockedIds.includes(achievement.id) && achievement.condition(ctx)) {
          await unlockAchievement(achievement.id);
          newlyUnlocked.push(achievement.id);
        }
      }
      return newlyUnlocked;
    }
  }
}

// Track page flip events
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'RECORD_EXPOSURE') pageCount++;
});
