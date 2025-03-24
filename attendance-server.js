// attendance-server.js - ระบบเช็คชื่อนักศึกษาด้วย QR Code
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const CryptoJS = require("crypto-js");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// โหลดค่า environment variables
dotenv.config();

// สร้าง Express app
const app = express();
const port = process.env.ATTENDANCE_PORT || 4000;

app.set("trust proxy", true);

// ตั้งค่า security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan("combined"));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 นาที
  max: 100, // จำกัด 100 request ต่อ windowMs
  message: "คำขอมากเกินไป กรุณาลองใหม่ภายหลัง",
});
app.use("/api/", limiter);

// ตั้งค่า session
app.use(
  session({
    secret: process.env.SESSION_SECRET || "attendance-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 3600000, // 1 ชั่วโมง
    },
  })
);

// ตั้งค่า middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// เชื่อมต่อกับ PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// ทดสอบการเชื่อมต่อกับฐานข้อมูล
pool.connect((err) => {
  if (err) {
    console.error("เกิดข้อผิดพลาดในการเชื่อมต่อกับฐานข้อมูล:", err);
  } else {
    console.log("เชื่อมต่อกับฐานข้อมูล PostgreSQL สำเร็จ");
  }
});

// Encryption/Decryption Module ตามการทำงานของบัตรนักศึกษา
const EncryptionModule = {
  decrypt: function (
    encryptedString,
    secretKey = process.env.ENCRYPTION_SECRET
  ) {
    try {
      const data = JSON.parse(encryptedString);

      // ตรวจสอบ HMAC signature
      const computedHmac = CryptoJS.HmacSHA256(
        data.e + data.iv,
        secretKey
      ).toString();
      if (computedHmac !== data.s) {
        throw new Error("Invalid signature - data may be tampered");
      }

      // ถอดรหัสข้อมูล
      const decrypted = CryptoJS.AES.decrypt(data.e, secretKey, {
        iv: CryptoJS.enc.Utf8.parse(data.iv),
      });

      // แปลงเป็น string และ parse เป็น JSON
      return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
    } catch (error) {
      console.error(`เกิดข้อผิดพลาดระหว่างการถอดรหัส: ${error.message}`);
      return null;
    }
  },

  // สำหรับรับมือกับ QR Code รูปแบบเก่า หรือรูปแบบที่ไม่ได้เข้ารหัส
  parseSimpleFormat: function (qrText) {
    try {
      if (qrText.startsWith("STUDENT:")) {
        const parts = qrText.split(",");
        const studentId = parts[0].split(":")[1];
        const timestamp = parts[1].split(":")[1];
        const expiry = parts[2].split(":")[1];

        return {
          sid: studentId,
          ts: parseInt(timestamp),
          exp: parseInt(expiry),
          ver: "1.0",
        };
      }
      return null;
    } catch (error) {
      console.error("Error parsing simple QR format:", error);
      return null;
    }
  },
};

// Middleware ตรวจสอบการเข้าสู่ระบบ
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: "กรุณาเข้าสู่ระบบก่อนใช้งาน",
    });
  }
  next();
};

// Middleware ตรวจสอบสิทธิ์ผู้ดูแลระบบ
const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "ไม่มีสิทธิ์ในการเข้าถึงส่วนนี้",
    });
  }
  next();
};

// ------ API Routes ------ //

// API ล็อกอินเข้าสู่ระบบ
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "กรุณาระบุชื่อผู้ใช้และรหัสผ่าน",
      });
    }

    // ค้นหาผู้ใช้ในฐานข้อมูล
    const result = await pool.query(
      "SELECT * FROM admin_users WHERE username = $1 AND status = $2",
      [username, "active"]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        success: false,
        message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
      });
    }

    const user = result.rows[0];

    // ตรวจสอบรหัสผ่าน
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
      });
    }

    // อัปเดตเวลาล็อกอินล่าสุด
    await pool.query(
      "UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
      [user.id]
    );

    // บันทึกประวัติการล็อกอิน
    await pool.query("SELECT log_action($1, $2, $3, $4)", [
      "login",
      "ล็อกอินเข้าสู่ระบบสำเร็จ",
      user.id,
      req.ip,
    ]);

    // สร้าง session
    req.session.user = {
      id: user.id,
      username: user.username,
      fullname: user.fullname,
      role: user.role,
      department: user.department,
      faculty: user.faculty,
    };

    return res.json({
      success: true,
      message: "ล็อกอินสำเร็จ",
      user: {
        id: user.id,
        username: user.username,
        fullname: user.fullname,
        role: user.role,
        department: user.department,
        faculty: user.faculty,
      },
    });
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการล็อกอิน:", error);

    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการล็อกอิน กรุณาลองใหม่อีกครั้ง",
    });
  }
});

