# APP Tạo Giáo Án

Bản hiện thực của thiết kế Claude Design `App Tạo Giáo Án.dc.html`
(project *APP tạo giáo án*, `d484c978-be1a-406f-87e9-9b79ab3a0940`).

App soạn giáo án mầm non: wizard 5 bước → giáo án đúng bố cục I – II – III với
bảng hai cột *Hoạt động của cô* / *Hoạt động của trẻ* → sửa trực tiếp → tải
Word hoặc chuyển thành PowerPoint.

## Chạy thử

Bấm đúp **`index.html`**. Không cần cài Node, không cần build, không cần chạy
server — app là HTML + CSS + JavaScript thuần.

Kết nối mạng chỉ dùng để tải font *Be Vietnam Pro* từ Google Fonts. Offline app
vẫn chạy bình thường, chỉ đổi sang font hệ thống.

Mở nhanh một màn hình bất kỳ:

| Màn hình | Đường dẫn |
| --- | --- |
| Đăng nhập | `index.html` |
| Trang chủ | `index.html?screen=dashboard` |
| Tạo giáo án (wizard) | `index.html?screen=wizard` |
| Trình soạn thảo | `index.html?screen=editor` |
| Giáo án của tôi | `index.html?screen=library` |
| Thư viện mẫu | `index.html?screen=templates` |
| Tải Word lên | `index.html?screen=upload` |
| Xem trước Word | `index.html?screen=word` |
| Xem trước PowerPoint | `index.html?screen=ppt` |
| Căn cứ và tham chiếu | `index.html?screen=refs` |
| Quản trị | `index.html?screen=admin` |

Hai công tắc mà bản thiết kế để ở khung *Prototype* thành tham số đường dẫn:
`?checks=0` ẩn khung *Cảnh báo kiểm tra*, `?notes=0` ẩn *Ghi chú cho cô* ở màn
hình PowerPoint.

## Cấu trúc

```
index.html          điểm vào, nạp lần lượt 7 file js
css/app.css         style của app, dịch từ inline style của bản thiết kế
js/data.js          nội dung: giáo án mẫu, danh mục lựa chọn, thư viện, văn bản pháp lý
js/compose.js       dựng giáo án, cảnh báo kiểm tra, slide, bản xem trước của AI
js/zip.js           đọc/ghi gói ZIP trong trình duyệt
js/docx.js          xuất .docx (OOXML)
js/pptx.js          xuất .pptx (OOXML)
js/docx-read.js     đọc .docx do giáo viên chọn
js/app.js           state, render 11 màn hình, xử lý sự kiện
ai-server.ps1        máy chủ AI cục bộ tùy chọn — gọi Claude Code CLI thật, xem "Chạy với AI thật"
chay-voi-ai.bat       bấm đúp để chạy ai-server.ps1
```

Tất cả đều là **script cổ điển, không phải ES module** — trình duyệt chặn
`import` trên `file://`, nên dùng module thì phải có server. Thứ tự nạp trong
`index.html` là bắt buộc.

## Phần nào là thật

Bản thiết kế là bản mẫu tương tác: nút *Tải giáo án Word* và *Tải file .pptx*
chỉ hiện thông báo, còn *Tải Word lên* chạy một thanh tiến trình đếm giả. Ở bản
này ba chỗ đó làm thật, chạy hết trong trình duyệt:

- **Xuất `.docx`** — `js/docx.js` dựng gói OOXML đúng thông số ghi ở khung
  *Định dạng Word*: A4 dọc, lề trên 2 / dưới 2 / trái 3 / phải 2 cm, Times New
  Roman cỡ 14, giãn dòng 1.15, bảng hoạt động hai cột có hàng tiêu đề lặp lại
  khi sang trang (`w:tblHeader`), số trang ở chân trang, khu vực ký tên.
