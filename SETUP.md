# Hướng dẫn cài đặt — Love Story · MC Thiên Ân

Có 3 phần, làm theo thứ tự. Tổng cộng khoảng 20 phút.

- **A.** Tạo Google Sheet và Apps Script (nơi nhận câu trả lời)
- **B.** Đưa trang Love Story lên Netlify từ GitHub
- **C.** Gắn vào link `mc-thien-an.netlify.app/lovestory/`

---

## A. Google Sheet + Apps Script

1. Đăng nhập tài khoản Google công việc của Thiên Ân, tạo một **Google Sheet mới**. Đặt tên, ví dụ `Love Story · Thiên Ân`.
2. Trong Sheet: **Tiện ích mở rộng → Apps Script**.
3. Xoá hết code mẫu trong file `Code.gs`. Dán **toàn bộ** nội dung file [`apps-script/Code.gs`](apps-script/Code.gs) trong repo này vào. Bấm biểu tượng 💾 để lưu.
4. Bấm **Cài đặt dự án** (biểu tượng bánh răng bên trái). Kéo xuống **Thuộc tính tập lệnh → Thêm thuộc tính tập lệnh** và thêm các dòng sau:

   | Thuộc tính | Giá trị |
   |---|---|
   | `ADMIN_PASSWORD` | Mật khẩu trang quản trị. Đặt mật khẩu dài, khó đoán. |
   | `NOTIFY_EMAIL` | Email nhận thông báo khi dâu rể gửi. Có thể bỏ trống, khi đó email gửi về tài khoản sở hữu Sheet. |
   | `ADMIN_URL` | `https://mc-thien-an.netlify.app/lovestory/admin/` |

   Bấm **Lưu thuộc tính tập lệnh**.
5. Quay lại **Trình chỉnh sửa** (biểu tượng `< >`). Ở thanh trên cùng, chọn hàm **`setup`** rồi bấm **Chạy**.
   - Google sẽ hỏi cấp quyền. Chọn tài khoản của bạn.
   - Nếu hiện *"Google chưa xác minh ứng dụng này"*: bấm **Nâng cao → Đi tới … (không an toàn)** rồi bấm **Cho phép**. Đây là script của chính bạn nên an toàn.
   - Chạy xong, Sheet sẽ có 2 trang tính mới là `Couples` và `Responses`.
6. Bấm **Triển khai → Tùy chọn triển khai mới**.
   - Ở **Chọn loại**, bấm biểu tượng bánh răng và chọn **Ứng dụng web**.
   - **Thực thi dưới dạng:** *Tôi*
   - **Người có quyền truy cập:** *Bất kỳ ai*
   - Bấm **Triển khai**, sau đó copy **URL ứng dụng web**. Link có dạng `https://script.google.com/macros/s/……/exec`.
7. Gửi URL này cho Claude để gắn vào trang. Hoặc tự sửa file `public/lovestory/config.js`: dán URL vào giữa hai dấu ngoặc kép ở dòng `apiUrl: ""`.

> **Khi cập nhật `Code.gs` về sau** (ví dụ khi Claude báo có bản mới):
> 1. Mở Apps Script, xoá hết code cũ, dán toàn bộ `apps-script/Code.gs` mới vào và bấm 💾 để lưu.
> 2. Bấm **Triển khai → Quản lý các bản triển khai**, bấm biểu tượng bút chì.
> 3. Ở mục **Phiên bản**, chọn **Phiên bản mới**, rồi bấm **Triển khai**.
>
> Làm như vậy URL được giữ nguyên, không cần sửa `config.js`. Nếu bấm "Tùy chọn triển khai mới" thay vì "Quản lý các bản triển khai", Google sẽ tạo URL khác.

---

## B. Đưa trang lên Netlify

