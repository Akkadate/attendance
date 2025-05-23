# 📱 โครงการระบบเช็คชื่อนักศึกษาด้วย QR Code

## 📋 ภาพรวมโครงการ

ระบบเช็คชื่อนักศึกษาด้วย QR Code เป็นแอปพลิเคชันเว็บที่พัฒนาขึ้นเพื่อเพิ่มประสิทธิภาพในการบันทึกการเข้าร่วมกิจกรรมและการเข้าเรียนของนักศึกษามหาวิทยาลัยนอร์ทกรุงเทพ โดยใช้การสแกน QR Code จากบัตรนักศึกษา

### 🎯 วัตถุประสงค์
- เพิ่มความรวดเร็วในการเช็คชื่อนักศึกษา
- ลดข้อผิดพลาดจากการเช็คชื่อด้วยวิธีแบบดั้งเดิม
- จัดเก็บประวัติการเข้าร่วมกิจกรรมอย่างเป็นระบบ
- สามารถดูรายงานและสถิติการเข้าร่วมได้แบบเรียลไทม์

### 🔑 คุณสมบัติหลัก
1. **สแกน QR Code** - อ่านและถอดรหัส QR Code จากบัตรนักศึกษา
2. **บันทึกเวลาเข้า-ออก** - บันทึกทั้งเวลาเข้าและออกจากกิจกรรม
3. **จัดการกิจกรรม** - สร้าง แก้ไข จัดการกิจกรรมและรายวิชา
4. **รายงานและสถิติ** - แสดงรายงานการเข้าร่วมแบบภาพรวม, รายกิจกรรม และรายบุคคล
5. **ส่งออกข้อมูล** - ส่งออกข้อมูลในรูปแบบ CSV เพื่อนำไปใช้งานต่อ

## 🏗️ สถาปัตยกรรมระบบ

ระบบใช้สถาปัตยกรรมแบบ Client-Server โดยแบ่งเป็น 3 ส่วนหลัก:

### 1. Frontend
- พัฒนาด้วย HTML, CSS, JavaScript และ Bootstrap 5
- หน้าจอหลัก: 
  - **login.html** - หน้าเข้าสู่ระบบ
  - **scanner.html** - หน้าสแกน QR Code
  - **events.html** - หน้าจัดการกิจกรรม
  - **reports.html** - หน้ารายงานและสถิติ
  - **index.html** - หน้าแรก

### 2. Backend
- พัฒนาด้วย Node.js และ Express
- **attendance-server.js** - เซิร์ฟเวอร์หลักสำหรับระบบเช็คชื่อ
- API Endpoints หลัก:
  - `/api/login` - สำหรับการเข้าสู่ระบบ
  - `/api/events` - สำหรับการจัดการกิจกรรม
  - `/api/process-qrcode` - สำหรับประมวลผล QR Code
  - `/api/attendance` - สำหรับบันทึกและจัดการการเข้าร่วม
  - `/api/reports/*` - สำหรับระบบรายงาน

### 3. Database
- ใช้ PostgreSQL เพื่อจัดเก็บข้อมูล
- ตารางหลัก:
  - `events` - ข้อมูลกิจกรรมและรายวิชา
  - `attendance_records` - ข้อมูลการเข้าร่วมกิจกรรม
  - `admin_users` - ข้อมูลผู้ดูแลและผู้ใช้งานระบบ
  - `system_logs` - ประวัติการใช้งานระบบ
  - `student_details` - ข้อมูลนักศึกษา

## 📊 แผนภาพระบบ

### Entity-Relationship Diagram
```
EVENTS ||--o{ ATTENDANCE_RECORDS : "มีผู้เข้าร่วม"
ADMIN_USERS ||--o{ EVENTS : "เป็นผู้สร้าง"
ADMIN_USERS ||--o{ SYSTEM_LOGS : "มีกิจกรรม"
ADMIN_USERS ||--o{ ATTENDANCE_RECORDS : "เป็นผู้บันทึก"
STUDENT_DETAILS ||--o{ ATTENDANCE_RECORDS : "เข้าร่วม"
```

### Activity Diagram หลัก
1. **กระบวนการเข้าสู่ระบบ**
   - แสดงหน้าล็อกอิน → ตรวจสอบข้อมูล → บันทึกเซสชัน → นำทางไปหน้าหลัก

2. **กระบวนการสแกน QR Code**
   - เลือกกิจกรรม → เปิดกล้อง → สแกน QR Code → ถอดรหัส → ตรวจสอบข้อมูล → บันทึกการเข้าร่วม

3. **กระบวนการจัดการกิจกรรม**
   - เข้าหน้าจัดการกิจกรรม → สร้าง/แก้ไข/ดูรายละเอียด → บันทึกข้อมูล

4. **กระบวนการรายงาน**
   - เลือกประเภทรายงาน (ภาพรวม/รายกิจกรรม/รายบุคคล) → กำหนดเงื่อนไข → แสดงผล → ส่งออกข้อมูล

## 🔧 เทคโนโลยีที่ใช้

### Frontend
- HTML, CSS, JavaScript
- Bootstrap 5
- Chart.js - สำหรับแสดงกราฟและสถิติ
- Flatpickr - สำหรับตัวเลือกวันที่และเวลา
- HTML5-QRCode - สำหรับสแกน QR Code

