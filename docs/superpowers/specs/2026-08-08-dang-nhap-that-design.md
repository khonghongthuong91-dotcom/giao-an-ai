# Đăng nhập thật ở form frontend, bỏ nginx basic auth

Ngày 08/08/2026.

## Vấn đề

App đang được che bằng `auth_basic` của nginx: trình duyệt bật hộp thoại popup
trước khi vào. Xấu, và không liên quan gì tới form đăng nhập đã có sẵn trong
app — form đó hiện chỉ là minh hoạ, gõ gì cũng vào (`js/app.js:1402` chỉ kiểm
tra hai ô không rỗng).

Tệ hơn: `js/app.js:20` đọc `?screen=` từ URL, nên gõ thẳng
`?screen=dashboard` là bỏ qua luôn màn hình đăng nhập. Xác thực chỉ ở
frontend không có giá trị; phải đặt ở máy chủ.

## Quyết định

- **Một tài khoản chung** cho cả trường, đọc từ biến môi trường.
- **Chặn ở tầng API**, không phải tầng file. Chưa đăng nhập vẫn tải được
  HTML/CSS/JS (để hiện form), nhưng mọi `/api/*` trả 401.

Đánh đổi đã cân nhắc và chấp nhận: người lạ tải được `js/data.js`, trong đó có
tên trường, tên giáo viên mẫu và 6 giáo án mẫu. Đây là dữ liệu minh hoạ, không
phải dữ liệu thật của trẻ.

## Máy chủ — `ai-server.mjs`

| Endpoint | Việc | Cần phiên? |
|---|---|---|
| `POST /api/login` | So khớp, đặt cookie phiên | không |
| `POST /api/logout` | Xoá cookie | không |
| `GET /api/session` | Trả `{loggedIn}` | không |
| `GET /api/health` | Trạng thái AI | không (không lộ gì) |
| `POST /api/generate` | Gọi model | **có** |

### Mật khẩu

Lưu dạng băm `scrypt$<salt>$<key>` trong biến `AUTH_PASS_HASH`, không để thô.
Sinh chuỗi băm bằng:

    node ai-server.mjs --hash 'mat-khau-moi'

So khớp bằng `timingSafeEqual` để không lộ thông tin qua thời gian phản hồi.

### Cookie phiên

Chữ ký HMAC, **không lưu phiên trong bộ nhớ**. Nội dung: `<hạn dùng>.<chữ ký>`.

Lý do không dùng Map trong RAM: mỗi lần `docker compose up --build` là toàn bộ
giáo viên bị đăng xuất, mà việc deploy diễn ra thường xuyên.

Khoá ký lấy từ `SESSION_SECRET`; không đặt thì dẫn xuất từ `AUTH_PASS_HASH` —
vẫn ổn định qua các lần khởi động lại, và đổi mật khẩu thì mọi phiên cũ tự mất
hiệu lực (đúng mong muốn).

Thuộc tính cookie: `httpOnly` (JS không đọc được, chống XSS lấy phiên),
`SameSite=Lax`, `Path=/`, và `Secure` **chỉ khi** request đến qua HTTPS — đặt
`Secure` khi chạy HTTP ở máy cá nhân sẽ làm cookie bị trình duyệt bỏ.

Hạn dùng 30 ngày.

### Chống dò mật khẩu

Cả trường dùng chung một mật khẩu nên lộ là lộ hết. Giới hạn **5 lần đăng nhập
sai mỗi phút cho mỗi IP**, đếm trong bộ nhớ. Vượt ngưỡng trả 429.

Chỉ đếm lần SAI — đăng nhập đúng không tính, để cả trường cùng vào buổi sáng
không bị chặn nhầm.

## Frontend — `js/app.js`

- `ACTIONS.login` gọi `POST /api/login`; sai thì hiện lỗi ở `state.loginError`
  (đã có sẵn chỗ hiển thị).
- `ACTIONS.logout` gọi `POST /api/logout`.
- Lúc khởi động gọi `GET /api/session`; chưa đăng nhập thì ép `state.view`
  về `'login'`, **bỏ qua `?screen=`** — bịt lỗ đi tắt.
- Phiên hết hạn giữa chừng: `/api/generate` trả 401 → đá về màn hình đăng nhập
  thay vì báo lỗi khó hiểu.

## nginx

Gỡ hai dòng `auth_basic` khỏi `nginx-giaoan.conf.template` và
`nginx-giaoan-ip.conf`. Giữ nguyên `limit_req` cho `/api/generate`.

Xoá `/etc/nginx/.htpasswd-giaoan` sau khi xác nhận đăng nhập mới chạy được.

## Kiểm thử

1. Chưa đăng nhập → `GET /api/session` trả `{loggedIn:false}`.
2. Chưa đăng nhập → `POST /api/generate` trả 401, **không** gọi model.
3. `?screen=dashboard` khi chưa đăng nhập → vẫn ra màn hình đăng nhập.
4. Sai mật khẩu → 401, thông báo chung chung (không nói sai user hay sai pass).
5. Sai 6 lần liên tiếp → lần thứ 6 trả 429.
6. Đúng mật khẩu → có cookie, vào được dashboard, `/api/generate` chạy thật.
7. Dựng lại container → vẫn còn đăng nhập (cookie HMAC sống sót).
8. Bấm Đăng xuất → cookie mất, `/api/generate` trả 401 trở lại.
