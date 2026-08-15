// Xác thực cho APP Tạo Giáo Án — một tài khoản chung cho cả trường, cộng thêm
// các tài khoản riêng khi cần.
//
// Tách khỏi ai-server.mjs để phần này đọc được độc lập: mật khẩu băm thế nào,
// cookie ký ra sao, chặn dò mật khẩu ở đâu — tất cả nằm gọn một chỗ.
//
// Xem docs/superpowers/specs/2026-08-08-dang-nhap-that-design.md.
import crypto from 'node:crypto';

const COOKIE_NAME = 'giaoan_session';
const SESSION_DAYS = 30;
const LOGIN_WINDOW_MS = 60_000;
const LOGIN_MAX_FAILS = 5;

/* ── Mật khẩu ──────────────────────────────────────────────────────────── */

// scrypt chứ không phải SHA đơn thuần: SHA nhanh nên dò bằng GPU rất rẻ,
// scrypt cố tình tốn bộ nhớ và thời gian nên đắt hơn nhiều bậc.
export function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(plain, salt, 32);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export function verifyPassword(plain, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  let salt, expected;
  try {
    salt = Buffer.from(parts[1], 'hex');
    expected = Buffer.from(parts[2], 'hex');
  } catch {
    return false;
  }
  if (expected.length !== 32) return false;
  const actual = crypto.scryptSync(plain, salt, 32);
  // So sánh hằng thời gian: so bằng === sẽ dừng ở byte lệch đầu tiên, và thời
  // gian phản hồi hé lộ mật khẩu đúng được bao nhiêu ký tự.
  return crypto.timingSafeEqual(actual, expected);
}

/* ── Cookie phiên ──────────────────────────────────────────────────────── */

/*
  Cookie tự chứng thực: "<tên đăng nhập>.<hạn dùng>.<chữ ký HMAC của hai phần
  trước>". Không có bảng phiên trong RAM, nên dựng lại container không đá ai ra
  ngoài — quan trọng vì app này deploy khá thường xuyên.

  Tên đăng nhập mã hoá base64url chứ không để thô: bảng chữ cái base64url không
  có dấu chấm, nên tách ba phần bằng dấu chấm luôn đúng kể cả khi tên đăng nhập
  là email (gmail.com có dấu chấm).
*/
export function createAuth({ accounts, secret }) {
  const list = (accounts || []).filter((a) => a && a.user && a.passHash);
  if (!list.length) {
    throw new Error('Thiếu tài khoản đăng nhập.');
  }
  // Không đặt SESSION_SECRET thì dẫn xuất từ các chuỗi băm mật khẩu: ổn định
  // qua các lần khởi động lại, và đổi mật khẩu là mọi phiên cũ mất hiệu lực
  // luôn. Sắp xếp trước khi ghép để thứ tự khai báo tài khoản không đổi khoá.
  const key = secret
    ? Buffer.from(secret, 'utf8')
    : crypto.createHash('sha256')
        .update('giaoan-session:' + list.map((a) => a.passHash).sort().join('|'))
        .digest();

  const sign = (value) =>
    crypto.createHmac('sha256', key).update(String(value)).digest('hex');

  function issueToken(user) {
    const exp = Date.now() + SESSION_DAYS * 86400_000;
    const name = Buffer.from(String(user), 'utf8').toString('base64url');
    return `${name}.${exp}.${sign(name + '.' + exp)}`;
  }

  // Trả về tên đăng nhập nếu vé còn hiệu lực, null nếu không.
  function tokenUser(token) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const [name, exp, sig] = parts;
    if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return null;
    const want = Buffer.from(sign(name + '.' + exp), 'utf8');
    const got = Buffer.from(sig, 'utf8');
    if (want.length !== got.length) return null;
    if (!crypto.timingSafeEqual(want, got)) return null;
    const user = Buffer.from(name, 'base64url').toString('utf8');
    // Tài khoản đã bị gỡ khỏi cấu hình thì vé cũ cũng phải hết giá trị, dù chữ
    // ký vẫn khớp.
    return list.some((a) => a.user === user) ? user : null;
  }

  /* ── Chặn dò mật khẩu ────────────────────────────────────────────────── */

  // Chỉ đếm lần SAI. Đếm cả lần đúng thì cả trường cùng đăng nhập buổi sáng
  // qua một đường mạng chung sẽ bị chặn oan.
  const fails = new Map();

  function tooManyFails(ip) {
    const rec = fails.get(ip);
    if (!rec || Date.now() > rec.resetAt) return false;
    return rec.count >= LOGIN_MAX_FAILS;
  }

  function noteFail(ip) {
    const now = Date.now();
    const rec = fails.get(ip);
    if (!rec || now > rec.resetAt) {
      fails.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    } else {
      rec.count += 1;
    }
    // Dọn bản ghi hết hạn để Map không phình vô hạn khi bị quét liên tục.
    if (fails.size > 1000) {
      for (const [k, v] of fails) if (now > v.resetAt) fails.delete(k);
    }
  }

  function clearFails(ip) { fails.delete(ip); }

  function checkCredentials(u, p) {
    const acc = list.find((a) => a.user === u);
    // Tên đăng nhập không có thật vẫn chạy verifyPassword một lần: bỏ qua luôn
    // thì trả lời nhanh hơn hẳn, và chênh lệch đó đủ để người dò biết tên nào
    // tồn tại — đúng thứ thông báo lỗi chung chung ở /api/login đang giấu.
    if (!acc) {
      verifyPassword(p, list[0].passHash);
      return false;
    }
    return verifyPassword(p, acc.passHash);
  }

  return {
    cookieName: COOKIE_NAME,
    checkCredentials,
    issueToken,
    tokenUser,
    tooManyFails,
    noteFail,
    clearFails,
    sessionDays: SESSION_DAYS,
  };
}

/* ── Tiện ích HTTP ─────────────────────────────────────────────────────── */

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq < 1) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

// Đứng sau nginx nên req.socket.remoteAddress luôn là 127.0.0.1; IP thật nằm
// ở X-Forwarded-For, phần tử đầu tiên.
export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

export function isHttps(req) {
  return String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

export function buildCookie(name, value, { maxAgeSec, secure }) {
  const bits = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ];
  // Chỉ gắn Secure khi thật sự đi qua HTTPS. Gắn lúc chạy HTTP ở máy cá nhân
  // là trình duyệt bỏ cookie và không ai đăng nhập được.
  if (secure) bits.push('Secure');
  return bits.join('; ');
}
