import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 1. ระบุสภาพแวดล้อม
    environment: "node",

    // 2. ปิด Globals (Strict Mode ตาม ESM)
    // ทำให้ต้อง import { describe, it, expect } จาก 'vitest' ในไฟล์เทสต์เสมอ
    globals: false,

    // 3. กำหนดโฟลเดอร์สำหรับเทสต์
    include: ["tests/**/*.test.ts"],

    // 4. ไฟล์ที่ต้องรันก่อนเริ่มเทสต์ (ถ้ามี Mock หรือ Environment config)
    setupFiles: ["./tests/setup.ts"],

    // 5. การตั้งค่ารายงาน Coverage
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts", // ไม่ต้องนับ Entry point
        "src/**/*.d.ts", // ไม่ต้องนับไฟล์ Type definition
      ],
    },

    // 6. การจัดการเมื่อเกิด Error
    bail: 1, // เหมาะสำหรับ CI/CD: หากเทสต์พัง 1 ตัว ให้หยุดรันทั้งหมดทันที
  },
});
