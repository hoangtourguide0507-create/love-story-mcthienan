# Love Story · MC Thiên Ân

Trang web để cô dâu và chú rể kể câu chuyện tình yêu của mình. MC Thiên Ân dùng những chia sẻ này để viết phần Love Story trong kịch bản đám cưới. Trang thay cho Google Form "Kể với Thiên Ân câu chuyện tình yêu của hai bạn".

- **Form cho dâu rể:** `https://mc-thien-an.netlify.app/lovestory/<tên>-<mã>` Mỗi người có một link riêng.
- **Trang quản trị:** `https://mc-thien-an.netlify.app/lovestory/admin/`
- **Dữ liệu:** lưu trong Google Sheet của Thiên Ân thông qua Google Apps Script, tự xoá 6 tháng sau ngày cưới.

👉 Cài đặt và vận hành: xem [SETUP.md](SETUP.md).

## Cấu trúc

```
apps-script/Code.gs          Backend: dán vào Apps Script của Google Sheet
public/lovestory/
  index.html, app.js         Form cho dâu rể (song ngữ, tự lưu, xem lại trước khi gửi)
  style.css                  Giao diện chung, cùng phong cách với web portfolio
  questions.json             Bộ câu hỏi: sửa câu hỏi ở đây, không cần đụng code
  config.js                  Link Apps Script (apiUrl)
  api.js                     Gọi Apps Script, kèm chế độ xem thử khi chưa có apiUrl
  admin/                     Trang quản trị: tạo cặp, gửi link, xem câu trả lời
netlify.toml                 Netlify xuất bản thư mục public
```

Trang dùng HTML/CSS/JS thuần, không cần cài đặt hay build.
