// Bản macOS/Linux của ai-server.ps1 — cùng hợp đồng: phục vụ file tĩnh,
// GET /api/health, POST /api/generate -> claude -p.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  createAuth, hashPassword, parseCookies, clientIp, isHttps, buildCookie,
} from './auth.mjs';

// Tiện ích sinh chuỗi băm để đặt vào AUTH_PASS_HASH:
//   node ai-server.mjs --hash 'mat-khau-moi'
if (process.argv[2] === '--hash') {
  const plain = process.argv[3];
  if (!plain) {
    console.error('Dùng: node ai-server.mjs --hash "mat-khau"');
    process.exit(1);
  }
  console.log(hashPassword(plain));
  process.exit(0);
}

const root = process.env.APP_ROOT || process.cwd();
const port = Number(process.env.PORT || 8787);
// Mặc định chỉ nghe loopback — chạy trên máy cá nhân thì không lộ ra mạng LAN.
// Trong container phải đặt 0.0.0.0: Docker chuyển tiếp gói qua cầu nối chứ
// không qua loopback của container, nghe 127.0.0.1 là bên ngoài không vào được.
// An toàn vẫn giữ nguyên vì compose chỉ publish ra 127.0.0.1 của máy chủ.
const bindAddr = process.env.BIND_ADDR || '127.0.0.1';
const maxBudgetUsd = 2.5;
const timeoutMs = 240000;

const aiCwd = path.join(root, '.ai-cwd');
fs.mkdirSync(aiCwd, { recursive: true });

const claudeBin = process.env.CLAUDE_BIN || 'claude';

// Chỉ kiểm tra có tìm thấy claude không — không gọi thật, vì /api/health bị
// gọi mỗi lần mở trang. "Tìm thấy" chưa chắc là "đã đăng nhập": nếu phiên hết
// hạn thì /api/generate sẽ trả lỗi và app tự rơi về bản dựng cục bộ.
let claudeFound = null;
function claudeAvailable() {
  if (claudeFound !== null) return claudeFound;
  if (claudeBin.includes('/')) {
    claudeFound = fs.existsSync(claudeBin);
  } else {
    claudeFound = (process.env.PATH || '').split(path.delimiter)
      .some((dir) => dir && fs.existsSync(path.join(dir, claudeBin)));
  }
  return claudeFound;
}

/*
  Tài khoản đến từ hai nguồn, gộp lại thành một danh sách:

  AUTH_USER + AUTH_PASS_HASH — tài khoản chung của cả trường.
  AUTH_USERS                 — các tài khoản riêng, dạng "tên:hash" ngăn cách
                               bằng dấu phẩy. Email không chứa dấu phẩy và
                               chuỗi băm scrypt cũng vậy, nên tách kiểu này
                               không nhập nhằng.

  Không cấu hình tài khoản nào thì app vẫn chạy nhưng KHÔNG chặn gì — chỉ chấp
  nhận khi nghịch ở máy cá nhân. Trên VPS luôn có biến môi trường trong
  docker-compose.yml, và log cảnh báo bên dưới sẽ hiện rõ nếu quên.
*/
function parseAccountList(raw) {
  return String(raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const sep = entry.indexOf(':');
      if (sep < 1) return null;
      return { user: entry.slice(0, sep).trim(), passHash: entry.slice(sep + 1).trim() };
    })
    .filter(Boolean);
}

let auth = null;
const accounts = [];
if (process.env.AUTH_USER && process.env.AUTH_PASS_HASH) {
  accounts.push({ user: process.env.AUTH_USER, passHash: process.env.AUTH_PASS_HASH });
}
accounts.push(...parseAccountList(process.env.AUTH_USERS));
if (accounts.length) {
  auth = createAuth({ accounts, secret: process.env.SESSION_SECRET || '' });
  console.log(`[auth] ${accounts.length} tai khoan: ${accounts.map((a) => a.user).join(', ')}`);
} else {
  console.warn('[auth] CHUA DAT AUTH_USER/AUTH_PASS_HASH — moi nguoi deu goi duoc /api/generate.');
}