// API ออกจากระบบ
app.post("/api/logout", (req, res) => {
  if (req.session.user) {
    const userId = req.session.user.id;

    // บันทึกประวัติการออกจากระบบ
    pool
      .query("SELECT log_action($1, $2, $3, $4)", [
        "logout",
        "ออกจากระบบสำเร็จ",
        userId,
        req.ip,
      ])
      .catch((err) => console.error("Error logging logout:", err));

    // ลบ session
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res.status(500).json({
          success: false,
          message: "เกิดข้อผิดพลาดในการออกจากระบบ",
        });
      }

      return res.json({
        success: true,
        message: "ออกจากระบบสำเร็จ",
      });
    });
  } else {
    return res.json({
      success: true,
      message: "ออกจากระบบสำเร็จ",
    });
  }
});

// API ประมวลผล QR Code ที่แสกนได้
app.post("/api/process-qrcode", requireAuth, async (req, res) => {
  try {
    const { qrData, eventId } = req.body;

    if (!qrData || !eventId) {
      return res.status(400).json({
        success: false,
        message: "กรุณาระบุข้อมูล QR Code และ ID ของกิจกรรม",
      });
    }

    // ตรวจสอบว่ากิจกรรมมีอยู่จริงหรือไม่
    const eventResult = await pool.query(
      "SELECT * FROM events WHERE id = $1 AND status = $2",
      [eventId, "active"]
    );

    if (eventResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบข้อมูลกิจกรรม",
      });
    }

    const event = eventResult.rows[0];

    // ตรวจสอบว่ากิจกรรมยังไม่สิ้นสุด
    const now = new Date();
    if (now > new Date(event.end_time)) {
      return res.status(400).json({
        success: false,
        message: "กิจกรรมนี้สิ้นสุดแล้ว ไม่สามารถบันทึกการเข้าร่วมได้",
      });
    }

    // ถอดรหัสข้อมูล QR Code
    let decodedData;
    try {
      decodedData = EncryptionModule.decrypt(qrData);

      // ถ้าถอดรหัสไม่สำเร็จ ให้ลองใช้วิธีการถอดรหัสแบบง่าย
      if (!decodedData) {
        decodedData = EncryptionModule.parseSimpleFormat(qrData);
      }

      if (!decodedData) {
        return res.status(400).json({
          success: false,
          message: "ไม่สามารถประมวลผลข้อมูล QR Code ได้",
        });
      }
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการถอดรหัส QR Code:", error);
      return res.status(400).json({
        success: false,
        message: "ไม่สามารถถอดรหัส QR Code ได้",
      });
    }

    // ตรวจสอบว่า QR Code หมดอายุหรือไม่
    if (decodedData.exp && decodedData.exp < now.getTime()) {
      return res.status(400).json({
        success: false,
        message: "QR Code นี้หมดอายุแล้ว กรุณาใช้ QR Code ที่ยังไม่หมดอายุ",
      });
    }

    const studentId = decodedData.sid;

    // ตรวจสอบว่ามีการบันทึกการเข้าร่วมไปแล้วหรือไม่
    const checkAttendance = await pool.query(
      "SELECT * FROM attendance_records WHERE event_id = $1 AND student_id = $2",
      [eventId, studentId]
    );

    if (checkAttendance.rowCount > 0) {
      // ถ้ามีการบันทึกไปแล้ว ให้อัปเดตเวลา check-out
      await pool.query(
        "UPDATE attendance_records SET check_out_time = CURRENT_TIMESTAMP, notes = $1 WHERE event_id = $2 AND student_id = $3",
        [
          "มีการตรวจสอบซ้ำเมื่อ " + now.toLocaleString("th-TH"),
          eventId,
          studentId,
        ]
      );

      return res.json({
        success: true,
        message: "อัปเดตเวลาออกสำหรับนักศึกษารหัส " + studentId + " สำเร็จ",
        studentInfo: {
          studentId: studentId,
          name: decodedData.name || "-",
          faculty: decodedData.fac || "-",
          department: decodedData.dep || "-",
          checkInTime: checkAttendance.rows[0].check_in_time,
          checkOutTime: now,
        },
        isCheckOut: true,
      });
    }

    // บันทึกการเข้าร่วมใหม่
    const status = now > new Date(event.start_time) ? "late" : "present";

    const insertResult = await pool.query(
      `INSERT INTO attendance_records 
      (event_id, student_id, student_name, faculty, department, check_in_time, status, recorded_by) 
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7) 
      RETURNING *`,
      [
        eventId,
        studentId,
        decodedData.name || "-",
        decodedData.fac || "-",
        decodedData.dep || "-",
        status,
        req.session.user.username,
      ]
    );

    // บันทึกประวัติการทำงาน
    await pool.query("SELECT log_action($1, $2, $3, $4)", [
      "record_attendance",
      `บันทึกการเข้าร่วมของนักศึกษารหัส ${studentId} ในกิจกรรม ${event.event_name}`,
      req.session.user.id,
      req.ip,
    ]);

    return res.json({
      success: true,
      message: "บันทึกการเข้าร่วมสำหรับนักศึกษารหัส " + studentId + " สำเร็จ",
      studentInfo: {
        studentId: studentId,
        name: decodedData.name || "-",
        faculty: decodedData.fac || "-",
        department: decodedData.dep || "-",
        checkInTime: insertResult.rows[0].check_in_time,
        status: status,
      },
      isCheckOut: false,
    });
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการประมวลผล QR Code:", error);

    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการประมวลผล QR Code กรุณาลองใหม่อีกครั้ง",
    });
  }
});

