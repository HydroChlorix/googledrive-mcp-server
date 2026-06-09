# ADR 0002: Root Folder Isolation via Search Query Injection

## Status
Accepted

## Context
Google Drive API อนุญาตให้ทำ "Global Search" ซึ่งอาจทำให้ AI Agent มองเห็นหรือแก้ไขไฟล์ที่อยู่นอกขอบเขต (Scope) ของโปรเจกต์ได้ หากมีเพียงการแชร์ไฟล์ในระดับ Service Account แม้ว่าเราจะจำกัดสิทธิ์ระดับ IAM แล้วก็ตาม แต่การป้องกันในระดับ Logic (Client-side) จะช่วยลดความเสี่ยงจากการที่ Agent พยายามเขียน Query ที่กว้างเกินไป

## Decision
เราจะบังคับใช้มาตรการ Isolation ในระดับ MCP Server ด้วยเทคนิค **Search Query Injection**:
1. ทุกการเรียกใช้เครื่องมือ `search_files` จะต้องมีการเติม String เงื่อนไข `'<ROOT_FOLDER_ID>' in parents` เข้าไปใน Parameter `q` (Query) ของ Google Drive API โดยอัตโนมัติ
2. ระบบจะไม่เปิดโอกาสให้ AI Agent ระบุขอบเขตการค้นหาที่อยู่นอกเหนือจาก Root Folder นี้
3. สำหรับคำสั่ง `get_file_content` และ `update_file` ตัว Server จะทำการตรวจสอบเบื้องต้นว่า File ID นั้นๆ อยู่ภายใต้ Root Folder หรือไม่ ก่อนจะดำเนินงานต่อ

## Consequences
- **Positive:** ป้องกัน AI Agent เข้าถึงข้อมูลที่ไม่เกี่ยวข้อง (Data Leakage) แม้จะมีความผิดพลาดในการเขียน prompt
- **Negative:** หากต้องการย้าย Root Folder จะต้องรีสตาร์ท MCP Server ใหม่พร้อมค่า Config ใหม่เสมอ
- **Neutral:** ต้องมีการจัดการ String Manipulation ในส่วนของ Query Builder ในโค้ด
