const { searchFiles, getFileContent, getFileFromUrl, fetchAndExportContent, createFile, updateFile, getIdentity } = require('../src/tools');
const { getDriveClient } = require('../src/auth');

jest.mock('../src/auth', () => ({
  getDriveClient: jest.fn()
}));

describe('Tools', () => {
  let originalEnv;
  let mockDriveFilesList;
  let mockDriveFilesGet;
  let mockDriveFilesExport;
  let mockDriveFilesCreate;
  let mockDriveFilesUpdate;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockDriveFilesList = jest.fn().mockResolvedValue({ data: { files: [] } });
    mockDriveFilesGet = jest.fn();
    mockDriveFilesExport = jest.fn();
    mockDriveFilesCreate = jest.fn();
    mockDriveFilesUpdate = jest.fn();
    
    getDriveClient.mockResolvedValue({
      files: { 
        list: mockDriveFilesList,
        get: mockDriveFilesGet,
        export: mockDriveFilesExport,
        create: mockDriveFilesCreate,
        update: mockDriveFilesUpdate
      }
    });
    
    // Mock console.error for audit logs
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('searchFiles', () => {
    it('should throw an error if GOOGLE_DRIVE_ROOT_FOLDER_ID is missing', async () => {
      delete process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
      await expect(searchFiles("name contains 'test'")).rejects.toThrow('GOOGLE_DRIVE_ROOT_FOLDER_ID is not set in environment variables.');
    });

    it('should inject root folder ID into the query (ADR 0002)', async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-123';
      await searchFiles("name contains 'test'", 'user@example.com');
      
      expect(mockDriveFilesList).toHaveBeenCalledWith({
        q: "(name contains 'test') and 'root-123' in parents",
        fields: 'files(id, name, mimeType, modifiedTime)',
        spaces: 'drive',
      });
    });

    it('should log the operation with identity (ADR 0004)', async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-123';
      await searchFiles("name contains 'test'", 'user@example.com');
      
      expect(console.error).toHaveBeenCalledWith("[Audit] User user@example.com executing search_files with isolated query: (name contains 'test') and 'root-123' in parents");
    });
  });

  describe('getFileContent', () => {
    it('should export Google Workspace files as text/plain (ADR 0003)', async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-123';
      // 1st: guard fetch for Root Folder check. 2nd: helper's metadata fetch.
      mockDriveFilesGet.mockResolvedValueOnce({ data: { mimeType: 'application/vnd.google-apps.document', name: 'Doc', parents: ['root-123'] } });
      mockDriveFilesGet.mockResolvedValueOnce({ data: { mimeType: 'application/vnd.google-apps.document', name: 'Doc', parents: ['root-123'] } });
      mockDriveFilesExport.mockResolvedValueOnce({ data: 'workspace content' });
      
      const content = await getFileContent('file-123', 'user@example.com');
      
      expect(mockDriveFilesGet).toHaveBeenCalledWith({ fileId: 'file-123', fields: 'mimeType, name, parents' });
      expect(mockDriveFilesExport).toHaveBeenCalledWith({ fileId: 'file-123', mimeType: 'text/plain' });
      expect(content).toBe('workspace content');
    });

    it('should throw error if file is outside root folder (ADR 0002) — throws before helper is called', async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-123';
      mockDriveFilesGet.mockResolvedValueOnce({ data: { mimeType: 'text/plain', name: 'File', parents: ['wrong-folder'] } });
      
      await expect(getFileContent('file-999', 'user@example.com')).rejects.toThrow('Access Denied: File is outside the designated Root Folder.');
      // Guard fetch is the only get call — helper must not run when check fails.
      expect(mockDriveFilesGet).toHaveBeenCalledTimes(1);
      expect(mockDriveFilesExport).not.toHaveBeenCalled();
    });

    it('should get standard files directly using alt=media', async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-123';
      // Guard + helper-meta, then alt=media for content.
      mockDriveFilesGet.mockResolvedValueOnce({ data: { mimeType: 'text/plain', name: 'File', parents: ['root-123'] } });
      mockDriveFilesGet.mockResolvedValueOnce({ data: { mimeType: 'text/plain', name: 'File', parents: ['root-123'] } });
      mockDriveFilesGet.mockResolvedValueOnce({ data: 'standard content' });
      
      const content = await getFileContent('file-456', 'user@example.com');
      
      expect(mockDriveFilesGet).toHaveBeenNthCalledWith(1, { fileId: 'file-456', fields: 'mimeType, name, parents' });
      expect(mockDriveFilesGet).toHaveBeenNthCalledWith(2, { fileId: 'file-456', fields: 'mimeType, name, parents' });
      expect(mockDriveFilesGet).toHaveBeenNthCalledWith(3, { fileId: 'file-456', alt: 'media' });
      expect(content).toBe('standard content');
    });

    it('should log the operation with identity (ADR 0004)', async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-123';
      mockDriveFilesGet.mockResolvedValueOnce({ data: { mimeType: 'text/plain', name: 'File', parents: ['root-123'] } });
      mockDriveFilesGet.mockResolvedValueOnce({ data: { mimeType: 'text/plain', name: 'File', parents: ['root-123'] } });
      mockDriveFilesGet.mockResolvedValueOnce({ data: 'standard content' });
      
      await getFileContent('file-789', 'user@example.com');
      
      expect(console.error).toHaveBeenCalledWith("[Audit] User user@example.com executing get_file_content for fileId: file-789");
    });
  });

  describe('fetchAndExportContent (shared helper)', () => {
    it('should export Google Workspace files as text/plain and return metadata + content', async () => {
      mockDriveFilesGet.mockResolvedValueOnce({
        data: { mimeType: 'application/vnd.google-apps.spreadsheet', name: 'Sheet1', parents: ['root-123'] },
      });
      mockDriveFilesExport.mockResolvedValueOnce({ data: 'sheet,content\n1,2\n' });

      const drive = await getDriveClient();
      const result = await fetchAndExportContent(drive, 'sheet-abc');

      expect(mockDriveFilesGet).toHaveBeenCalledWith({
        fileId: 'sheet-abc',
        fields: 'mimeType, name, parents',
      });
      expect(mockDriveFilesExport).toHaveBeenCalledWith({
        fileId: 'sheet-abc',
        mimeType: 'text/plain',
      });
      expect(result).toEqual({
        mimeType: 'application/vnd.google-apps.spreadsheet',
        name: 'Sheet1',
        parents: ['root-123'],
        content: 'sheet,content\n1,2\n',
      });
    });

    it('should use alt=media for standard text files and return metadata + content', async () => {
      mockDriveFilesGet.mockResolvedValueOnce({
        data: { mimeType: 'text/plain', name: 'notes.md', parents: ['other-folder'] },
      });
      mockDriveFilesGet.mockResolvedValueOnce({ data: '# notes' });

      const drive = await getDriveClient();
      const result = await fetchAndExportContent(drive, 'notes-xyz');

      expect(mockDriveFilesGet).toHaveBeenNthCalledWith(1, {
        fileId: 'notes-xyz',
        fields: 'mimeType, name, parents',
      });
      expect(mockDriveFilesGet).toHaveBeenNthCalledWith(2, {
        fileId: 'notes-xyz',
        alt: 'media',
      });
      expect(result.mimeType).toBe('text/plain');
      expect(result.name).toBe('notes.md');
      expect(result.parents).toEqual(['other-folder']);
      expect(result.content).toBe('# notes');
    });

    it('should default parents to empty array when not present in metadata', async () => {
      mockDriveFilesGet.mockResolvedValueOnce({
        data: { mimeType: 'text/plain', name: 'orphan.txt' }, // no parents field
      });
      mockDriveFilesGet.mockResolvedValueOnce({ data: 'orphan content' });

      const drive = await getDriveClient();
      const result = await fetchAndExportContent(drive, 'orphan-1');

      expect(result.parents).toEqual([]);
      expect(result.content).toBe('orphan content');
    });

    it('should JSON.stringify non-string export payloads (defensive)', async () => {
      mockDriveFilesGet.mockResolvedValueOnce({
        data: { mimeType: 'application/vnd.google-apps.document', name: 'Doc', parents: ['root-123'] },
      });
      mockDriveFilesExport.mockResolvedValueOnce({ data: { unexpected: 'object' } });

      const drive = await getDriveClient();
      const result = await fetchAndExportContent(drive, 'doc-7');

      expect(result.content).toBe('{"unexpected":"object"}');
    });
  });

  describe('createFile', () => {
    it('should create file in the root folder with specified content', async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-123';
      mockDriveFilesCreate.mockResolvedValueOnce({ data: { id: 'new-file-id' } });
      
      const result = await createFile('new.txt', 'hello world', 'text/plain', 'user@example.com');
      
      expect(mockDriveFilesCreate).toHaveBeenCalledWith({
        requestBody: { name: 'new.txt', mimeType: 'text/plain', parents: ['root-123'] },
        media: { mimeType: 'text/plain', body: 'hello world' },
        fields: 'id, name, mimeType'
      });
      expect(result.id).toBe('new-file-id');
    });
  });

  describe('updateFile', () => {
    it('should update file content if in root folder', async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-123';
      mockDriveFilesGet.mockResolvedValueOnce({ data: { parents: ['root-123'] } });
      mockDriveFilesUpdate.mockResolvedValueOnce({ data: { id: 'file-123' } });
      
      const result = await updateFile('file-123', 'new content', 'user@example.com');
      
      expect(mockDriveFilesGet).toHaveBeenCalledWith({ fileId: 'file-123', fields: 'parents' });
      expect(mockDriveFilesUpdate).toHaveBeenCalledWith({
        fileId: 'file-123',
        media: { body: 'new content' },
        fields: 'id, name, modifiedTime'
      });
      expect(result.id).toBe('file-123');
    });

    it('should throw error if updating file outside root folder (ADR 0002)', async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-123';
      mockDriveFilesGet.mockResolvedValueOnce({ data: { parents: ['wrong-folder'] } });
      
      await expect(updateFile('file-999', 'hack', 'user@example.com')).rejects.toThrow('Access Denied: File is outside the designated Root Folder.');
    });
  });

  describe('getFileFromUrl', () => {
    it('should extract fileId from a Drive URL and return content (ADR 0003 + 0005)', async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-123';
      // fetchAndExportContent does metadata fetch + alt=media for plain text files.
      mockDriveFilesGet.mockResolvedValueOnce({
        data: { mimeType: 'text/plain', name: 'notes.md', parents: ['some-other-folder'] },
      });
      mockDriveFilesGet.mockResolvedValueOnce({ data: 'shared content' });

      const url = 'https://drive.google.com/file/d/abc123def456/view?usp=sharing';
      const content = await getFileFromUrl(url, 'user@example.com');

      expect(content).toBe('shared content');
      expect(mockDriveFilesGet).toHaveBeenNthCalledWith(1, {
        fileId: 'abc123def456',
        fields: 'mimeType, name, parents',
      });
    });

    it('should NOT perform Root Folder check — file outside root still resolves (ADR 0005)', async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-123';
      // parents is intentionally some other folder; getFileContent would reject this.
      mockDriveFilesGet.mockResolvedValueOnce({
        data: { mimeType: 'text/plain', name: 'external.txt', parents: ['external-folder'] },
      });
      mockDriveFilesGet.mockResolvedValueOnce({ data: 'external content' });

      const url = 'https://drive.google.com/file/d/ext999xyz/view';
      const content = await getFileFromUrl(url, 'user@example.com');

      expect(content).toBe('external content');
    });

    it('should auto-export Google Workspace files as text/plain (ADR 0003)', async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-123';
      mockDriveFilesGet.mockResolvedValueOnce({
        data: { mimeType: 'application/vnd.google-apps.document', name: 'Doc', parents: ['some-folder'] },
      });
      mockDriveFilesExport.mockResolvedValueOnce({ data: 'workspace text' });

      const url = 'https://docs.google.com/document/d/doc-id-abc/edit';
      const content = await getFileFromUrl(url, 'user@example.com');

      expect(mockDriveFilesExport).toHaveBeenCalledWith({ fileId: 'doc-id-abc', mimeType: 'text/plain' });
      expect(content).toBe('workspace text');
    });

    it('should strip query params and hash from URL before resolving fileId', async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-123';
      mockDriveFilesGet.mockResolvedValueOnce({
        data: { mimeType: 'text/plain', name: 'f.txt', parents: [] },
      });
      mockDriveFilesGet.mockResolvedValueOnce({ data: 'q' });

      const url = 'https://drive.google.com/file/d/qfile1/view?usp=sharing&token=abc#gid=0';
      await getFileFromUrl(url, 'user@example.com');

      expect(mockDriveFilesGet).toHaveBeenNthCalledWith(1, {
        fileId: 'qfile1',
        fields: 'mimeType, name, parents',
      });
    });

    it('should audit-log the URL, fileId, and identity (ADR 0004)', async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-123';
      mockDriveFilesGet.mockResolvedValueOnce({
        data: { mimeType: 'text/plain', name: 'f.txt', parents: [] },
      });
      mockDriveFilesGet.mockResolvedValueOnce({ data: 'c' });

      const url = 'https://drive.google.com/file/d/audit-id-7/view';
      await getFileFromUrl(url, 'alice@corp.com');

      expect(console.error).toHaveBeenCalledWith(
        '[Audit] User alice@corp.com executing get_file_from_url for url: https://drive.google.com/file/d/audit-id-7/view (resolved fileId: audit-id-7)'
      );
    });

    it('should throw a clear error on an invalid URL (not crash)', async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-123';
      await expect(
        getFileFromUrl('not-a-url', 'user@example.com')
      ).rejects.toThrow(/Expected a (full )?Google Drive URL/);
      // Drive API must not be called when URL parsing fails.
      expect(mockDriveFilesGet).not.toHaveBeenCalled();
      expect(mockDriveFilesExport).not.toHaveBeenCalled();
    });

    it('should throw a clear error on a bare file ID (URL-Gated Access)', async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-123';
      await expect(
        getFileFromUrl('1AbCdEfGhIjKlMnOpQrStUvWxYz', 'user@example.com')
      ).rejects.toThrow(/URL-Gated Access/);
    });

    it('should reject folder URLs with a clear error', async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-123';
      await expect(
        getFileFromUrl('https://drive.google.com/drive/folders/folder-abc', 'user@example.com')
      ).rejects.toThrow(/Folder URLs are not supported/);
    });

    it('should wrap a 403 API error with actionable guidance', async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-123';
      const apiErr = Object.assign(new Error('Insufficient Permission'), { code: 403 });
      mockDriveFilesGet.mockRejectedValueOnce(apiErr);

      await expect(
        getFileFromUrl('https://drive.google.com/file/d/forbidden-id/view', 'user@example.com')
      ).rejects.toThrow(/Access Denied: Service Account cannot read fileId forbidden-id/);
    });

    it('should wrap a 404 API error with actionable guidance', async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-123';
      const apiErr = Object.assign(new Error('File not found'), { code: 404 });
      mockDriveFilesGet.mockRejectedValueOnce(apiErr);

      await expect(
        getFileFromUrl('https://drive.google.com/file/d/missing-id/view', 'user@example.com')
      ).rejects.toThrow(/File Not Found: fileId missing-id/);
    });

    it('should re-throw non-403/404 API errors unchanged', async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-123';
      const apiErr = Object.assign(new Error('Internal Server Error'), { code: 500 });
      mockDriveFilesGet.mockRejectedValueOnce(apiErr);

      await expect(
        getFileFromUrl('https://drive.google.com/file/d/boom-id/view', 'user@example.com')
      ).rejects.toThrow('Internal Server Error');
    });
  });
});