- **Xuất `.pptx`** — `js/pptx.js` dựng bài trình chiếu 16:9 (960 × 540 pt), mỗi
  slide kèm ghi chú cho cô đặt vào phần *notes* của PowerPoint.
- **Đọc `.docx`** — `js/docx-read.js` giải nén file bằng `DecompressionStream`
  của trình duyệt, đọc `word/document.xml`, nhận ra mục I – II – III, phần
  thông tin đầu giáo án và bảng hoạt động hai cột. Bảng *Đoạn trong file Word /
  Ánh xạ thành / Độ tin cậy* là kết quả đọc thật, và cột *Ánh xạ thành* sửa
  được bằng thẻ chọn — đúng câu "Sửa lại nếu hệ thống ánh xạ chưa đúng" của bản
  thiết kế. Nút *Tóm tắt và tạo PowerPoint* chỉ bật khi không còn đoạn nào ở
  trạng thái *Chưa xác định*.

Ba file đã được kiểm chứng bằng cách mở thật trên máy này: Word mở `.docx`
không đòi sửa lỗi (3 bảng, đúng lề 56.7 / 85.05 pt = 2 / 3 cm, font Times New
Roman), PowerPoint mở `.pptx` đúng 11 slide khổ 960 × 540 pt và đọc được ghi
chú từng slide. Giáo án app xuất ra rồi nạp lại vào chính app thì khớp lại 13
trong 14 trường thông tin, 4 khối mục tiêu, 2 nhóm mục tiêu phân hóa, 7 mục
chuẩn bị và 6 hoạt động. Trường không khớp là *Hình thức tổ chức*: bảng thông
tin trong bản xem trước Word của bản thiết kế chỉ có 5 hàng và không chứa
trường này, nên file `.docx` cũng không có để đọc lại — trường vẫn hiện đầy đủ
ở trình soạn thảo.

Những chỗ khác cũng chạy thật: sửa trực tiếp mục I – II và bảng hoạt động, đổi
thứ tự / thêm / xóa hoạt động, lọc và tìm trong thư viện, ghim, thùng rác, công
tắc quản trị (tắt *Cho phép gọi AI* thì khóa luôn nút tạo giáo án và các việc
nhờ AI; tắt *Cho phép tải Word lên* thì khóa màn hình tải lên), lịch sử phiên
bản ghi theo giờ máy.

## Phần AI

`js/compose.js` thử ba đường theo thứ tự, không bao giờ ném lỗi ra ngoài:

1. **`window.claude.complete`** — chỉ có trong môi trường xem trước của Claude
   Design.
2. **Máy chủ AI cục bộ** (`ai-server.ps1`) — gọi **AI thật**, xem mục "Chạy với
   AI thật" ngay dưới đây.
3. **Bộ dựng cục bộ** — nếu không có cả hai đường trên, app tự ghép giáo án từ
   đúng những gì giáo viên chọn trong wizard: nhóm tuổi và lớp ghép, lĩnh vực,
   loại hoạt động, nội dung tích hợp, tên truyện / thơ / bài hát / trò chơi,
   học liệu, mức độ chi tiết, giọng văn. Đây **không phải mô hình ngôn ngữ**,
   nhưng ra giáo án thật theo bố cục I – II – III với 6 hoạt động, không phải
   chữ giả.

Giao diện nói rõ đang dùng đường nào: dòng nhãn ở đầu trình soạn thảo ghi *GIÁO
ÁN DO AI TẠO*, *APP DỰNG TỪ LỰA CHỌN CỦA CHỊ*, *ĐỌC TỪ FILE WORD* hoặc *GIÁO ÁN
MẪU*, và ghi chú cạnh nút tạo giáo án cũng nói trước điều đó.