/*
  Thông tin phiên bản để đối chiếu localhost với production sau mỗi lần deploy.

  version  — số semver trong version.json, deploy-vps.sh tự tăng số cuối.
  buildId  — mã commit git, nướng vào image lúc build (ARG BUILD_ID). Chạy ở
             máy cá nhân thì đọc thẳng từ .git, không có thì ghi 'dev'.

  Cần cả hai: chỉ có semver mà quên tăng là hai bên trùng số và việc so sánh
  thành vô nghĩa; buildId đổi theo từng commit nên không nói dối được.
*/
const appVersion = (() => {
  let version = '0.0.0';
  try {
    version = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8')).version;
  } catch { /* thiếu file thì để 0.0.0, không đáng làm sập app */ }

  let buildId = process.env.BUILD_ID || '';
  if (!buildId) {
    try {
      const head = fs.readFileSync(path.join(root, '.git', 'HEAD'), 'utf8').trim();
      const ref = head.startsWith('ref: ') ? head.slice(5) : null;
      buildId = ref
        ? fs.readFileSync(path.join(root, '.git', ref), 'utf8').trim().slice(0, 7)
        : head.slice(0, 7);
    } catch { buildId = 'dev'; }
  }
  return { version, buildId, builtAt: process.env.BUILT_AT || '' };
})();

// Tên đăng nhập của phiên hiện tại, hoặc null. Không bật xác thực thì trả ''
// — vẫn "đã đăng nhập" nhưng không có danh tính để hiện lên giao diện.
function currentUser(req) {
  if (!auth) return '';
  return auth.tokenUser(parseCookies(req.headers.cookie)[auth.cookieName]);
}

function loggedIn(req) {
  return currentUser(req) !== null;
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJson(res, obj, status = 200) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
  });
  res.end(body);
}