1. Vào [app.netlify.com](https://app.netlify.com), chọn **Add new site → Import an existing project → GitHub**. Chọn repo **`love-story-mcthienan`**.
2. Netlify tự đọc file `netlify.toml`: không có lệnh build, thư mục xuất bản là `public`. Bấm **Deploy**.
3. Vào **Site configuration → Change site name** và đặt tên `love-story-mcthienan`. Địa chỉ site sẽ là `https://love-story-mcthienan.netlify.app`.
   - Nếu tên này đã có người dùng, chọn tên khác và nhớ dùng đúng tên đó ở bước C.

Từ giờ, mỗi lần có code mới đẩy lên GitHub, Netlify tự cập nhật trang.

---

## C. Gắn vào web portfolio

1. Trong **thư mục web portfolio** (thư mục chứa `index.html`, `editor.html`, `content.json`), tạo một file tên **`_redirects`**. Lưu ý: file không có đuôi `.txt`.
2. Dán đúng 1 dòng sau vào file:

   ```
   /lovestory/*  https://love-story-mcthienan.netlify.app/lovestory/:splat  200
   ```

   Nếu thư mục đã có sẵn file `_redirects`, chỉ cần thêm dòng này vào **đầu** file.
3. Kéo thả lại cả thư mục portfolio lên Netlify như bình thường.
4. Mở thử 2 link sau để kiểm tra:
   - `https://mc-thien-an.netlify.app/lovestory/admin/` (trang quản trị)
   - `https://mc-thien-an.netlify.app/lovestory/` (sẽ báo "Link chưa đúng" vì chưa có mã cặp đôi, như vậy là đúng)

---

## D. Chạy thử trước khi gửi khách

1. Vào trang quản trị và đăng nhập bằng `ADMIN_PASSWORD`. Bấm **+ Cặp mới**, nhập một cặp thử.
2. Mở link cô dâu trên điện thoại, điền vài câu rồi bấm **Gửi**. Kiểm tra 3 điều:
   - Có nhận được email thông báo.
   - Sheet có thêm dòng trong trang tính `Responses`.
   - Trang quản trị hiện câu trả lời.
3. Mở lại link, bấm **Đổi người**, chọn tên chú rể và kiểm tra rằng phần của chú rể là trang trống, chưa có câu trả lời của cô dâu.
4. Xoá cặp thử bằng nút cuối trang chi tiết.

---

## Vận hành hằng ngày

1. Chốt hợp đồng với cặp đôi, vào trang quản trị bấm **+ Cặp mới**.
2. Bấm **Copy tin nhắn group (VI)** hoặc **(EN)** rồi gửi vào group chung. Tin nhắn tiếng Anh tự mở form bằng tiếng Anh.
3. Mỗi khi có người gửi, bạn nhận email. Trang quản trị cho thấy ai chưa xong để nhắc.
4. Khi viết kịch bản, bấm **Copy toàn bộ** và dán cho Claude, hoặc bấm **In / PDF**.
5. Dữ liệu tự xoá **6 tháng sau ngày cưới**. Script tự kiểm tra lúc 3 giờ sáng mỗi ngày.

## Sửa câu hỏi

Toàn bộ câu hỏi nằm trong `public/lovestory/questions.json`. Khi sửa:

- Có thể sửa chữ, thêm hoặc bỏ câu.
- **Không đổi `id`** của câu đã có (ví dụ `q2_3`). Nếu đổi, câu trả lời cũ của câu đó sẽ không hiện lại.
- Câu mới cần một `id` mới chưa dùng.

## Chế độ xem thử

Khi `apiUrl` trong `config.js` còn để trống, trang chạy ở chế độ xem thử. Dữ liệu chỉ lưu trên trình duyệt đang mở, không gửi đi đâu.

- Mật khẩu trang quản trị khi xem thử: `demo`.
- Link mẫu: `/lovestory/demobride00001` (cô dâu) và `/lovestory/demogroom00001` (chú rể).

## Dạng link mời

Mỗi cặp có **một link chung**, gửi thẳng vào group, ví dụ `https://mc-thien-an.netlify.app/lovestory/an-hoang`.
Khi mở link, trang hỏi *"Bạn là ai?"* và hiện hai nút tên cô dâu, chú rể. Mỗi người bấm chọn tên mình rồi trả lời riêng. Trình duyệt nhớ lựa chọn này, lần sau mở lại sẽ vào thẳng phần của mình. Muốn đổi người thì bấm "Không phải …? Đổi người".

Không có mật khẩu, nên về nguyên tắc người này vẫn có thể bấm vào tên người kia. Nếu trùng tên với một cặp đã có, hệ thống tự thêm số, ví dụ `an-hoang-2`. Link dạng cũ vẫn mở được.
