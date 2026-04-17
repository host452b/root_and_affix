import type { DailyStats, UserSettings, UserWordState } from './types.js';
import type { CustomWordEntry } from './storage.js';

export type Message =
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; settings: Partial<UserSettings> }
  | { type: 'GET_STATS' }
  | { type: 'RECORD_EXPOSURE'; wordId: string; bankIds?: string[] }
  | { type: 'RECORD_CLICK'; wordId: string }
  | { type: 'RECORD_HOVER'; wordId: string }
  | { type: 'MARK_CLEARED'; wordId: string }
  | { type: 'MARK_REVIEW'; wordId: string }
  | { type: 'GET_WORD_STATE'; wordId: string }
  | { type: 'GET_WORD_STATES'; wordIds: string[] }
  | { type: 'GET_PAGE_COUNT' }
  | { type: 'GET_CUSTOM_WORDS' }
  | { type: 'ADD_CUSTOM_WORD'; word: string; chinese: string; tags: string[] }
  | { type: 'DELETE_CUSTOM_WORD'; id: string }
  | { type: 'IMPORT_CUSTOM_CSV'; csv: string }
  | { type: 'GET_WEEKLY_STATS' }
  | { type: 'GET_ALL_WORD_STATES' }
  | { type: 'GET_STREAK' }
  | { type: 'CHECK_ACHIEVEMENTS' }
  | { type: 'GET_UNLOCKED_ACHIEVEMENTS' }
  | { type: 'GET_LLM_CONFIG' }
  | { type: 'SAVE_LLM_CONFIG'; config: { enabled: boolean; endpoint: string; model: string } }
  | { type: 'GET_AUDIO_CONFIG' }
  | { type: 'SAVE_AUDIO_CONFIG'; config: { enabled: boolean; volume: number } }
  | { type: 'UPDATE_BEST_COMBO'; comboCount: number }
  | { type: 'GET_TODAY_SUMMARY' }
  | { type: 'GET_WEEK_SUMMARY' };

export type MessageResponse<T extends Message['type']> =
  T extends 'GET_SETTINGS' ? UserSettings :
  T extends 'SAVE_SETTINGS' ? UserSettings :
  T extends 'GET_STATS' ? { today: number; total: number; cleared: number; bestCombo: number } :
  T extends 'GET_WORD_STATE' ? UserWordState | null :
  T extends 'GET_WORD_STATES' ? Record<string, UserWordState> :
  T extends 'GET_PAGE_COUNT' ? number :
  T extends 'GET_CUSTOM_WORDS' ? CustomWordEntry[] :
  T extends 'GET_WEEKLY_STATS' ? { date: string; count: number }[] :
  T extends 'GET_ALL_WORD_STATES' ? UserWordState[] :
  T extends 'GET_STREAK' ? number :
  T extends 'CHECK_ACHIEVEMENTS' ? string[] :
  T extends 'GET_UNLOCKED_ACHIEVEMENTS' ? string[] :
  T extends 'GET_LLM_CONFIG' ? { enabled: boolean; endpoint: string; model: string } :
  T extends 'GET_AUDIO_CONFIG' ? { enabled: boolean; volume: number } :
  T extends 'GET_TODAY_SUMMARY' ? { todayWords: number; yesterdayWords: number; domains: string[]; streak: number } :
  T extends 'GET_WEEK_SUMMARY' ? { thisWeek: number; lastWeek: number; domains: string[]; masteryRate: number; streak: number } :
  void;

export function sendMessage<T extends Message>(msg: T): Promise<MessageResponse<T['type']>> {
  return chrome.runtime.sendMessage(msg);
}
