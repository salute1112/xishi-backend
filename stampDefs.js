// 邮票定义：解锁类型与目标值（与前端 STAMPS 对齐）
const STAMP_DEFS = [
  { id: 'moscow', unlockType: 'first_visit', target: 1 },
  { id: 'paris', unlockType: 'login', target: 1 },
  { id: 'iceland', unlockType: 'first_letter', target: 1 },
  { id: 'lighthouse', unlockType: 'letters_3', target: 3 },
  { id: 'london', unlockType: 'letters_5', target: 8 },
  { id: 'new-york', unlockType: 'letters_10', target: 15 },
  { id: 'africa', unlockType: 'first_reply', target: 1 },
  { id: 'tokyo', unlockType: 'replies_3', target: 6 },
  { id: 'dragon-boat', unlockType: 'replies_5', target: 5 },
  { id: 'alpine', unlockType: 'psych_test', target: 1 },
  { id: 'lake', unlockType: 'psych_3', target: 5 },
  { id: 'kyoto', unlockType: 'sleep_3', target: 3 },
  { id: 'forest', unlockType: 'sleep_7', target: 12 },
  { id: 'panda', unlockType: 'music_5', target: 5 },
  { id: 'desert', unlockType: 'music_10', target: 15 },
  { id: 'fox', unlockType: 'consult_book', target: 1 },
  { id: 'whale', unlockType: 'mood_trash', target: 1 },
  { id: 'deer', unlockType: 'trash_3', target: 6 },
  { id: 'spring-festival', unlockType: 'community_post', target: 1 },
  { id: 'owl', unlockType: 'community_3', target: 6 },
  { id: 'lantern', unlockType: 'community_5', target: 8 },
  { id: 'mid-autumn', unlockType: 'streak_3', target: 3 },
  { id: 'cat', unlockType: 'streak_7', target: 7 },
  { id: 'christmas', unlockType: 'all_stamps', target: 23 },
];

// 行为计数器 → 影响的邮票解锁类型
const ACTION_UNLOCK_MAP = {
  first_visit: ['first_visit'],
  login: ['login'],
  first_letter: ['first_letter', 'letters_3', 'letters_5', 'letters_10'],
  first_reply: ['first_reply', 'replies_3', 'replies_5'],
  psych_test: ['psych_test', 'psych_3'],
  sleep: ['sleep_3', 'sleep_7'],
  music: ['music_5', 'music_10'],
  streak: ['streak_3', 'streak_7'],
  consult_book: ['consult_book'],
  mood_trash: ['mood_trash', 'trash_3'],
  community_post: ['community_post', 'community_3', 'community_5'],
};

module.exports = { STAMP_DEFS, ACTION_UNLOCK_MAP };
