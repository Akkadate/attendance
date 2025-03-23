

https://claude.ai/share/da9eb337-daec-45fb-9862-f3d2198e2605


# ระบบเช็คชื่อนักศึกษาด้วย QR Code

ระบบนี้ถูกพัฒนาขึ้นเพื่อเพิ่มประสิทธิภาพในการบันทึกการเข้าเรียนและเข้าร่วมกิจกรรมของนักศึกษามหาวิทยาลัยนอร์ทกรุงเทพ โดยใช้เทคโนโลยี QR Code บนบัตรนักศึกษา

## คุณสมบัติหลัก

1. **สแกน QR Code** - อ่าน QR Code จากบัตรนักศึกษาเพื่อบันทึกการเข้าร่วมกิจกรรม
2. **จัดการกิจกรรม/รายวิชา** - สร้าง แก้ไข และจัดการกิจกรรมหรือรายวิชาต่างๆ 
3. **รายงานและสถิติ** - แสดงรายงานการเข้าร่วมกิจกรรมแบบเรียลไทม์
4. **บันทึกประวัติ** - จัดเก็บประวัติการเข้าร่วมกิจกรรมรายบุคคล
5. **ส่งออกข้อมูล** - ส่งออกข้อมูลในรูปแบบ CSV เพื่อนำไปใช้งานต่อ

## โครงสร้างโปรเจค

โปรเจคนี้ประกอบด้วยไฟล์หลักดังต่อไปนี้:

1. **เซิร์ฟเวอร์**
   - `attendance-server.js` - เซิร์ฟเวอร์หลักสำหรับระบบเช็คชื่อ
   - `database-schema.sql` - โครงสร้างฐานข้อมูล PostgreSQL

2. **เว็บไซต์ (Frontend)**
   - `public/index.html` - หน้าแรก
   - `public/login.html` - หน้าเข้าสู่ระบบ
   - `public/scanner.html` - หน้าสแกน QR Code
   - `public/events.html` - หน้าจัดการกิจกรรม
   - `public/reports.html` - หน้ารายงาน

## เทคโนโลยีที่ใช้

- **Backend**: Node.js, Express
- **Database**: PostgreSQL
- **Frontend**: HTML, CSS, JavaScript, Bootstrap 5
- **Libraries**: 
  - QR Code Scanner: html5-qrcode
  - Encryption: CryptoJS
  - Date Picker: Flatpickr
  - Charts: Chart.js

## ความต้องการของระบบ

- Node.js v16.0.0 หรือใหม่กว่า
- PostgreSQL v12.0 หรือใหม่กว่า
- เว็บเบราว์เซอร์รุ่นล่าสุด (Chrome, Firefox, Safari, Edge)

## วิธีการติดตั้ง

1. **ติดตั้ง Node.js และ PostgreSQL**

2. **Clone โปรเจค (หรือดาวน์โหลดไฟล์)**

3. **ตั้งค่าฐานข้อมูล PostgreSQL**
   ```sql
   CREATE DATABASE attendance_system;
   ```

4. **นำเข้าโครงสร้างฐานข้อมูล**
   ```bash
   psql -d attendance_system -f database-schema.sql
   ```

5. **สร้างไฟล์ .env**
   ```
   DB_USER=postgres
   DB_HOST=localhost
   DB_NAME=attendance_system
   DB_PASSWORD=your_password
   DB_PORT=5432
   
   ATTENDANCE_PORT=4000
   SESSION_SECRET=your_session_secret
   ENCRYPTION_SECRET=your_encryption_secret
   
   NODE_ENV=development
   ```

6. **ติดตั้งแพ็คเกจที่จำเป็น**
   ```bash
   npm install express pg cors body-parser express-session bcrypt dotenv path fs morgan helmet express-rate-limit
   ```

7. **เริ่มการทำงานของเซิร์ฟเวอร์**
   ```bash
   node attendance-server.js
   ```

8. **เข้าใช้งานระบบ**
   เปิดเว็บเบราว์เซอร์และไปที่ http://localhost:4000

## การสร้างบัญชีผู้ดูแลระบบ (Admin)

ผู้ดูแลระบบคนแรกจำเป็นต้องถูกสร้างโดยตรงในฐานข้อมูล:

```sql
INSERT INTO admin_users 
(username, password_hash, fullname, email, role, department, faculty) 
VALUES 
('admin', '$2b$10$YourHashedPasswordHere', 'ผู้ดูแลระบบ', 'admin@example.com', 'admin', '', '');
```

สำหรับการแฮชรหัสผ่าน คุณสามารถใช้ Node.js script ต่อไปนี้:

```javascript
const bcrypt = require('bcrypt');
const password = 'your_password';
bcrypt.hash(password, 10, function(err, hash) {
    console.log(hash);
});
```

## การเชื่อมต่อกับระบบบัตรนักศึกษา

ระบบเช็คชื่อนี้ถูกออกแบบให้ทำงานร่วมกับระบบบัตรนักศึกษาของมหาวิทยาลัย โดยใช้การถอดรหัส QR Code จากบัตรนักศึกษา ซึ่งใช้การเข้ารหัสแบบ AES ด้วย CryptoJS

สิ่งสำคัญคือต้องใช้ค่า `ENCRYPTION_SECRET` เดียวกันกับที่ใช้ในระบบบัตรนักศึกษา

## คำแนะนำเพิ่มเติม

1. **การใช้งานในโปรดักชัน**:
   - ตั้งค่า `NODE_ENV=production` ในไฟล์ .env
   - ใช้ HTTPS ด้วย SSL Certificate
   - ติดตั้ง PM2 หรือ Forever เพื่อให้แอปทำงานตลอดเวลา

2. **การสำรองข้อมูล**:
   - ตั้งค่าการสำรองข้อมูล PostgreSQL เป็นประจำ

3. **การปรับแต่งประสิทธิภาพ**:
   - สามารถปรับแต่งค่า Rate Limiting ใน `attendance-server.js` ตามความเหมาะสม

## ต้องการความช่วยเหลือหรือมีคำถาม?

หากคุณมีคำถามหรือต้องการความช่วยเหลือเพิ่มเติม สามารถติดต่อทีมผู้พัฒนาได้ที่:
- อีเมล: [ระบุอีเมลติดต่อ]
- เบอร์โทรศัพท์: [ระบุเบอร์โทรติดต่อ]
