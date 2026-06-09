# ADR 0001: Strict Zero Key Enforcement

## Status
Accepted

## Context
โปรเจกต์ Google Drive MCP Server ต้องการยกระดับความปลอดภัย (Security Posture) โดยการยกเลิกการใช้ Long-lived Service Account JSON Keys อย่างถาวร (Zero Key Policy) เพื่อลดความเสี่ยงจากการที่ Credential รั่วไหล และเปลี่ยนไปใช้ Keyless Authentication (ADC/WIF) แทน

แม้ว่า Google Auth Library มาตรฐานจะยอมรับทั้งไฟล์ JSON และ Keyless Config แต่เพื่อป้องกันความผิดพลาดจากมนุษย์ (Human Error) ที่อาจแอบใช้ JSON Key ในเครื่อง Local หรือ Production เราจึงต้องการมาตรการบังคับใช้ที่เข้มงวด

## Decision
เราจะระบุ Logic ในระดับ Runtime ของ MCP Server เพื่อตรวจสอบ Credential Configuration ก่อนเริ่มทำงาน:
1. หากมีการระบุ `GOOGLE_APPLICATION_CREDENTIALS` ให้ทำการโหลดไฟล์มาตรวจสอบ Content
2. หากพบ Field `"private_key"` (ซึ่งบ่งบอกว่าเป็น Service Account JSON Key) ให้ตัว Server ทำการสั่ง Shutdown ทันที (Terminate)
3. แจ้ง Error Message ที่ชัดเจนว่า "การใช้ JSON Key ขัดต่อข้อกำหนดความปลอดภัยของโปรเจกต์ โปรดใช้ ADC หรือ WIF เท่านั้น"

## Consequences
- **Positive:** มั่นใจได้ 100% ว่าไม่มีการใช้ JSON Key ในระบบ และเป็นไปตาม Compliance ขององค์กร
- **Negative:** ผู้พัฒนาที่คุ้นเคยกับการใช้ไฟล์ JSON แบบเดิมอาจจะพบความไม่สะดวกในช่วงแรก และต้องเสียเวลาตั้งค่า ADC (Impersonation)
- **Neutral:** ต้องมีการเขียน Code ส่วนการตรวจสอบไฟล์ Credential เพิ่มเติมใน Server Setup phase