function invokeClaude(prompt, schemaJson) {
  return new Promise((resolve) => {
    const args = [
      '-p', '--output-format', 'json', '--no-session-persistence',
      '--disable-slash-commands', '--strict-mcp-config', '--tools', '',
      '--model', 'sonnet', '--max-budget-usd', String(maxBudgetUsd),
    ];
    if (schemaJson) args.push('--json-schema', schemaJson);

    let proc;
    try {
      proc = spawn(claudeBin, args, { cwd: aiCwd, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      return resolve({ ok: false, error: 'Không chạy được claude: ' + e.message });
    }

    let out = '', err = '', done = false;
    const finish = (r) => { if (!done) { done = true; clearTimeout(timer); resolve(r); } };
    const timer = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch {}
      finish({ ok: false, error: `Hết thời gian chờ AI (quá ${Math.round(timeoutMs / 1000)} giây).` });
    }, timeoutMs);

    proc.stdout.setEncoding('utf8');
    proc.stderr.setEncoding('utf8');
    proc.stdout.on('data', (d) => { out += d; });
    proc.stderr.on('data', (d) => { err += d; });
    proc.on('error', (e) => finish({ ok: false, error: 'Không chạy được claude: ' + e.message }));
    proc.on('close', (code) => {
      if (code !== 0) {
        return finish({ ok: false, error: `claude thoát với mã ${code}: ${(err + ' ' + out).trim().slice(0, 400)}` });
      }
      let parsed;
      try { parsed = JSON.parse(out); }
      catch { return finish({ ok: false, error: 'Không đọc được kết quả từ claude.' }); }
      if (parsed.is_error) return finish({ ok: false, error: 'claude báo lỗi: ' + parsed.result });
      finish({ ok: true, text: parsed.result, costUsd: parsed.total_cost_usd });
    });

    proc.stdin.end(Buffer.from(prompt, 'utf8'));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);

  // Không đòi đăng nhập: chính app chưa đăng nhập cũng cần vẽ nhãn phiên bản,
  // và curl thẳng endpoint này là cách nhanh nhất để đối chiếu hai môi trường.
  if (req.method === 'GET' && pathname === '/api/version') {
    res.setHeader('Cache-Control', 'no-store');
    return sendJson(res, appVersion);
  }

  if (req.method === 'GET' && pathname === '/api/health') {
    const ok = claudeAvailable();
    return sendJson(res, { ok, claude: ok });
  }

  // App hỏi cái này lúc khởi động để biết nên hiện màn hình đăng nhập hay vào
  // thẳng trang chủ.
  if (req.method === 'GET' && pathname === '/api/session') {
    const user = currentUser(req);
    return sendJson(res, { loggedIn: user !== null, user: user || '' });
  }

  if (req.method === 'POST' && pathname === '/api/login') {
    if (!auth) return sendJson(res, { ok: true, user: '' });
    const ip = clientIp(req);
    if (auth.tooManyFails(ip)) {
      return sendJson(res, { ok: false, error: 'Sai quá nhiều lần. Chờ một phút rồi thử lại.' }, 429);
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { body = null; }

    const username = body ? String(body.username || '') : '';
    const okCreds = body && auth.checkCredentials(username, String(body.password || ''));
    if (!okCreds) {
      auth.noteFail(ip);
      // Thông báo chung chung: nói rõ "sai mật khẩu" là xác nhận tên đăng nhập
      // đó có tồn tại, giúp người dò thu hẹp phạm vi.
      return sendJson(res, { ok: false, error: 'Sai tên đăng nhập hoặc mật khẩu.' }, 401);
    }

    auth.clearFails(ip);
    res.setHeader('Set-Cookie', buildCookie(auth.cookieName, auth.issueToken(username), {
      maxAgeSec: auth.sessionDays * 86400,
      secure: isHttps(req),
    }));
    return sendJson(res, { ok: true, user: username });
  }

  if (req.method === 'POST' && pathname === '/api/logout') {
    if (auth) {
      res.setHeader('Set-Cookie', buildCookie(auth.cookieName, '', {
        maxAgeSec: 0, secure: isHttps(req),
      }));
    }
    return sendJson(res, { ok: true });
  }

  if (req.method === 'POST' && pathname === '/api/generate') {
    // Chốt chặn thật. Form đăng nhập ở frontend chỉ là giao diện — ai cũng gọi
    // thẳng endpoint này được nếu không kiểm tra ở đây.
    if (!loggedIn(req)) {
      return sendJson(res, { ok: false, error: 'Chưa đăng nhập.' }, 401);
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { return sendJson(res, { ok: false, error: 'Yêu cầu không phải JSON hợp lệ.' }, 400); }
    if (!body || !body.prompt) return sendJson(res, { ok: false, error: 'Thiếu "prompt".' }, 400);

    const schemaJson = body.schema ? JSON.stringify(body.schema) : null;
    const stamp = () => new Date().toTimeString().slice(0, 8);
    console.log(`[${stamp()}] dang goi AI...`);
    const result = await invokeClaude(body.prompt, schemaJson);
    console.log(result.ok
      ? `[${stamp()}] xong, chi phi ~$${result.costUsd}`
      : `[${stamp()}] loi: ${result.error}`);
    return sendJson(res, result);
  }

  // File tĩnh.
  const rel = pathname.replace(/^\/+/, '') || 'index.html';
  const full = path.resolve(root, rel);
  if (!full.startsWith(path.resolve(root)) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('404: ' + rel);
  }
  const buf = fs.readFileSync(full);
  res.writeHead(200, {
    'Content-Type': mime[path.extname(full).toLowerCase()] || 'application/octet-stream',
    'Content-Length': buf.length,
  });
  res.end(buf);
});

server.listen(port, bindAddr, () => {
  console.log(`APP Tao Giao An dang chay tai http://${bindAddr}:${port}/`);
});