// API สร้างกิจกรรมใหม่
app.post("/api/events", requireAuth, async (req, res) => {
  try {
    const {
      eventName,
      eventType,
      location,
      startTime,
      endTime,
      description,
      faculty,
      department,
      yearLevel,
    } = req.body;

    if (!eventName || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "กรุณาระบุชื่อกิจกรรม เวลาเริ่มต้น และเวลาสิ้นสุด",
      });
    }

    // ตรวจสอบความถูกต้องของวันเวลา
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "รูปแบบวันที่หรือเวลาไม่ถูกต้อง",
      });
    }

    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        message: "เวลาเริ่มต้นต้องน้อยกว่าเวลาสิ้นสุด",
      });
    }

    // บันทึกข้อมูลกิจกรรม
    const result = await pool.query(
      `INSERT INTO events 
      (event_name, event_type, location, start_time, end_time, description, 
       faculty, department, year_level, created_by, created_at, status) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, $11) 
      RETURNING *`,
      [
        eventName,
        eventType || "other",
        location || "",
        startTime,
        endTime,
        description || "",
        faculty || "",
        department || "",
        yearLevel || "",
        req.session.user.username,
        "active",
      ]
    );

    const newEvent = result.rows[0];

    // บันทึกประวัติการทำงาน
    await pool.query("SELECT log_action($1, $2, $3, $4)", [
      "create_event",
      `สร้างกิจกรรม "${eventName}" สำเร็จ`,
      req.session.user.id,
      req.ip,
    ]);

    return res.json({
      success: true,
      message: "สร้างกิจกรรมสำเร็จ",
      event: newEvent,
    });
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการสร้างกิจกรรม:", error);

    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการสร้างกิจกรรม กรุณาลองใหม่อีกครั้ง",
    });
  }
});

