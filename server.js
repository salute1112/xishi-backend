const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./db');
require('./seed'); // 首次启动（空库）时自动写入种子数据
const { signToken, authOptional, authRequired } = require('./auth');
const { STAMP_DEFS, ACTION_UNLOCK_MAP } = require('./stampDefs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = file.mimetype.split('/')[1] || 'jpg';
    cb(null, `avatar-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

// ============ 工具函数 ============
function publicUser(u) {
  return {
    id: u.id,
    nickname: u.nickname,
    avatar: u.avatar || '',
    signature: u.bio || '',
    isBot: !!u.is_bot,
  };
}

function letterWithReplies(row) {
  const replies = db
    .prepare('SELECT * FROM letter_replies WHERE letter_id = ? ORDER BY id')
    .all(row.id)
    .map((r) => ({
      id: String(r.id),
      content: r.content,
      sender: r.author_name,
      createdAt: r.created_at.slice(0, 10),
    }));
  return {
    id: String(row.id),
    title: row.title,
    content: row.content,
    sender: row.sender_name,
    senderId: row.sender_id,
    recipient: 'SAY收',
    visibility: row.visibility,
    stampType: row.stamp_type,
    createdAt: row.created_at.slice(0, 10),
    replies,
  };
}

function postWithData(row, userId) {
  const responses = db
    .prepare('SELECT * FROM post_responses WHERE post_id = ? ORDER BY id')
    .all(row.id)
    .map((r) => ({
      id: String(r.id),
      content: r.content,
      author: r.author_name,
      createdAt: r.created_at.slice(0, 10),
    }));
  const likeCount = db.prepare('SELECT COUNT(*) c FROM post_likes WHERE post_id = ?').get(row.id).c;
  const hugCount = db.prepare('SELECT COUNT(*) c FROM post_hugs WHERE post_id = ?').get(row.id).c;
  const isLiked = userId
    ? !!db.prepare('SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?').get(row.id, userId)
    : false;
  const isHugged = userId
    ? !!db.prepare('SELECT 1 FROM post_hugs WHERE post_id = ? AND user_id = ?').get(row.id, userId)
    : false;
  return {
    id: String(row.id),
    content: row.content,
    author: row.author_name,
    authorId: row.author_id,
    authorAvatar: row.author_avatar || '',
    createdAt: row.created_at.slice(0, 10),
    likes: row.base_likes + likeCount,
    hugs: hugCount,
    isLiked,
    isHugged,
    responses,
  };
}

// ============ 鉴权 ============
const codeStore = new Map(); // phone -> { code, expires }

app.post('/api/auth/send-code', (req, res) => {
  const { phone } = req.body || {};
  if (!/^1[3-9]\d{9}$/.test(phone || '')) {
    return res.status(400).json({ error: '请输入正确的 11 位手机号' });
  }
  const code = String(100000 + Math.floor(Math.random() * 900000));
  codeStore.set(phone, { code, expires: Date.now() + 5 * 60 * 1000 });
  return res.json({ ok: true, demoCode: code }); // 演示环境回传验证码
});

app.post('/api/auth/login-phone', (req, res) => {
  const { phone, code } = req.body || {};
  if (!/^1[3-9]\d{9}$/.test(phone || '')) {
    return res.status(400).json({ error: '请输入正确的 11 位手机号' });
  }
  const rec = codeStore.get(phone);
  if (!rec || rec.code !== code || Date.now() > rec.expires) {
    return res.status(400).json({ error: '验证码不正确或已过期' });
  }
  codeStore.delete(phone);

  let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user) {
    const info = db
      .prepare("INSERT INTO users (phone, login_method, nickname, avatar) VALUES (?, 'phone', ?, '')")
      .run(phone, '心事朋友');
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  }
  unlockStamp(user.id, 'login');
  return res.json({ token: signToken(user), user: publicUser(user) });
});

app.post('/api/auth/login-third', (req, res) => {
  const { provider, deviceId, nickname } = req.body || {};
  if (!['wechat', 'qq'].includes(provider)) {
    return res.status(400).json({ error: '未知的登录方式' });
  }
  const openId = `${provider}_${deviceId || 'anon'}`;
  let third = db.prepare('SELECT * FROM third_party WHERE provider = ? AND open_id = ?').get(provider, openId);
  let user;
  if (third) {
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(third.user_id);
  } else {
    const defaultName = nickname || (provider === 'wechat' ? '微信朋友' : 'QQ朋友');
    const info = db
      .prepare("INSERT INTO users (login_method, nickname, avatar) VALUES (?, ?, '')")
      .run(provider, defaultName);
    db.prepare('INSERT INTO third_party (user_id, provider, open_id) VALUES (?, ?, ?)')
      .run(info.lastInsertRowid, provider, openId);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  }
  unlockStamp(user.id, 'login');
  return res.json({ token: signToken(user), user: publicUser(user) });
});

app.get('/api/auth/me', authOptional, (req, res) => {
  if (!req.user) return res.json({ user: null });
  return res.json({ user: publicUser(req.user) });
});

// ============ 用户资料 ============
app.put('/api/users/profile', authRequired, (req, res) => {
  const { nickname, signature, avatar, gender } = req.body || {};
  const patch = [];
  const vals = [];
  if (nickname !== undefined) { patch.push('nickname = ?'); vals.push(nickname); }
  if (signature !== undefined) { patch.push('bio = ?'); vals.push(signature); }
  if (avatar !== undefined) { patch.push('avatar = ?'); vals.push(avatar); }
  if (gender !== undefined) { /* 预留 */ }
  if (!patch.length) return res.json({ user: publicUser(req.user) });
  vals.push(req.user.id);
  db.prepare(`UPDATE users SET ${patch.join(', ')} WHERE id = ?`).run(...vals);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  return res.json({ user: publicUser(user) });
});

app.post('/api/users/avatar', authRequired, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到文件' });
  const url = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(url, req.user.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  return res.json({ user: publicUser(user), avatarUrl: url });
});

app.delete('/api/users/account', authRequired, (req, res) => {
  const id = req.user.id;
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return res.json({ ok: true });
});

app.get('/api/users/:id', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: '用户不存在' });
  return res.json({ user: publicUser(u) });
});

// ============ 信件 ============
app.get('/api/letters', authOptional, (req, res) => {
  let rows = db.prepare('SELECT * FROM letters ORDER BY id DESC').all();
  rows = rows.filter((r) => {
    if (r.visibility === 'all') return true;
    if (r.visibility === 'self') return req.user && r.sender_id === req.user.id;
    // one：登录用户可见（一人可见）
    return !!req.user;
  });
  return res.json({ letters: rows.map(letterWithReplies) });
});

app.get('/api/letters/:id', authOptional, (req, res) => {
  const row = db.prepare('SELECT * FROM letters WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '信件不存在' });
  if (row.visibility !== 'all' && (!req.user || (row.visibility === 'self' && row.sender_id !== req.user.id))) {
    return res.status(403).json({ error: '无权查看该信件' });
  }
  return res.json({ letter: letterWithReplies(row) });
});

app.post('/api/letters', authRequired, (req, res) => {
  const { title, content, stampType, visibility } = req.body || {};
  if (!content || !content.trim()) return res.status(400).json({ error: '信件内容不能为空' });
  const vis = ['all', 'self', 'one'].includes(visibility) ? visibility : 'all';
  const info = db
    .prepare("INSERT INTO letters (sender_id, sender_name, title, content, stamp_type, visibility, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'))")
    .run(req.user.id, req.user.nickname, title || '', content.trim(), stampType || 'moscow', vis);
  unlockStamp(req.user.id, 'first_letter');
  const row = db.prepare('SELECT * FROM letters WHERE id = ?').get(info.lastInsertRowid);
  return res.json({ letter: letterWithReplies(row) });
});

app.post('/api/letters/:id/replies', authRequired, (req, res) => {
  const { content } = req.body || {};
  if (!content || !content.trim()) return res.status(400).json({ error: '回信内容不能为空' });
  const letter = db.prepare('SELECT * FROM letters WHERE id = ?').get(req.params.id);
  if (!letter) return res.status(404).json({ error: '信件不存在' });
  db
    .prepare("INSERT INTO letter_replies (letter_id, author_id, author_name, content, created_at) VALUES (?, ?, ?, ?, datetime('now','localtime'))")
    .run(letter.id, req.user.id, req.user.nickname, content.trim());
  unlockStamp(req.user.id, 'first_reply');
  const row = db.prepare('SELECT * FROM letters WHERE id = ?').get(letter.id);
  return res.json({ letter: letterWithReplies(row) });
});

// 我寄出的信
app.get('/api/my/letters', authRequired, (req, res) => {
  const rows = db.prepare('SELECT * FROM letters WHERE sender_id = ? ORDER BY id DESC').all(req.user.id);
  return res.json({ letters: rows.map(letterWithReplies) });
});

// ============ 社区帖子 ============
app.get('/api/posts', authOptional, (req, res) => {
  const rows = db.prepare('SELECT * FROM posts ORDER BY id DESC').all();
  return res.json({ posts: rows.map((r) => postWithData(r, req.user ? req.user.id : null)) });
});

app.post('/api/posts', authRequired, (req, res) => {
  const { content } = req.body || {};
  if (!content || !content.trim()) return res.status(400).json({ error: '内容不能为空' });
  const info = db
    .prepare("INSERT INTO posts (author_id, author_name, author_avatar, content, created_at) VALUES (?, ?, ?, ?, datetime('now','localtime'))")
    .run(req.user.id, req.user.nickname, req.user.avatar || '', content.trim());
  unlockStamp(req.user.id, 'community_post');
  const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(info.lastInsertRowid);
  return res.json({ post: postWithData(row, req.user.id) });
});

app.post('/api/posts/:id/responses', authRequired, (req, res) => {
  const { content } = req.body || {};
  if (!content || !content.trim()) return res.status(400).json({ error: '回应内容不能为空' });
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: '帖子不存在' });
  db
    .prepare("INSERT INTO post_responses (post_id, author_id, author_name, content, created_at) VALUES (?, ?, ?, ?, datetime('now','localtime'))")
    .run(post.id, req.user.id, req.user.nickname, content.trim());
  return res.json({ post: postWithData(post, req.user.id) });
});

app.post('/api/posts/:id/like', authRequired, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: '帖子不存在' });
  const exists = db.prepare('SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?').get(post.id, req.user.id);
  if (exists) {
    db.prepare('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?').run(post.id, req.user.id);
  } else {
    db.prepare('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)').run(post.id, req.user.id);
  }
  return res.json({ post: postWithData(post, req.user.id) });
});

app.post('/api/posts/:id/hug', authRequired, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: '帖子不存在' });
  const exists = db.prepare('SELECT 1 FROM post_hugs WHERE post_id = ? AND user_id = ?').get(post.id, req.user.id);
  if (!exists) db.prepare('INSERT INTO post_hugs (post_id, user_id) VALUES (?, ?)').run(post.id, req.user.id);
  return res.json({ post: postWithData(post, req.user.id) });
});

// ============ 信友 ============
app.get('/api/friends', authRequired, (req, res) => {
  const rows = db
    .prepare(`SELECT u.* FROM friends f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ? ORDER BY f.created_at DESC`)
    .all(req.user.id);
  return res.json({ friends: rows.map(publicUser) });
});

app.get('/api/friend-requests', authRequired, (req, res) => {
  const incoming = db
    .prepare(`SELECT fr.*, u.nickname AS from_name, u.avatar AS from_avatar, u.is_bot AS from_bot
              FROM friend_requests fr JOIN users u ON u.id = fr.from_id
              WHERE fr.to_id = ? ORDER BY fr.id DESC`)
    .all(req.user.id)
    .map((r) => ({
      id: String(r.id), fromId: r.from_id, fromName: r.from_name,
      fromAvatar: r.from_avatar, message: r.message, status: r.status,
      createdAt: r.created_at, isFromBot: !!r.from_bot,
    }));
  const outgoing = db
    .prepare(`SELECT fr.*, u.nickname AS to_name, u.avatar AS to_avatar, u.is_bot AS to_bot
              FROM friend_requests fr JOIN users u ON u.id = fr.to_id
              WHERE fr.from_id = ? ORDER BY fr.id DESC`)
    .all(req.user.id)
    .map((r) => ({
      id: String(r.id), toId: r.to_id, toName: r.to_name,
      toAvatar: r.to_avatar, message: r.message, status: r.status,
      createdAt: r.created_at, isToBot: !!r.to_bot,
    }));
  return res.json({ incoming, outgoing });
});

app.post('/api/friend-requests', authRequired, (req, res) => {
  const { toUserId, message } = req.body || {};
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(toUserId);
  if (!target) return res.status(404).json({ error: '目标用户不存在' });
  if (target.id === req.user.id) return res.status(400).json({ error: '不能对自己发起申请' });

  const already = db
    .prepare("SELECT * FROM friend_requests WHERE from_id = ? AND to_id = ? AND status = 'pending'")
    .get(req.user.id, target.id);
  if (already) return res.status(400).json({ error: '已发出过申请，等待对方回应' });
  const isFriend = db.prepare('SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?').get(req.user.id, target.id);
  if (isFriend) return res.status(400).json({ error: '你们已经是信友' });

  const info = db
    .prepare('INSERT INTO friend_requests (from_id, to_id, message) VALUES (?, ?, ?)')
    .run(req.user.id, target.id, message || '希望能和你成为信友');
  const reqId = info.lastInsertRowid;

  // 目标为 bot：约 4 秒后自动同意
  if (target.is_bot) {
    setTimeout(() => {
      db.prepare("UPDATE friend_requests SET status = 'accepted' WHERE id = ?").run(reqId);
      addFriendPair(req.user.id, target.id);
    }, 4000);
  }
  return res.json({ ok: true, requestId: reqId, autoAccept: !!target.is_bot });
});

app.post('/api/friend-requests/:id/accept', authRequired, (req, res) => {
  const fr = db.prepare('SELECT * FROM friend_requests WHERE id = ? AND to_id = ?').get(req.params.id, req.user.id);
  if (!fr) return res.status(404).json({ error: '申请不存在' });
  db.prepare("UPDATE friend_requests SET status = 'accepted' WHERE id = ?").run(fr.id);
  addFriendPair(fr.from_id, fr.to_id);
  return res.json({ ok: true });
});

app.post('/api/friend-requests/:id/decline', authRequired, (req, res) => {
  const fr = db.prepare('SELECT * FROM friend_requests WHERE id = ? AND to_id = ?').get(req.params.id, req.user.id);
  if (!fr) return res.status(404).json({ error: '申请不存在' });
  db.prepare("UPDATE friend_requests SET status = 'declined' WHERE id = ?").run(fr.id);
  return res.json({ ok: true });
});

function addFriendPair(a, b) {
  const insert = db.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)');
  insert.run(a, b);
  insert.run(b, a);
}

// ============ 消息 ============
app.get('/api/messages/:friendId', authRequired, (req, res) => {
  const { friendId } = req.params;
  const rows = db
    .prepare(`SELECT * FROM messages WHERE
              (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?) ORDER BY id`)
    .all(req.user.id, friendId, friendId, req.user.id)
    .map((m) => ({
      id: String(m.id), fromId: m.from_id, toId: m.to_id,
      content: m.content, createdAt: m.created_at,
      mine: m.from_id === req.user.id,
    }));
  return res.json({ messages: rows });
});

app.post('/api/messages', authRequired, (req, res) => {
  const { toUserId, content } = req.body || {};
  if (!content || !content.trim()) return res.status(400).json({ error: '消息内容不能为空' });
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(toUserId);
  if (!target) return res.status(404).json({ error: '对方不存在' });

  db
    .prepare('INSERT INTO messages (from_id, to_id, content) VALUES (?, ?, ?)')
    .run(req.user.id, target.id, content.trim());

  // bot 自动回复
  if (target.is_bot) {
    setTimeout(() => {
      const replies = [
        '谢谢你愿意跟我分享这些，抱抱你。',
        '我在听，你慢慢说，我一直都在。',
        '能被你信任，我很开心。无论发生什么，都会好起来的。',
        '你的感受很重要，别一个人扛着，还有我呢。',
      ];
      const reply = replies[Math.floor(Math.random() * replies.length)];
      db.prepare('INSERT INTO messages (from_id, to_id, content) VALUES (?, ?, ?)').run(target.id, req.user.id, reply);
    }, 1800);
  }
  return res.json({ ok: true });
});

// ============ 邮票 ============
app.get('/api/stamps', authRequired, (req, res) => {
  const rows = db.prepare('SELECT stamp_id FROM stamps WHERE user_id = ?').all(req.user.id);
  const ids = new Set(rows.map((r) => r.stamp_id));
  return res.json({ collected: Array.from(ids) });
});

function unlockStamp(userId, action) {
  const unlockTypes = ACTION_UNLOCK_MAP[action] || [];
  const newly = [];
  // 行为计数
  const counts = getActionCounts(userId);

  STAMP_DEFS.forEach((def) => {
    if (!unlockTypes.includes(def.unlockType) && def.unlockType !== 'all_stamps') return;
    let progress = 0;
    if (def.unlockType === 'first_visit' || def.unlockType === 'login') progress = 1;
    else progress = counts[def.unlockType] || 0;

    if (def.unlockType === 'all_stamps') {
      const owned = db.prepare('SELECT COUNT(*) c FROM stamps WHERE user_id = ?').get(userId).c;
      if (owned >= def.target) progress = def.target;
    }
    if (progress >= def.target) {
      const exists = db.prepare('SELECT 1 FROM stamps WHERE user_id = ? AND stamp_id = ?').get(userId, def.id);
      if (!exists) {
        db.prepare('INSERT INTO stamps (user_id, stamp_id) VALUES (?, ?)').run(userId, def.id);
        newly.push(def.id);
      }
    }
  });
  return newly;
}

function getCounter(userId, key) {
  const row = db.prepare('SELECT counter_value v FROM user_counters WHERE user_id = ? AND counter_key = ?').get(userId, key);
  return row ? row.v : 0;
}

function incrementCounter(userId, key, by = 1) {
  db.prepare(
    `INSERT INTO user_counters (user_id, counter_key, counter_value) VALUES (?, ?, ?)
     ON CONFLICT(user_id, counter_key) DO UPDATE SET counter_value = counter_value + ?`
  ).run(userId, key, by, by);
  return getCounter(userId, key);
}

function getActionCounts(userId) {
  const letters = db.prepare('SELECT COUNT(*) c FROM letters WHERE sender_id = ?').get(userId).c;
  const replies = db.prepare(`SELECT COUNT(*) c FROM letter_replies WHERE author_id = ?`).get(userId).c;
  const psych = db.prepare('SELECT COUNT(*) c FROM psych_results WHERE user_id = ?').get(userId).c;
  const trash = db.prepare("SELECT COUNT(*) c FROM mood_records WHERE user_id = ? AND kind = 'trash'").get(userId).c;
  const posts = db.prepare('SELECT COUNT(*) c FROM posts WHERE author_id = ?').get(userId).c;
  const consult = db.prepare('SELECT COUNT(*) c FROM appointments WHERE user_id = ?').get(userId).c;
  const music = getCounter(userId, 'music');
  const sleep = getCounter(userId, 'sleep');
  const streak = getCounter(userId, 'streak');
  return {
    first_letter: letters, letters_3: letters, letters_5: letters, letters_10: letters,
    first_reply: replies, replies_3: replies, replies_5: replies,
    psych_test: psych, psych_3: psych,
    mood_trash: trash, trash_3: trash,
    community_post: posts, community_3: posts, community_5: posts,
    consult_book: consult,
    music_5: music, music_10: music,
    sleep_3: sleep, sleep_7: sleep,
    streak_3: streak, streak_7: streak,
  };
}

// 通用行为上报（音乐、助眠、连续天数等）
app.post('/api/action', authRequired, (req, res) => {
  const { action } = req.body || {};
  if (!ACTION_UNLOCK_MAP[action]) return res.status(400).json({ error: '未知行为' });
  // 累加对应计数器
  if (action === 'music') incrementCounter(req.user.id, 'music');
  if (action === 'sleep') incrementCounter(req.user.id, 'sleep');
  if (action === 'streak') incrementCounter(req.user.id, 'streak');
  const newly = unlockStamp(req.user.id, action);
  return res.json({ newly });
});

// ============ 情绪记录 / 心理结果（情绪周报） ============
app.post('/api/mood', authRequired, (req, res) => {
  const { content, mood, kind } = req.body || {};
  db.prepare('INSERT INTO mood_records (user_id, kind, content, mood) VALUES (?, ?, ?, ?)')
    .run(req.user.id, kind || 'trash', content || '', mood || '');
  if ((kind || 'trash') === 'trash') unlockStamp(req.user.id, 'mood_trash');
  return res.json({ ok: true });
});

app.post('/api/psych-results', authRequired, (req, res) => {
  const { testId, testName, score, result } = req.body || {};
  db.prepare('INSERT INTO psych_results (user_id, test_id, test_name, score, result) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, testId, testName, score, result);
  unlockStamp(req.user.id, 'psych_test');
  return res.json({ ok: true });
});

// 情绪周报：近 7 天垃圾桶 + 心理结果
app.get('/api/mood/weekly', authRequired, (req, res) => {
  const moodRows = db
    .prepare(`SELECT mood, content, created_at FROM mood_records
              WHERE user_id = ? AND created_at >= datetime('now','localtime','-7 days') ORDER BY id DESC`)
    .all(req.user.id);
  const psychRows = db
    .prepare(`SELECT test_name, score, result, created_at FROM psych_results
              WHERE user_id = ? AND created_at >= datetime('now','localtime','-30 days') ORDER BY id DESC`)
    .all(req.user.id);
  return res.json({ moods: moodRows, psych: psychRows });
});

// ============ 预约 ============
app.post('/api/appointments', authRequired, (req, res) => {
  const { counselorId, counselorName, method, date, period } = req.body || {};
  db.prepare('INSERT INTO appointments (user_id, counselor_id, counselor_name, method, date, period) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.user.id, counselorId, counselorName, method, date, period);
  unlockStamp(req.user.id, 'consult_book');
  return res.json({ ok: true });
});

app.get('/api/appointments', authRequired, (req, res) => {
  const rows = db.prepare('SELECT * FROM appointments WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  return res.json({ appointments: rows });
});

// ============ 健康检查 ============
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`心事信箱后端运行于 http://0.0.0.0:${PORT}`);
});
