# Context: Google Drive MCP Server Integration

## Glossary

### Service Account
A Google Cloud identity intended for automated workflows and server-to-server interactions. In this project, it is authenticated using Keyless methods (ADC/WIF) to bypass User OAuth requirements while maintaining a Zero Key Policy.

### Root Folder
The designated Google Drive folder (identified by `GOOGLE_DRIVE_ROOT_FOLDER_ID`) that serves as the isolated workspace for the MCP server. All operations are restricted to this folder and its sub-directories.

### Keyless Authentication
สถาปัตยกรรมการยืนยันตัวตนที่ไม่ใช้ไฟล์ Private Key JSON โดยเปลี่ยนไปใช้ ADC (สำหรับ Local) หรือ WIF (สำหรับ Production) เพื่อเพิ่มความปลอดภัย และลดความเสี่ยง Credential หลุดรอด

### Service Account Impersonation
กระบวนการที่ User (ผู้พัฒนา) ใช้สิทธิ์ของตัวเองเพื่อขอ Short-lived Access Token ในนามของ Service Account โดยต้องมีสิทธิ์ `roles/iam.serviceAccountTokenCreator`

### Transparent ADC
กลยุทธ์การใช้งาน Application Default Credentials โดยที่โค้ดของ MCP Server ไม่ต้องระบุอีเมล Service Account หรือโหลดไฟล์ Key โดยตรง แต่จะใช้ Identity ที่ถูกตั้งค่าไว้ใน Environment (เช่น ผ่าน gcloud impersonation) อย่างโปร่งใส

### Strict Zero Key Enforcement
มาตรการความปลอดภัยระดับ Runtime ที่ MCP Server จะตรวจสอบ Credential Configuration และปฏิเสธการทำงานทันทีหากพบว่ามีการใช้ Long-lived Private Key (JSON Key) เพื่อให้เป็นไปตาม Zero Key Policy

### Specific WIF Identity Mapping
มาตรการความปลอดภัยในระดับ Identity Provider ที่จะอนุญาตให้เฉพาะ Workload จากต้นทางที่ระบุ (เช่น เฉพาะ branch: main หรือ specific environment) เท่านั้นที่สามารถแลกเปลี่ยน Token เพื่อใช้งาน Service Account ได้

### Search Query Injection
เทคนิคการกักบริเวณ (Isolation) โดยที่ MCP Server จะเติมเงื่อนไข `'<ROOT_FOLDER_ID>' in parents` เข้าไปในทุกคำสั่งค้นหาของ Google Drive API โดยอัตโนมัติ เพื่อบังคับให้ผลลัพธ์จำกัดอยู่เพียงภายใต้ Root Folder เท่านั้น

### Explicit Auth Feedback
กลยุทธ์การจัดการ Error ที่ MCP Server จะส่ง Message ที่ชัดเจนและเป็น Actionable กลับไปยัง AI Agent เมื่อการ Auth ล้มเหลว เพื่อให้ Agent สามารถแจ้ง User ให้รันคำสั่ง gcloud เพื่อต่ออายุ Token ได้อย่างถูกต้อง

### User-Friendly Auth Errors
กลยุทธ์การจัดการ Error ที่ MCP Server จะให้คำแนะนำขั้นตอนการแก้ไข (เช่น คำสั่ง gcloud ที่ต้องรัน) เมื่อตรวจพบว่าการยืนยันตัวตนล้มเหลว หรือ Token หมดอายุ

### Auto-Text Export
กลยุทธ์การจัดการไฟล์ประเภท Google Workspace (Docs, Sheets, Slides) โดยที่ MCP Server จะทำการแปลงเนื้อหาเป็น `text/plain` โดยอัตโนมัติเมื่อมีการเรียกใช้ `get_file_content` เพื่อให้ AI Agent สามารถประมวลผลเนื้อหาได้ทันทีโดยไม่ต้องจัดการเรื่อง Export MIME types เอง

### Identity-Rich Logs
กลยุทธ์การบันทึก Log ที่รวมข้อมูล Identity ของผู้ใช้งานจริง (User Email) ที่ทำการ Impersonate Service Account ในขณะนั้น เพื่อให้สามารถตรวจสอบย้อนหลัง (Audit) ได้ว่าการกระทำต่างๆ ใน Google Drive เกิดขึ้นโดยใคร

### Local MCP Server
The `mcp-google-drive` package executed locally within the environment (WSL/Ubuntu) using `npx`. It translates MCP tool calls into Google Drive API requests.

### Core Tools
The server provides the following tools (mapped from PRD requirements):
* `search_files` (PRD: `drive_search`)
* `get_file_content` (PRD: `drive_read_file`)
* `create_file` (PRD: `drive_create_file`)
* `update_file` (PRD: `drive_update_file`)

### Editor Permission
The specific Google Drive sharing level granted to the Service Account's email address by the folder owner. This permission is necessary for the server to perform file creation and updates.

### Principle of Least Privilege
The security practice of ensuring the Service Account has no global IAM roles in Google Cloud Console, with access restricted solely through Drive-level folder sharing.