// API ดึงข้อมูลกิจกรรมทั้งหมด
app.get("/api/events", requireAuth, async (req, res) => {
  try {
    const { status, type, faculty, department, search } = req.query;

    let query = "SELECT * FROM events WHERE 1=1";
    const params = [];
    let paramIndex = 1;

    // เพิ่มเงื่อนไขการกรอง
    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (type) {
      query += ` AND event_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (faculty) {
      query += ` AND faculty = $${paramIndex}`;
      params.push(faculty);
      paramIndex++;
    }

    if (department) {
      query += ` AND department = $${paramIndex}`;
      params.push(department);
      paramIndex++;
    }

    if (search) {
      query += ` AND (event_name ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR location ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // เรียงลำดับตามวันที่
    query += " ORDER BY start_time DESC";

    const result = await pool.query(query, params);

    return res.json({
      success: true,
      events: result.rows,
    });
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการดึงข้อมูลกิจกรรม:", error);

    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงข้อมูลกิจกรรม กรุณาลองใหม่อีกครั้ง",
    });
  }
});

// API ดึงข้อมูลกิจกรรมตาม ID
app.get("/api/events/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const eventResult = await pool.query("SELECT * FROM events WHERE id = $1", [
      id,
    ]);

    if (eventResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบข้อมูลกิจกรรม",
      });
    }

    // ดึงข้อมูลการเข้าร่วมกิจกรรม
    const attendanceResult = await pool.query(
      "SELECT * FROM attendance_records WHERE event_id = $1 ORDER BY check_in_time",
      [id]
    );

    // ดึงข้อมูลสรุป
    const summaryResult = await pool.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'present') as present_count,
        COUNT(*) FILTER (WHERE status = 'late') as late_count,
        COUNT(*) FILTER (WHERE status = 'absent') as absent_count,
        COUNT(*) FILTER (WHERE status = 'excused') as excused_count
      FROM attendance_records 
      WHERE event_id = $1`,
      [id]
    );

    return res.json({
      success: true,
      event: eventResult.rows[0],
      attendance: attendanceResult.rows,
      summary: summaryResult.rows[0],
    });
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการดึงข้อมูลกิจกรรม:", error);

    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงข้อมูลกิจกรรม กรุณาลองใหม่อีกครั้ง",
    });
  }
});

// API อัปเดตข้อมูลกิจกรรม
app.put("/api/events/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      eventName,
      eventType,
      location,
      startTime,
      endTime,
      description,
      faculty,
      department,
      yearLevel,
      status,
    } = req.body;

    // ตรวจสอบว่ากิจกรรมมีอยู่จริงหรือไม่
    const checkResult = await pool.query("SELECT * FROM events WHERE id = $1", [
      id,
    ]);

    if (checkResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบข้อมูลกิจกรรม",
      });
    }

    // อัปเดตข้อมูลกิจกรรม
    const updateResult = await pool.query(
      `UPDATE events SET
        event_name = COALESCE($1, event_name),
        event_type = COALESCE($2, event_type),
        location = COALESCE($3, location),
        start_time = COALESCE($4, start_time),
        end_time = COALESCE($5, end_time),
        description = COALESCE($6, description),
        faculty = COALESCE($7, faculty),
        department = COALESCE($8, department),
        year_level = COALESCE($9, year_level),
        status = COALESCE($10, status)
      WHERE id = $11
      RETURNING *`,
      [
        eventName,
        eventType,
        location,
        startTime,
        endTime,
        description,
        faculty,
        department,
        yearLevel,
        status,
        id,
      ]
    );

    // บันทึกประวัติการทำงาน
    await pool.query("SELECT log_action($1, $2, $3, $4)", [
      "update_event",
      `อัปเดตกิจกรรม "${eventName || checkResult.rows[0].event_name}" สำเร็จ`,
      req.session.user.id,
      req.ip,
    ]);

    return res.json({
      success: true,
      message: "อัปเดตกิจกรรมสำเร็จ",
      event: updateResult.rows[0],
    });
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการอัปเดตกิจกรรม:", error);

    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการอัปเดตกิจกรรม กรุณาลองใหม่อีกครั้ง",
    });
  }
});

// API บันทึกการเข้าร่วมกิจกรรมด้วยตนเอง (Manual)
app.post("/api/attendance", requireAuth, async (req, res) => {
  try {
    const {
      eventId,
      studentId,
      studentName,
      faculty,
      department,
      status,
      notes,
    } = req.body;

    if (!eventId || !studentId) {
      return res.status(400).json({
        success: false,
        message: "กรุณาระบุ ID กิจกรรมและรหัสนักศึกษา",
      });
    }

    // ตรวจสอบว่ากิจกรรมมีอยู่จริงหรือไม่
    const eventResult = await pool.query("SELECT * FROM events WHERE id = $1", [
      eventId,
    ]);

    if (eventResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบข้อมูลกิจกรรม",
      });
    }

    // ตรวจสอบว่ามีการบันทึกการเข้าร่วมไปแล้วหรือไม่
    const checkAttendance = await pool.query(
      "SELECT * FROM attendance_records WHERE event_id = $1 AND student_id = $2",
      [eventId, studentId]
    );

    if (checkAttendance.rowCount > 0) {
      // ถ้ามีการบันทึกไปแล้ว ให้อัปเดต
      const updateResult = await pool.query(
        `UPDATE attendance_records SET
          student_name = COALESCE($1, student_name),
          faculty = COALESCE($2, faculty),
          department = COALESCE($3, department),
          status = COALESCE($4, status),
          notes = COALESCE($5, notes),
          recorded_by = $6
        WHERE event_id = $7 AND student_id = $8
        RETURNING *`,
        [
          studentName,
          faculty,
          department,
          status,
          notes,
          req.session.user.username,
          eventId,
          studentId,
        ]
      );

      // บันทึกประวัติการทำงาน
      await pool.query("SELECT log_action($1, $2, $3, $4)", [
        "update_attendance",
        `อัปเดตการเข้าร่วมของนักศึกษารหัส ${studentId} ในกิจกรรม ${eventResult.rows[0].event_name} สำเร็จ`,
        req.session.user.id,
        req.ip,
      ]);

      return res.json({
        success: true,
        message: "อัปเดตการเข้าร่วมสำเร็จ",
        attendance: updateResult.rows[0],
      });
    }

    // บันทึกการเข้าร่วมใหม่
    const insertResult = await pool.query(
      `INSERT INTO attendance_records 
      (event_id, student_id, student_name, faculty, department, status, notes, recorded_by) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING *`,
      [
        eventId,
        studentId,
        studentName || "-",
        faculty || "-",
        department || "-",
        status || "present",
        notes || "",
        req.session.user.username,
      ]
    );

    // บันทึกประวัติการทำงาน
    await pool.query("SELECT log_action($1, $2, $3, $4)", [
      "manual_record_attendance",
      `บันทึกการเข้าร่วมของนักศึกษารหัส ${studentId} ในกิจกรรม ${eventResult.rows[0].event_name} ด้วยตนเอง`,
      req.session.user.id,
      req.ip,
    ]);

    return res.json({
      success: true,
      message: "บันทึกการเข้าร่วมสำเร็จ",
      attendance: insertResult.rows[0],
    });
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการบันทึกการเข้าร่วม:", error);

    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการบันทึกการเข้าร่วม กรุณาลองใหม่อีกครั้ง",
    });
  }
});

// API ลบรายการการเข้าร่วมกิจกรรม
app.delete("/api/attendance/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // ตรวจสอบว่ารายการมีอยู่จริงหรือไม่
    const checkResult = await pool.query(
      "SELECT * FROM attendance_records WHERE id = $1",
      [id]
    );

    if (checkResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบข้อมูลการเข้าร่วม",
      });
    }

    const attendanceRecord = checkResult.rows[0];

    // ดึงข้อมูลกิจกรรม
    const eventResult = await pool.query(
      "SELECT event_name FROM events WHERE id = $1",
      [attendanceRecord.event_id]
    );

    // ลบรายการ
    await pool.query("DELETE FROM attendance_records WHERE id = $1", [id]);

    // บันทึกประวัติการทำงาน
    await pool.query("SELECT log_action($1, $2, $3, $4)", [
      "delete_attendance",
      `ลบการเข้าร่วมของนักศึกษารหัส ${attendanceRecord.student_id} ในกิจกรรม ${eventResult.rows[0].event_name} สำเร็จ`,
      req.session.user.id,
      req.ip,
    ]);

    return res.json({
      success: true,
      message: "ลบรายการการเข้าร่วมสำเร็จ",
    });
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการลบรายการการเข้าร่วม:", error);

    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการลบรายการการเข้าร่วม กรุณาลองใหม่อีกครั้ง",
    });
  }
});

// API ค้นหารายชื่อนักศึกษาจากฐานข้อมูลนักศึกษา
app.get("/api/students", requireAuth, async (req, res) => {
  try {
    const { query, faculty, department } = req.query;

    if (!query && !faculty && !department) {
      return res.status(400).json({
        success: false,
        message: "กรุณาระบุคำค้นหา คณะ หรือภาควิชา",
      });
    }

    let sqlQuery = `
      SELECT s.student_id, s.first_name, s.last_name, s.faculty, s.department, s.year_level
      FROM student_details s
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (query) {
      sqlQuery += ` AND (
        s.student_id LIKE $${paramIndex}
        OR s.first_name LIKE $${paramIndex}
        OR s.last_name LIKE $${paramIndex}
      )`;
      params.push(`%${query}%`);
      paramIndex++;
    }

    if (faculty) {
      sqlQuery += ` AND s.faculty = $${paramIndex}`;
      params.push(faculty);
      paramIndex++;
    }

    if (department) {
      sqlQuery += ` AND s.department = $${paramIndex}`;
      params.push(department);
      paramIndex++;
    }

    sqlQuery += " ORDER BY s.student_id LIMIT 50";

    const result = await pool.query(sqlQuery, params);

    return res.json({
      success: true,
      students: result.rows,
    });
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการค้นหานักศึกษา:", error);

    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการค้นหานักศึกษา กรุณาลองใหม่อีกครั้ง",
    });
  }
});

