-- 1. ตารางกิจกรรม (events)
events(
    id INT PRIMARY KEY,
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
)

-- 2. ตารางบันทึกการเข้าร่วม (attendance_records)
attendance_records(
    id INT PRIMARY KEY,
    event_id INT REFERENCES events(id),
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
)

-- 3. ตารางผู้ใช้งานระบบ (admin_users)
admin_users(
    id INT PRIMARY KEY,
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
)

-- 4. ตารางประวัติการใช้งานระบบ (system_logs)
system_logs(
    id INT PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    user_id INT REFERENCES admin_users(id),
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

-- 5. ตารางข้อมูลนักศึกษา (student_details)
student_details(
    student_id VARCHAR(50) PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    faculty VARCHAR(100),
    department VARCHAR(100),
    year_level VARCHAR(20),
    enrollment_date TIMESTAMP,
    expiry_date TIMESTAMP,
    student_status VARCHAR(50),
    profile_image VARCHAR(255)
)