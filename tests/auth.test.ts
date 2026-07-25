import { google } from "googleapis";
import { beforeEach, describe, expect, it, vi } from "vitest";

// 1. Mock googleapis ให้อยู่นอกสุดเหมือนเดิม
vi.mock("googleapis", () => {
  const mockDrive = {
    files: { list: vi.fn() },
  };
  return {
    google: {
      auth: {
        GoogleAuth: vi.fn().mockImplementation(() => ({})),
      },
      drive: vi.fn().mockReturnValue(mockDrive),
    },
  };
});

describe("Auth Module", () => {
  beforeEach(() => {
    // 2. เคลียร์ประวัติการเรียก Mock ของฟังก์ชันต่างๆ
    vi.clearAllMocks();
    // 3. สำคัญ: สั่งให้ Vitest ลืมว่าเคยโหลดโมดูล auth.js ไปแล้ว (เพื่อรีเซ็ต driveClientInstance = null)
    vi.resetModules();
  });

  it("should initialize GoogleAuth and return drive client", async () => {
    // 4. ต้องใช้การ import แบบ dynamic (await import) ข้างใน Test แทน เพื่อให้มันโหลดโมดูลใหม่ทุกครั้ง
    const { getDriveClient } = await import("../src/core/auth.js");

    const client = await getDriveClient();

    expect(google.auth.GoogleAuth).toHaveBeenCalledTimes(1);
    expect(google.drive).toHaveBeenCalledWith(expect.objectContaining({ version: "v3" }));
    expect(client).toBeDefined();
  });

  it("should return the same client instance on subsequent calls (Singleton)", async () => {
    // 5. โหลดโมดูลแบบเพิ่งเริ่มต้นใหม่เอี่ยม
    const { getDriveClient } = await import("../src/core/auth.js");

    // เรียกครั้งแรก (สร้างใหม่)
    const client1 = await getDriveClient();
    // เรียกครั้งที่สอง (ดึงของเดิมที่จำไว้มาใช้)
    const client2 = await getDriveClient();

    // ยืนยันว่า GoogleAuth ถูกเรียกแค่รอบเดียวในการเรียกครั้งแรก
    expect(google.auth.GoogleAuth).toHaveBeenCalledTimes(1);
    // ยืนยันว่า client ทั้งสองตัวคือออบเจกต์เดียวกันในหน่วยความจำ
    expect(client1).toBe(client2);
  });
});