// API สำหรับการสร้างผู้ใช้งานระบบ (admin เท่านั้น)
app.post("/api/admin-users", requireAdmin, async (req, res) => {
  try {
    const { username, password, fullname, email, role, department, faculty } =
      req.body;

    if (!username || !password || !fullname || !role) {
      return res.status(400).json({
        success: false,
        message: "กรุณาระบุชื่อผู้ใช้ รหัสผ่าน ชื่อเต็ม และบทบาท",
      });
    }

    // ตรวจสอบว่าชื่อผู้ใช้ซ้ำหรือไม่
    const checkUser = await pool.query(
      "SELECT * FROM admin_users WHERE username = $1",
      [username]
    );

    if (checkUser.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: "ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว",
      });
    }

    // เข้ารหัสรหัสผ่าน
    const passwordHash = await bcrypt.hash(password, 10);

    // บันทึกข้อมูลผู้ใช้
    const insertResult = await pool.query(
      `INSERT INTO admin_users 
      (username, password_hash, fullname, email, role, department, faculty) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING id, username, fullname, email, role, department, faculty, created_at`,
      [
        username,
        passwordHash,
        fullname,
        email || "",
        role,
        department || "",
        faculty || "",
      ]
    );

    // บันทึกประวัติการทำงาน
    await pool.query("SELECT log_action($1, $2, $3, $4)", [
      "create_admin_user",
      `สร้างผู้ใช้งานระบบ "${username}" (${role}) สำเร็จ`,
      req.session.user.id,
      req.ip,
    ]);

    return res.json({
      success: true,
      message: "สร้างผู้ใช้งานระบบสำเร็จ",
      user: insertResult.rows[0],
    });
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการสร้างผู้ใช้งานระบบ:", error);

    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการสร้างผู้ใช้งานระบบ กรุณาลองใหม่อีกครั้ง",
    });
  }
});