Bảy việc ở khung *Nhờ AI chỉnh sửa* cũng đi qua cùng ba đường trên. Năm việc có
sửa nội dung thật (viết lại hoạt động trọng tâm, rút gọn còn 20 phút, bổ sung
trò chơi củng cố, chuyển sang 5–6 tuổi, tăng tính trải nghiệm) — bấm *Áp dụng
thay đổi* là giáo án đổi thật và ghi một mốc vào lịch sử phiên bản. Hai việc
còn lại (*Kiểm tra an toàn*, *Kiểm tra chính tả tiếng Việt*) chỉ rà soát, nên
hộp xem trước bỏ nút *Áp dụng thay đổi* và chỉ còn *Đóng bản rà soát* — khác
bản thiết kế một chút, vì để nút "áp dụng" cho một bản rà soát không có gì để
áp dụng thì dễ gây hiểu nhầm.

### Chạy với AI thật

`ai-server.ps1` gọi **Claude Code CLI** (`claude -p`) ngay trên máy, dùng đúng
phiên đăng nhập Claude Code đã có sẵn — không cần API key riêng, không cần
đăng nhập lại.

Điều kiện: máy đã cài Claude Code CLI và đã đăng nhập một lần (gõ `claude`
trong terminal một lần để đăng nhập, nếu chưa từng dùng).

Cách chạy:

1. Bấm đúp **`chay-voi-ai.bat`** (hoặc `powershell -ExecutionPolicy Bypass
   -File ai-server.ps1`). Cửa sổ terminal hiện dòng
   `... may chu AI cuc bo dang chay tai http://localhost:8787/`.
2. Mở **`http://localhost:8787/`** bằng trình duyệt — không bấm đúp
   `index.html` nữa, vì lúc đó app không có máy chủ đứng sau để gọi AI.
3. Dùng app bình thường. Nút *TẠO GIÁO ÁN BẰNG AI* và cả 7 việc ở khung *Nhờ
   AI chỉnh sửa* giờ gọi Claude thật.
4. Đóng cửa sổ terminal đó để tắt máy chủ.

Vài điều cần biết:

- **Chậm hơn mẫu demo**: một giáo án đầy đủ 6 hoạt động mất khoảng 1–2 phút để
  Claude soạn xong (đã đo thực tế: 60–125 giây), vì đây là gọi mô hình thật,
  không phải chữ dựng sẵn. Nút *ĐANG TẠO GIÁO ÁN...* bị khóa trong lúc chờ.
- **Có tính phí**: mỗi lần tạo giáo án hoặc nhờ AI chỉnh sửa dùng hạn mức
  Claude Code của tài khoản đang đăng nhập (đã đo thực tế: khoảng
  $0.05–$0.25 một lần gọi). `ai-server.ps1` giới hạn tối đa $2.5 một lần gọi
  (`--max-budget-usd`) để tránh vượt hạn mức nếu có gì bất thường.
- **An toàn**: tiến trình `claude` được gọi với `--tools ""` (tắt hết công cụ)
  nên chỉ có thể trả về chữ, không đọc/ghi file hay chạy lệnh trên máy — kể cả
  khi nội dung giáo viên gõ vào các trường tự do (yêu cầu riêng, tên hoạt
  động...) có cố tình chứa chỉ dẫn lạ.
- **Không mở port ra ngoài**: máy chủ chỉ nghe ở `localhost:8787`, máy khác
  trong mạng không gọi được.
- Không có Claude Code CLI, hoặc mở app bằng cách bấm đúp `index.html` như cũ
  → app tự động rơi về bộ dựng cục bộ, không báo lỗi.

## Khác với bản thiết kế

- **Cảnh báo kiểm tra** trong bản thiết kế là bảy dòng viết sẵn cho giáo án
  mẫu. Ở đây bảy dòng đó được tính từ chính giáo án đang mở: mục tiêu có dùng
  động từ khó quan sát không, hoạt động dài nhất bao nhiêu phút, có thời gian
  dùng màn hình không, cột hoạt động của trẻ có câu chung chung không, lớp ghép
  đã có mục tiêu phân hóa chưa, đã ghi biện pháp an toàn chưa. Nhờ vậy cảnh báo
  vẫn đúng sau khi cô sửa giáo án hoặc dựng giáo án mới.
