
# Product Requirement Document (PRD)

## Project Title
**Keyless Authentication via Workload Identity Federation (WIF) & ADC for Google Drive MCP Server**

## 1. Objective
ยกระดับความปลอดภัย (Security Posture) ของระบบ Google Drive MCP Server โดยการ **ยกเลิกการใช้งาน Long-lived Service Account Key (ไฟล์ JSON)** อย่างถาวร และเปลี่ยนไปใช้สถาปัตยกรรม Keyless Authentication ผ่าน **Workload Identity Federation (WIF)** สำหรับ Environment ภายนอก (เช่น CI/CD, AWS, GitHub Actions) และ **Service Account Impersonation (ADC)** สำหรับการรันบนเครื่อง Local Development เพื่อลดความเสี่ยงที่ Credential จะหลุดรอด

## 2. Architecture & Components
การยืนยันตัวตนจะถูกแบ่งออกเป็น 2 รูปแบบตาม Environment ที่รัน MCP Server:

* **Local Development (Windows/Ubuntu WSL):**
    * **Mechanism:** Application Default Credentials (ADC) + Service Account Impersonation
    * **Tool:** Google Cloud CLI (`gcloud`)
    * **Token Type:** Short-lived Access Token (1-hour lifespan) แบบ Auto-refresh ผ่าน Google Auth Library

* **Production / External Server (e.g., GitHub Actions, AWS):**
    * **Mechanism:** Workload Identity Federation (WIF)
    * **Components:** Workload Identity Pool, Identity Provider (IdP), Attribute Mapping
    * **Token Exchange:** External Token -> Google Security Token Service (STS) -> Short-lived Access Token

## 3. Security & IAM Requirements
* **Zero Key Policy:** ห้ามมีการสร้าง (Create Key) หรือดาวน์โหลดไฟล์ Private Key JSON จากหน้า Service Account โดยเด็ดขาด
* **Role Requirements (Local):** บัญชี Google Account ของผู้พัฒนา (Owner) ต้องมีสิทธิ์ `roles/iam.serviceAccountTokenCreator` เพื่อใช้ในการสวมรอย (Impersonate) บัญชีบริการ
* **Role Requirements (Production WIF):** Identity ของระบบภายนอก (เช่น GitHub Repository) จะต้องได้รับอนุญาตผ่าน Pool ให้สามารถทำ `Workload Identity User` กับ Service Account ปลายทางได้

## 4. Implementation Steps (Infrastructure & Config)

### Phase 1: Local Development Setup (Impersonation)
1.  ติดตั้ง `gcloud` CLI ในสภาพแวดล้อมที่รัน MCP (เช่น ภายใน Ubuntu WSL)
2.  ผู้พัฒนาทำการล็อกอินและผูกสิทธิ์เข้ากับ Service Account ด้วยคำสั่ง:
    ```bash
    gcloud auth application-default login --impersonate-service-account="<SERVICE_ACCOUNT_EMAIL>"
    ```
3.  **MCP Config Update:** ลบตัวแปร `GOOGLE_APPLICATION_CREDENTIALS` ออกจากไฟล์ Configuration ของเครื่อง Local อย่างถาวร เพื่อบังคับให้ Node.js Library วิ่งไปใช้ ADC Token ที่ได้จากคำสั่งด้านบน

### Phase 2: Production Setup (WIF)
1.  สร้าง **Workload Identity Pool** บน Google Cloud IAM
2.  สร้าง **Provider** ภายใน Pool (ระบุประเภท IdP เช่น OIDC, AWS) พร้อมกำหนด Issuer URL
3.  กำหนด **Attribute Mapping** (เช่น `google.subject` = `assertion.sub`)
4.  ผูกสิทธิ์ (Grant Access) ให้ Principal จาก Pool สามารถใช้ Service Account ได้
5.  ดาวน์โหลดไฟล์ **Credential Configuration** (ไฟล์บอกเส้นทาง WIF ซึ่งไม่มี Private Key) นำไปวางใน Server ภายนอก
6.  **MCP Config Update (Production):** กำหนดตัวแปร Environment ให้ชี้ไปยังไฟล์ Config นั้น:
    ```bash
    GOOGLE_APPLICATION_CREDENTIALS="/path/to/wif-credential-config.json"
    ```

## 5. Target MCP Server Configuration (Environment Agnostic)

เพื่อรองรับทั้ง 2 Environment ตัว MCP Server (เช่น Gemini CLI หรือ Hermes) จะต้องถูกตั้งค่าให้รันด้วยคำสั่งพื้นฐาน โดยการจัดการ Auth จะถูกผลักภาระไปที่ Environment Variables (หรือการไม่มีอยู่ของมัน) ดังนี้:

```yaml
mcpServers:
  googledrive:
    command: "npx"
    args: 
      - "-y"
      - "mcp-google-drive" # หรือแพ็กเกจที่รองรับ
    env:
      # [CRITICAL] สำหรับเครื่อง Local ให้ 'ลบ' บรรทัดนี้ทิ้งไปเลย
      # สำหรับ Production ให้ชี้ไปยังไฟล์ wif-credential-config.json
      GOOGLE_APPLICATION_CREDENTIALS: "${GOOGLE_APPLICATION_CREDENTIALS_PATH_IF_ANY}"
      
      # รหัส Folder ปลายทางที่อนุญาตให้เขียนไฟล์ได้
      GOOGLE_DRIVE_ROOT_FOLDER_ID: "${GOOGLE_DRIVE_ROOT_FOLDER_ID}"

```

## 6. Acceptance Criteria

1. **Local Test:** สามารถรันคำสั่ง `gemini chat` (หรือรัน Agent) บนเครื่อง Local และอ่าน/เขียนไฟล์ลง Google Drive ได้สำเร็จ โดยที่ในเครื่องไม่มีไฟล์ Service Account JSON Key อยู่เลย
2. **Auto-Refresh Test:** Token ชั่วคราวต้องสามารถต่ออายุตัวเองได้ (Auto-refresh) เมื่อปล่อย Session ทิ้งไว้เกิน 1 ชั่วโมง โดยที่ MCP Server ไม่เกิด Error 401 Unauthorized
3. **Production Test (ถ้ามี):** สามารถรัน MCP Server บนระบบภายนอกได้โดยใช้เพียงไฟล์ WIF Credential Config