// API สำหรับการจัดการผู้ใช้งานระบบ
app.get("/api/admin-users", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, fullname, email, role, department, faculty, created_at, last_login, status
      FROM admin_users
      ORDER BY id`
    );

    return res.json({
      success: true,
      users: result.rows,
    });
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้งานระบบ:", error);

    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้งานระบบ กรุณาลองใหม่อีกครั้ง",
    });
  }
});

// API รายงานสรุปการเข้าร่วมกิจกรรมตามช่วงเวลา
app.get("/api/reports/attendance-summary", requireAuth, async (req, res) => {
  try {
    const { startDate, endDate, faculty, department } = req.query;

    let sqlQuery = `
      WITH event_data AS (
        SELECT 
          e.id,
          e.event_name,
          e.event_type,
          e.start_time,
          COUNT(a.id) as total_attendees,
          COUNT(*) FILTER (WHERE a.status = 'present') as present_count,
          COUNT(*) FILTER (WHERE a.status = 'late') as late_count,
          COUNT(*) FILTER (WHERE a.status = 'absent') as absent_count,
          COUNT(*) FILTER (WHERE a.status = 'excused') as excused_count
        FROM events e
        LEFT JOIN attendance_records a ON e.id = a.event_id
        WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (startDate) {
      sqlQuery += ` AND e.start_time >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      sqlQuery += ` AND e.start_time <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (faculty) {
      sqlQuery += ` AND e.faculty = $${paramIndex}`;
      params.push(faculty);
      paramIndex++;
    }

    if (department) {
      sqlQuery += ` AND e.department = $${paramIndex}`;
      params.push(department);
      paramIndex++;
    }

    sqlQuery += `
        GROUP BY e.id, e.event_name, e.event_type, e.start_time
      )
      SELECT * FROM event_data
      ORDER BY start_time DESC
    `;

    const result = await pool.query(sqlQuery, params);

    return res.json({
      success: true,
      report: result.rows,
    });
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการดึงข้อมูลรายงาน:", error);

    return res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงข้อมูลรายงาน กรุณาลองใหม่อีกครั้ง",
    });
  }
});