### Backend
- Node.js และ Express
- bcrypt - สำหรับเข้ารหัสรหัสผ่าน
- express-session - สำหรับจัดการ session
- CryptoJS - สำหรับถอดรหัส QR Code
- pg (node-postgres) - สำหรับเชื่อมต่อกับ PostgreSQL

### Database
- PostgreSQL 12+

## 🔐 การเชื่อมต่อกับระบบบัตรนักศึกษา

ระบบเช็คชื่อนี้ถูกออกแบบให้ทำงานร่วมกับระบบบัตรนักศึกษาที่มีอยู่เดิม โดย:

1. **การถอดรหัส QR Code** - ใช้ CryptoJS เพื่อถอดรหัสข้อมูลที่เข้ารหัสด้วย AES จากบัตรนักศึกษา
2. **โครงสร้างข้อมูล QR Code** - ประกอบด้วย:
   ```json
   {
     "sid": "รหัสนักศึกษา",
     "name": "ชื่อ-นามสกุล",
     "fac": "คณะ",
     "dep": "สาขา",
     "ts": "เวลาที่สร้าง",
     "exp": "เวลาหมดอายุ",
     "ver": "เวอร์ชัน"
   }
   ```
3. **การตรวจสอบความถูกต้อง** - ใช้ HMAC signature เพื่อตรวจสอบความถูกต้องของข้อมูล
4. **การจัดการการหมดอายุ** - ตรวจสอบว่า QR Code ยังไม่หมดอายุก่อนบันทึกข้อมูล

## 📂 โครงสร้างฐานข้อมูล

### 1. ตารางกิจกรรม (events)
- `id` - รหัสกิจกรรม (PK)
- `event_name` - ชื่อกิจกรรม/รายวิชา
- `event_type` - ประเภทกิจกรรม ('class', 'activity', 'seminar', 'exam', 'other')
- `location` - สถานที่จัดกิจกรรม
- `start_time` - เวลาเริ่มต้น
- `end_time` - เวลาสิ้นสุด
- `description` - รายละเอียด
- `faculty`, `department`, `year_level` - ข้อมูลสำหรับกรองกลุ่มเป้าหมาย
- `created_by` - ผู้สร้าง
- `created_at` - เวลาที่สร้าง
- `status` - สถานะ ('active', 'cancelled', 'completed')

### 2. ตารางบันทึกการเข้าร่วม (attendance_records)
- `id` - รหัสการบันทึก (PK)
- `event_id` - รหัสกิจกรรม (FK)
- `student_id` - รหัสนักศึกษา
- `student_name` - ชื่อ-นามสกุลนักศึกษา
- `faculty`, `department` - ข้อมูลคณะและสาขา
- `check_in_time` - เวลาเข้าร่วม
- `check_out_time` - เวลาออก
- `status` - สถานะการเข้าร่วม ('present', 'late', 'absent', 'excused')
- `recorded_by` - ผู้บันทึก
- `notes` - บันทึกเพิ่มเติม

### 3. ตารางผู้ใช้งานระบบ (admin_users)
- `id` - รหัสผู้ใช้ (PK)
- `username` - ชื่อผู้ใช้งาน
- `password_hash` - รหัสผ่านที่เข้ารหัสแล้ว
- `fullname` - ชื่อ-นามสกุล
- `email` - อีเมล
- `role` - บทบาท ('admin', 'staff', 'teacher')
- `department`, `faculty` - สังกัด
- `status` - สถานะบัญชี ('active', 'inactive')

## 🚀 การติดตั้งและใช้งาน

### ความต้องการของระบบ
- Node.js v16.0.0 หรือใหม่กว่า
- PostgreSQL v12.0 หรือใหม่กว่า
- เว็บเบราว์เซอร์รุ่นล่าสุด (Chrome, Firefox, Safari, Edge)

### ขั้นตอนการติดตั้ง
1. ติดตั้ง Node.js และ PostgreSQL
2. นำเข้าโครงสร้างฐานข้อมูล (ไฟล์ schema.sql)
3. ตั้งค่าไฟล์ .env สำหรับค่าคอนฟิกต่างๆ
4. ติดตั้งแพ็คเกจที่จำเป็น: `npm install`
5. เริ่มการทำงานของเซิร์ฟเวอร์: `node attendance-server.js`
6. เข้าใช้งานผ่าน: http://localhost:4000

### ข้อมูลสำคัญที่ต้องตั้งค่า
- `ENCRYPTION_SECRET` - ต้องตั้งค่าให้ตรงกับระบบบัตรนักศึกษา
- เพิ่มผู้ดูแลระบบคนแรกโดยตรงในฐานข้อมูล

## 📝 สรุป

ระบบเช็คชื่อนักศึกษาด้วย QR Code นี้ช่วยปรับปรุงกระบวนการเช็คชื่อให้มีประสิทธิภาพและแม่นยำยิ่งขึ้น ด้วยการใช้เทคโนโลยี QR Code ร่วมกับบัตรนักศึกษา ลดขั้นตอนการทำงาน ลดข้อผิดพลาด และสามารถเก็บประวัติการเข้าร่วมกิจกรรมได้อย่างเป็นระบบ พร้อมระบบรายงานที่ใช้งานง่ายและยืดหยุ่น
