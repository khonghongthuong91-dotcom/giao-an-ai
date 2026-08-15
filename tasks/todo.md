# Thêm tài khoản đăng nhập vvt7193@gmail.com

App chỉ có một tài khoản chung (`giaoan`). Cần thêm tài khoản riêng cho
`vvt7193@gmail.com` mà không xoá tài khoản cũ → phải cho phép nhiều tài khoản.

## Việc cần làm

- [x] `auth.mjs`: `createAuth` nhận mảng `accounts` thay vì một `{user, passHash}`
- [x] `auth.mjs`: `checkCredentials` vẫn chạy `verifyPassword` khi tên đăng nhập
      không tồn tại, để thời gian phản hồi không tiết lộ tên nào có thật
- [x] `ai-server.mjs`: đọc thêm `AUTH_USERS` dạng `tên:hash,tên:hash`
- [x] `docker-compose.yml`: khai báo `AUTH_USERS`
- [x] Sinh mật khẩu + hash cho tài khoản mới
- [x] Kiểm thử cục bộ
- [x] Thêm `AUTH_USERS` vào `~/giaoan-ai/.env` trên VPS (sao lưu ở
      `~/giaoan-ai-env.bak`)
- [x] Deploy + kiểm chứng qua HTTPS thật

## Kết quả

**Kiểm thử cục bộ (cổng 8790, hai tài khoản):**

| Trường hợp | Kỳ vọng | Thực tế |
|---|---|---|
| `giaoan` + mật khẩu đúng | 200 | 200 |
| `vvt7193@gmail.com` + mật khẩu đúng | 200 | 200 |
| `vvt7193@gmail.com` + mật khẩu của tài khoản kia | 401 | 401 |
| Tên đăng nhập không tồn tại | 401 | 401 |
| `/api/generate` không cookie | 401 | 401 |
| `/api/generate` có cookie | qua được auth | 400 (thiếu prompt) |
| Sai mật khẩu 6 lần liên tiếp | 429 | 429 |

**Trên VPS (phiên bản 1.1.5, qua nginx + HTTPS, `--resolve` để bỏ qua Cloudflare):**

- Log container: `[auth] 2 tai khoan: giaoan, vvt7193@gmail.com`
- `vvt7193@gmail.com` + mật khẩu đúng → 200 kèm `Set-Cookie: giaoan_session`
- `vvt7193@gmail.com` + mật khẩu sai → 401

Chưa kiểm thử được mật khẩu của tài khoản `giaoan` vì không biết mật khẩu thô;
biến `AUTH_USER`/`AUTH_PASS_HASH` không bị đụng tới và log xác nhận tài khoản
vẫn được nạp.

## Việc phát sinh sau đó

- [x] Đổi mật khẩu `vvt7193@gmail.com` theo yêu cầu: sinh hash mới, thay dòng
      `AUTH_USERS` trong `.env` trên VPS, `docker compose up -d`. Không đụng mã
      nguồn nên không cần build lại, phiên bản vẫn 1.1.5. Đã kiểm chứng: mật
      khẩu mới → 200, mật khẩu cũ → 401.

## Gỡ thông tin cá nhân khỏi giao diện (phiên bản 1.1.6)

Tên người thật bị ghi cứng trong mã nguồn nên hiện ra với mọi người dùng.

- [x] `auth.mjs`: vé phiên mang theo tên đăng nhập —
      `<base64url(tên)>.<hạn dùng>.<chữ ký>`. Mã base64url vì tên đăng nhập là
      email có dấu chấm, tách bằng dấu chấm sẽ sai. `tokenValid` đổi thành
      `tokenUser`, trả về tên đăng nhập hoặc null.
- [x] `ai-server.mjs`: `/api/session` và `/api/login` trả thêm `user`.
- [x] `js/data.js`: xoá khối `user` ghi cứng; `profileDefault` và
      `sampleLesson.info` để trống phần trường/giáo viên/lớp.
- [x] `js/app.js`: thanh bên hiện tài khoản đang đăng nhập thay cho tên ghi
      cứng; lời chào đổi thành "Chào cô!"; form wizard bỏ tên mẫu; ô "Tên đăng
      nhập" ở Hồ sơ cá nhân lấy từ phiên thật.
- [x] Sửa hai câu chú thích đã sai sau thay đổi: "Các trường đã điền sẵn từ hồ
      sơ giáo viên" và "Cả trường dùng chung một tài khoản".

**Kiểm chứng máy chủ (cổng 8791/8792):**

| Trường hợp | Kỳ vọng | Thực tế |
|---|---|---|
| `/api/login` trả `user` | có | `{"ok":true,"user":"vvt7193@gmail.com"}` |
| `/api/session` có cookie | đúng tên | `{"loggedIn":true,"user":"vvt7193@gmail.com"}` |
| `/api/session` không cookie | rỗng | `{"loggedIn":false,"user":""}` |
| Cookie bị sửa chữ ký | từ chối | `loggedIn:false` |
| Cookie định dạng cũ `exp.sig` | từ chối | `loggedIn:false` |
| Tài khoản bị gỡ khỏi cấu hình | vé cũ hết giá trị | `loggedIn:false` |

**Kiểm chứng giao diện:** chụp màn hình Chrome headless qua CDP (script tạm ở
scratchpad, không nằm trong repo) cho 4 màn — Trang chủ, Hồ sơ cá nhân, Tạo
giáo án, Trình soạn thảo. Không còn tên người thật, không có lỗi console.

**Trên VPS (1.1.6):** đăng nhập qua HTTPS trả đúng `user`; `js/data.js` và
`js/app.js` tải về không còn tên nào.

## Ghi chú

- Khoá ký cookie dẫn xuất từ toàn bộ danh sách hash → thêm/bớt tài khoản làm
  mọi phiên đang đăng nhập mất hiệu lực một lần. Người đang dùng chỉ cần đăng
  nhập lại bằng đúng mật khẩu cũ.
- Muốn thêm tài khoản nữa: `node ai-server.mjs --hash 'mật-khẩu'` rồi nối
  `,email:hash` vào dòng `AUTH_USERS` trong `~/giaoan-ai/.env` trên VPS và chạy
  `./deploy-vps.sh`.
- `ai-server.ps1` (bản Windows chạy máy cá nhân) không có phần đăng nhập nên
  không bị ảnh hưởng.
