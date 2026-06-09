# ADR 0004: Identity-Rich Logging for Impersonated Sessions

## Status
Accepted

## Context
เมื่อมีการใช้งาน Service Account Impersonation (Keyless Auth) ผู้พัฒนาหลายคนจะเข้าถึง Google Drive ผ่าน Identity เดียวกัน (Service Account) ทำให้ Google Drive Audit Logs มาตรฐานแสดงเพียงชื่อของ Service Account เท่านั้น ซึ่งยากต่อการตรวจสอบหาตัวตนของผู้กระทำจริงในกรณีที่มีการแก้ไขไฟล์ที่ผิดพลาดหรือผิดกฎความปลอดภัย

## Decision
เราจะกำหนดให้ MCP Server มีกลยุทธ์การบันทึก Log ดังนี้:
1. ทุกการเรียกใช้เครื่องมือ (Tool Call) จะต้องมีการดึงข้อมูล Identity จาก Access Token ที่ใช้งานอยู่ (เช่น อีเมลของผู้พัฒนาที่รัน gcloud login)
2. ข้อมูล Identity นี้จะถูกนำมาบันทึกร่วมกับข้อมูลการทำงาน (Tool Name, File ID, Parameters) ในระบบ Log ของ MCP Server
3. ในระดับ Production (WIF) ระบบจะพยายามบันทึก Subject ของ External Identity Provider (เช่น GitHub Repository/Workflow URL) แทน

## Consequences
- **Positive:** เพิ่มความโปร่งใส (Accountability) ในการใช้งานทรัพยากรส่วนกลาง และช่วยให้ Debug ปัญหาได้รวดเร็วขึ้น
- **Negative:** มีการประมวลผลเพิ่มขึ้นเล็กน้อยในการดึง Identity ข้อมูล และเพิ่มขนาดของ Log
- **Neutral:** ต้องระมัดระวังเรื่องการเก็บรักษาข้อมูลส่วนบุคคล (PII) ตามนโยบาย Privacy ขององค์กร
