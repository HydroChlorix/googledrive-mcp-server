// tests/setup.ts
// ไฟล์นี้จะถูกรัน 1 ครั้งก่อนที่ Unit Test ทั้งหมดจะเริ่มทำงาน
// มักใช้สำหรับเตรียม Environment Variables จำลอง หรือ Mock ฟังก์ชันที่เรียกใช้ Network

process.env.NODE_ENV = "test";
// ตัวอย่าง: จำลอง API Key เพื่อไม่ให้เทสต์พลาดไปเรียกใช้ของจริง
// process.env.GOOGLE_DRIVE_API_KEY = 'mock-key-for-testing';
