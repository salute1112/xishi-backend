const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'say-worryfree-secret-2026';
const JWT_EXPIRES = '30d';

function signToken(user) {
  return jwt.sign(
    { id: user.id, nickname: user.nickname },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function parseToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id) || null;
  } catch {
    return null;
  }
}

// 可选鉴权：有 token 则挂 req.user，无 token 也放行
function authOptional(req, res, next) {
  req.user = parseToken(req);
  return next();
}

// 必须登录（自包含解析 token）
function authRequired(req, res, next) {
  req.user = parseToken(req);
  if (!req.user) {
    return res.status(401).json({ error: '请先登录', code: 'NOT_LOGGED_IN' });
  }
  return next();
}

module.exports = { signToken, authOptional, authRequired, JWT_SECRET };
