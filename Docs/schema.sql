-- โครงสร้างตารางสำหรับการจัดเก็บข้อมูลกิจกรรม
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    event_name VARCHAR(200) NOT NULL,
    event_type VARCHAR(50) CHECK (event_type IN ('class', 'activity', 'seminar', 'exam', 'other')),
    location VARCHAR(200),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    description TEXT,
    faculty VARCHAR(100),
    department VARCHAR(100),
    year_level VARCHAR(20),
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed'))
);

-- โครงสร้างตารางสำหรับการจัดเก็บข้อมูลการเข้าร่วมกิจกรรม
CREATE TABLE IF NOT EXISTS attendance_records (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id),
    student_id VARCHAR(50) NOT NULL,
    student_name VARCHAR(200),
    faculty VARCHAR(100),
    department VARCHAR(100),
    check_in_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    check_out_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'present' CHECK (status IN ('present', 'late', 'absent', 'excused')),
    recorded_by VARCHAR(100),
    notes TEXT,
    UNIQUE (event_id, student_id)
);

-- โครงสร้างตารางสำหรับจัดเก็บข้อมูลผู้ดูแลระบบ
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(200) NOT NULL,
    fullname VARCHAR(200),
    email VARCHAR(200),
    role VARCHAR(50) DEFAULT 'staff' CHECK (role IN ('admin', 'staff', 'teacher')),
    department VARCHAR(100),
    faculty VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

-- โครงสร้างตารางสำหรับจัดเก็บประวัติการใช้งาน
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    user_id INTEGER REFERENCES admin_users(id),
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- สร้างฟังก์ชันสำหรับบันทึกประวัติการทำงาน
CREATE OR REPLACE FUNCTION log_action(
    action_type VARCHAR(50),
    action_description TEXT,
    user_id INTEGER,
    ip VARCHAR(50)
) RETURNS void AS $$
BEGIN
    INSERT INTO system_logs (action, description, user_id, ip_address)
    VALUES (action_type, action_description, user_id, ip);
END;
$$ LANGUAGE plpgsql;
