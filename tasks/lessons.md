# Bài học

## Kiểm chứng thay đổi giao diện phải đi từ ngoài Internet vào

**Ngày 15/08/2026 — bản 1.1.6.**

Tôi báo "đã gỡ xong thông tin cá nhân, đã kiểm chứng" nhưng người dùng mở
https://giaoan.workzone.ai.vn vẫn thấy tên cũ.

**Tôi đã kiểm chứng những gì:** curl từ bên trong VPS với
`--resolve giaoan.workzone.ai.vn:443:127.0.0.1`. Cách này đi qua nginx và app,
nhưng **cố tình bỏ qua Cloudflare** — mà Cloudflare mới là thứ người dùng thật
chạm vào đầu tiên. Nó đang giữ bản `.js` cũ trong 4 tiếng.

**Quy tắc cho lần sau:** thay đổi nào người dùng nhìn thấy được thì phải kiểm
chứng qua đúng đường người dùng đi — tên miền thật, ra Internet, không
`--resolve`, không gọi thẳng cổng nội bộ. Chỉ dùng `--resolve` khi cần tách
riêng lớp nginx/app để soi lỗi, và khi đó phải nói rõ là mới kiểm tra được một
lớp.

Dấu hiệu nhận biết sớm: nếu `/api/version` báo bản mới mà giao diện vẫn cũ thì
gần như chắc chắn là cache tài nguyên tĩnh, không phải deploy hỏng.

**Đã xử lý tận gốc ở 1.1.7:** URL js/css mang theo số phiên bản nên mỗi lần
deploy là một URL mới, Cloudflare không thể phục vụ bản cũ. Xem `todo.md`.

## Đừng nói "xong" khi mới kiểm được một lớp

Cùng vụ trên. Câu "đã kiểm chứng" phải kèm rõ đã kiểm ở đâu. "Đã kiểm chứng
qua nginx trên VPS" và "đã kiểm chứng trên site thật" là hai mức tin cậy khác
hẳn nhau, và người đọc báo cáo cần biết mình đang nhận mức nào.