// API รายงานการเข้าร่วมกิจกรรมรายบุคคล
app.get("/api/reports/student-attendance", requireAuth, async (req, res) => {
  try {
    const { studentId, startDate, endDate } = req.query;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "กรุณาระบุรหัสนักศึกษา",
      });
    }

    let sqlQuery = `
      SELECT 
        e.id as event_id,
        e.event_name,
        e.event_type,
        e.start_time,
        e.end_time,
        a.check_in_time,
        a.check_out_time,
        a.status,
        a.notes
      FROM events e
      INNER JOIN attendance_records a ON e.id = a.event_id
      WHERE a.student_id = $1
    `;

    const params = [studentId];
    let paramIndex = 2;

    if (startDate) {
      sqlQuery += ` AND e.start_time >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      sqlQuery += ` AND e.start_time <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    sqlQuery += " ORDER BY e.start_time DESC";

    const attendanceResult = await pool.query(sqlQuery, params);

    // ดึงข้อมูลนักศึกษา
    const studentResult = await pool.query(
      `SELECT * FROM student_details WHERE student_id = $1`,
      [studentId]
    );

    const studentInfo =
      studentResult.rowCount > 0
        ? studentResult.rows[0]
        : { student_id: studentId };

    return res.json({
      success: true,
      student: studentInfo,
      attendance: attendanceResult.rows,
    });
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการดึงข้อมูลการเข้าร่วมของนักศึกษา:", error);

    return res.status(500).json({
      success: false,
      message:
        "เกิดข้อผิดพลาดในการดึงข้อมูลการเข้าร่วมของนักศึกษา กรุณาลองใหม่อีกครั้ง",
    });
  }
});

// Static routes สำหรับหน้าต่างๆ
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/scan", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "scanner.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/events", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "events.html"));
});

app.get("/reports", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "reports.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// เริ่มต้น Server
app.listen(port, () => {
  console.log(`เซิร์ฟเวอร์กำลังทำงานที่พอร์ต ${port}`);
});