- **Slide** trong bản thiết kế là 11 slide viết sẵn. Ở đây slide được tóm tắt
  từ giáo án đang mở, theo đúng trình tự của bản thiết kế: bìa → thông tin hoạt
  động → mục tiêu → chuẩn bị → từng hoạt động → tích hợp → kết thúc. Giáo án
  mẫu vẫn ra 11 slide như bản thiết kế.
- **Chip "Số slide"** trong bản thiết kế ánh xạ *13–15 slide* về 11 vì chỉ có
  11 slide viết sẵn. Ở đây chip là giới hạn trên: *6–8* → nhiều nhất 8, *9–12* →
  12, *13–15* → 15, *Tự động đề xuất* → đúng số slide tóm tắt được. Khi bị cắt,
  dòng mô tả nói rõ đã cắt từ bao nhiêu.
- **Lịch sử phiên bản** ghi mốc thật theo giờ máy, thay cho ba mốc 09:24 /
  09:31 / 09:42 viết sẵn.
- **Ô thống kê "Lượt AI còn lại hôm nay"** ở trang chủ để dấu gạch, vì đếm lượt
  gọi AI là việc của máy chủ. Ba ô còn lại tính thật: số giáo án trong thư viện,
  số đã ghim, số slide của bài trình chiếu hiện tại. Các số ở màn hình *Quản
  trị* vẫn giữ nguyên như bản thiết kế — đó là số liệu toàn hệ thống, bản chạy
  trên máy không có.
- **Thùng rác** làm thật: giáo án bị chuyển vào thùng rác thì biến khỏi thư
  viện trong phiên đó (chưa có màn hình khôi phục — câu thông báo "khôi phục
  trong 30 ngày" là việc của máy chủ).
- **Đăng nhập Google** vẫn là nút đi thẳng vào trang chủ, chưa có OAuth.
- **Bảng ánh xạ khi tải Word lên** chỉ hiện 40 đoạn đầu. File không phải giáo
  án có thể ra hàng trăm đoạn *Chưa xác định*; hiện hết thì bảng thành vô dụng,
  nên phần còn lại được ghi rõ số lượng thay vì đổ hết ra.
- Thêm focus ring cho bàn phím, và cho bảng hoạt động cuộn ngang riêng trong
  khung của nó trên màn hình hẹp — bản thiết kế chỉ dựng cho khổ 1440 × 980.

## Nội dung

Toàn bộ chữ tiếng Việt trong `js/data.js` lấy nguyên văn từ bản thiết kế: giáo
án mẫu *Khi con tức giận* (lớp ghép 3–4 và 4–5 tuổi, lĩnh vực tình cảm và kỹ
năng xã hội, 25–30 phút), 6 giáo án trong thư viện, 10 mẫu, 7 văn bản pháp lý,
và các danh mục độ tuổi / lĩnh vực / loại hoạt động / nội dung tích hợp / kiểu
giáo án / giọng văn.

Câu mẫu mà bộ dựng giáo án dùng khi không có mô hình ngôn ngữ nằm trong
`js/compose.js`, chia theo nhóm lĩnh vực (thể chất, ngôn ngữ, tình cảm – xã
hội, thẩm mỹ, nhận thức, đa lĩnh vực).

## Yêu cầu trình duyệt

Chrome hoặc Edge bản mới (từ khoảng 2022 trở lại). Phần xuất `.docx` / `.pptx`
chỉ cần `Blob` và `TextEncoder`, chạy được ở mọi trình duyệt hiện hành. Phần
**đọc** `.docx` cần `DecompressionStream('deflate-raw')`; trình duyệt nào chưa
có thì màn hình *Tải Word lên* nói rõ điều đó thay vì báo lỗi chung chung.
