# ADR 0003: Automatic Text Export for Google Workspace Files

## Status
Accepted

## Context
ไฟล์ประเภท Google Workspace (เช่น Google Docs, Sheets, Slides) ไม่สามารถดาวน์โหลดเนื้อหาในรูปแบบ Binary ได้โดยตรงเหมือนไฟล์ทั่วไป แต่ต้องผ่านกระบวนการ `export` พร้อมระบุ MIME Type ที่ต้องการ หากปล่อยให้ AI Agent เป็นผู้จัดการกระบวนการนี้เอง อาจเกิดความสับสนหรือ Error จากการระบุ MIME Type ที่ไม่เหมาะสม

## Decision
เราจะกำหนดให้ MCP Server มี Logic ในการจัดการไฟล์ Google Workspace ดังนี้:
1. เมื่อมีการเรียกใช้เครื่องมือ `get_file_content` ตัว Server จะตรวจสอบ Metadata ของไฟล์ก่อน
2. หากพบว่าเป็นไฟล์ประเภท Google Workspace (ตรวจจาก MIME Type ต้นทาง) ระบบจะทำการเรียก API `files.export` แทน `files.get`
3. ระบบจะบังคับ Export เป็น `text/plain` โดยอัตโนมัติ เพื่อให้ AI Agent ได้รับเนื้อหาที่พร้อมประมวลผล (Text-based)
4. สำหรับไฟล์ปกติ (Binary/Text) ระบบจะยังคงใช้กระบวนการดาวน์โหลดตามปกติ

## Consequences
- **Positive:** AI Agent ทำงานกับไฟล์ทุกประเภทบน Drive ได้อย่างสม่ำเสมอ (Consistency) และลดความซับซ้อนของ Prompt
- **Negative:** ข้อมูลประเภท Formatting (เช่น ตัวหนา, สี, ตารางที่ซับซ้อน) อาจจะสูญหายไปจากการแปลงเป็น Plain Text
- **Neutral:** ต้องเพิ่ม Logic การตรวจสอบ MIME Type และการแยกสาขา API call ในโค้ด
