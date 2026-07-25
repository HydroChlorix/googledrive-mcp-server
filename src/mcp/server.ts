import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// นำเข้าฟังก์ชันแกนกลาง (เพิ่ม createFolder, downloadFile เข้ามา)
import { createFolder, downloadFile, listFiles, uploadTextFile } from "../core/drive.js";

// 1. กำหนด Zod Schema สำหรับตรวจสอบ Input ที่ Agent จะส่งเข้ามา
const ListFilesArgsSchema = z.object({
  pageSize: z.number().min(1).max(100).optional(),
  query: z.string().optional(),
});

const UploadTextFileArgsSchema = z.object({
  name: z.string().min(1, "File name is required"),
  content: z.string().min(1, "File content cannot be empty"),
  parentId: z.string().optional(),
});

// เพิ่ม Schema ใหม่อีก 2 ตัว
const CreateFolderArgsSchema = z.object({
  name: z.string().min(1, "Folder name is required"),
  parentId: z.string().optional(),
});

const DownloadFileArgsSchema = z.object({
  fileId: z.string().min(1, "File ID is required"),
  destPath: z.string().min(1, "Destination path (Local) is required"),
});

export const server: Server = new Server(
  {
    name: "googledrive-mcp-server",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// 2. ประกาศ Tools ให้ Agent รู้ว่าเราทำอะไรได้บ้าง (ส่งเป็น JSON Schema)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "drive_list_files",
        description:
          "List files in Google Drive. You can specify pageSize (max 100) and a search query.",
        inputSchema: {
          type: "object",
          properties: {
            pageSize: { type: "number", description: "Number of files to return (default 10)" },
            query: {
              type: "string",
              description: 'Google Drive search query string (e.g. name contains "report")',
            },
          },
        },
      },
      {
        name: "drive_upload_text_file",
        description: "Upload a text file to Google Drive",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the file" },
            content: { type: "string", description: "Text content of the file" },
            parentId: { type: "string", description: "Optional ID of the parent folder" },
          },
          required: ["name", "content"],
        },
      },
      {
        name: "drive_create_folder",
        description: "Create a new folder in Google Drive",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the new folder" },
            parentId: { type: "string", description: "Optional ID of the parent folder" },
          },
          required: ["name"],
        },
      },
      {
        name: "drive_download_file",
        description:
          "Download a binary or regular file from Google Drive to the local file system (Note: Cannot download Google Docs/Sheets directly).",
        inputSchema: {
          type: "object",
          properties: {
            fileId: { type: "string", description: "ID of the file to download" },
            destPath: {
              type: "string",
              description: "Local destination path (e.g. ./downloads/image.jpg)",
            },
          },
          required: ["fileId", "destPath"],
        },
      },
    ],
  };
});

// 3. จัดการเมื่อ Agent เรียกใช้งาน Tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // ---------------------------------------------------------
    // Tool: List Files
    // ---------------------------------------------------------
    if (name === "drive_list_files") {
      // Zod จะตรวจสอบ args และแปลง Type ให้เป็นรูปแบบที่ถูกต้อง (parsedArgs)
      const parsedArgs = ListFilesArgsSchema.parse(args || {});
      const files = await listFiles(parsedArgs);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(files, null, 2),
          },
        ],
      };
    }

    // ---------------------------------------------------------
    // Tool: Upload Text File
    // ---------------------------------------------------------
    if (name === "drive_upload_text_file") {
      const parsedArgs = UploadTextFileArgsSchema.parse(args);
      const file = await uploadTextFile(parsedArgs.name, parsedArgs.content, parsedArgs.parentId);

      return {
        content: [
          {
            type: "text",
            text: `✅ Successfully uploaded file:\n${JSON.stringify(file, null, 2)}`,
          },
        ],
      };
    }

    // ---------------------------------------------------------
    // Tool: Create Folder
    // ---------------------------------------------------------
    if (name === "drive_create_folder") {
      const parsedArgs = CreateFolderArgsSchema.parse(args);
      const folder = await createFolder(parsedArgs.name, parsedArgs.parentId);

      return {
        content: [
          {
            type: "text",
            text: `✅ Successfully created folder:\n${JSON.stringify(folder, null, 2)}`,
          },
        ],
      };
    }

    // ---------------------------------------------------------
    // Tool: Download File
    // ---------------------------------------------------------
    if (name === "drive_download_file") {
      const parsedArgs = DownloadFileArgsSchema.parse(args);
      const savedPath = await downloadFile(parsedArgs.fileId, parsedArgs.destPath);

      return {
        content: [
          {
            type: "text",
            text: `✅ Successfully downloaded file to local path:\n${savedPath}`,
          },
        ],
      };
    }

    throw new Error(`Tool not found: ${name}`);
  } catch (error) {
    // 4. ระบบจัดการ Error ที่ฉลาดขึ้น: แจ้ง Agent หากส่งข้อมูลมาผิด Format
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
      return {
        isError: true, // บอก Agent ว่าทำงานไม่สำเร็จ
        content: [{ type: "text", text: `❌ Validation Error: ${errorMessages}` }],
      };
    }

    // Error ทั่วไป (เช่น เน็ตหลุด, API Token หมดอายุ)
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `❌ Execution Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
});

export async function startMcpServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🚀 Google Drive MCP Server v2.0.0 is running on stdio");
}
