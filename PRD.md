# Product Requirement Document (PRD)

## Project Title
**Local Google Drive MCP Server Integration via Service Account for Gemini CLI**

## 1. Objective
ต้องการเปลี่ยนผ่านสถาปัตยกรรมจากเดิมที่ใช้ Cloud-Hosted Remote MCP (ซึ่งติดข้อจำกัดด้าน User OAuth) มาเป็นการรัน **Local MCP Server** บนเครื่องคอมพิวเตอร์ผ่านการเรียกคำสั่ง (Command Execution) สำหรับ **Gemini CLI** โดยใช้ **Service Account (JSON Key)** ในการยืนยันตัวตน เพื่อให้ระบบสามารถทำงานได้แบบอัตโนมัติ (Headless/Autonomous Workflow) โดยไม่ต้องพึ่งพาการยืนยันตัวตนผ่านเว็บเบราว์เซอร์

## 2. Architecture & Components
* **MCP Client:** Gemini CLI (รันอยู่ใน Local Environment เช่น Windows 11 หรือ Ubuntu WSL)
* **Local MCP Server:** `mcp-google-drive` (ทำงานผ่าน Node.js Runtime)
* **Authentication:** Google Cloud Service Account (JWT ผ่านไฟล์ Private Key JSON)
* **Target API:** Standard Google Drive API v3 (ไม่ใช่ Drive MCP API แบบ Remote)

## 3. Core Functional Requirements (Skills/Tools)
Gemini CLI ต้องสามารถเข้าถึงและใช้งานระบบจัดการไฟล์ผ่านเครื่องมือ (Tools) ทั้ง 4 ตัวนี้ได้อย่างสมบูรณ์แบบภายใต้โฟลเดอร์เป้าหมาย:
1.  **`drive_search`**: ค้นหาไฟล์หรือโฟลเดอร์ภายในขอบเขตเพื่อดึง File ID หรือ Parent Folder ID
2.  **`drive_read_file`**: อ่านเนื้อหา (Text/Data/Source) ภายในไฟล์เพื่อนำมาประมวลผล
3.  **`drive_create_file`**: สร้างไฟล์ใหม่ลงในโฟลเดอร์ที่กำหนด (เช่น สรุปรายงานคอนเทนต์ หรือไฟล์ระบบ)
4.  **`drive_update_file`**: แก้ไข หรือ เพิ่มเนื้อหาต่อท้าย (Append) ลงในไฟล์เดิม

## 4. Security & Access Control (Best Practices)
* **Principle of Least Privilege:** บัญชีบริการ (Service Account) ต้อง **ไม่มีสิทธิ์ (No Roles) ใดๆ บน IAM ของ Google Cloud Console** เพื่อความปลอดภัยสูงสุด
* **Data Isolation:** สิทธิ์การเข้าถึงจะถูกจำกัดผ่านกลไกการแชร์ (Google Drive Share Permission) โดยเจ้าของโฟลเดอร์ (Owner) จะต้องแชร์สิทธิ์ระดับ **Editor** ให้แก่อีเมลของ Service Account เฉพาะโฟลเดอร์ที่กำหนดเท่านั้น

## 5. Configuration Requirements & Strict Constraints

### ⚠️ [ข้อกำชับสำคัญที่สุด] เรื่อง Path Configuration
* **ห้ามแก้ไขหรือเปลี่ยนแปลงโครงสร้าง Path เดิมที่มีอยู่แล้วในระบบเด็ดขาด** (ให้ใช้ Path เดิมที่เซ็ตอัปไว้แล้วในไฟล์คอนฟิกเดิม เนื่องจากระบบผ่านการแมปพาร์ทระหว่างสภาพแวดล้อม Windows และ WSL เรียบร้อยแล้ว)
* ตัวแปรต้นทางสำหรับเรียกใช้ Credentials จะต้องชี้ไปยัง Path ของไฟล์ JSON Key เดิมอย่างถูกต้อง

### 📄 Target Config Layout สำหรับ Gemini CLI
เมื่อทำการเขียนหรือแก้ไขไฟล์ Configuration สำหรับ Gemini CLI ให้ปรับใช้โครงสร้างการรันด้วย `command` และส่งผ่าน Environment Variables ดังนี้:

```yaml
mcpServers:
  googledrive:
    # สำหรับ Gemini CLI ให้สั่งรัน Local Server ผ่าน npx
    command: "npx"
    args: 
      - "-y"
      - "mcp-google-drive"
    env:
      # [CRITICAL] ห้ามเปลี่ยนค่า Path นี้ ให้ใช้ค่าเดิมของระบบที่ทำงานอยู่แล้ว
      GOOGLE_APPLICATION_CREDENTIALS: "<ใช้_PATH_เดิม_ของ_ระบบ>"
      
      # โฟลเดอร์รากฐานที่แชร์สิทธิ์ให้ Service Account เรียบร้อยแล้ว
      GOOGLE_DRIVE_ROOT_FOLDER_ID: "${GOOGLE_DRIVE_ROOT_FOLDER_ID}"