const { searchFiles, getFileContent, fetchDriveFileContent, createFile, updateFile, getIdentity } = require('../src/tools');
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
      mockDriveFilesGet.mockResolvedValueOnce({ data: { mimeType: 'application/vnd.google-apps.document', name: 'Doc', parents: ['root-123'] } });
      mockDriveFilesExport.mockResolvedValueOnce({ data: 'workspace content' });
      
      const content = await getFileContent('file-123', 'user@example.com');
      
      expect(mockDriveFilesGet).toHaveBeenCalledWith({ fileId: 'file-123', fields: 'mimeType, name, parents' });
      expect(mockDriveFilesExport).toHaveBeenCalledWith({ fileId: 'file-123', mimeType: 'text/plain' });
      expect(content).toBe('workspace content');
    });

    it('should throw error if file is outside root folder (ADR 0002)', async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-123';
      mockDriveFilesGet.mockResolvedValueOnce({ data: { mimeType: 'text/plain', name: 'File', parents: ['wrong-folder'] } });
      
      await expect(getFileContent('file-999', 'user@example.com')).rejects.toThrow('Access Denied: File is outside the designated Root Folder.');
    });

    it('should get standard files directly using alt=media', async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-123';
      mockDriveFilesGet.mockResolvedValueOnce({ data: { mimeType: 'text/plain', name: 'File', parents: ['root-123'] } });
      mockDriveFilesGet.mockResolvedValueOnce({ data: 'standard content' });
      
      const content = await getFileContent('file-456', 'user@example.com');
      
      expect(mockDriveFilesGet).toHaveBeenNthCalledWith(1, { fileId: 'file-456', fields: 'mimeType, name, parents' });
      expect(mockDriveFilesGet).toHaveBeenNthCalledWith(2, { fileId: 'file-456', alt: 'media' });
      expect(content).toBe('standard content');
    });

    it('should log the operation with identity (ADR 0004)', async () => {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-123';
      mockDriveFilesGet.mockResolvedValueOnce({ data: { mimeType: 'text/plain', name: 'File', parents: ['root-123'] } });
      mockDriveFilesGet.mockResolvedValueOnce({ data: 'standard content' });
      
      await getFileContent('file-789', 'user@example.com');
      
      expect(console.error).toHaveBeenCalledWith("[Audit] User user@example.com executing get_file_content for fileId: file-789");
    });
  });

  describe('fetchDriveFileContent', () => {
    it('should export Google Workspace files as text/plain (ADR 0003) and not check root folder isolation', async () => {
      mockDriveFilesGet.mockResolvedValueOnce({ data: { mimeType: 'application/vnd.google-apps.document', name: 'Doc', parents: ['outside-root'] } });
      mockDriveFilesExport.mockResolvedValueOnce({ data: 'workspace content' });
      
      const content = await fetchDriveFileContent('file-123', 'user@example.com');
      
      expect(mockDriveFilesGet).toHaveBeenCalledWith({ fileId: 'file-123', fields: 'mimeType, name, parents' });
      expect(mockDriveFilesExport).toHaveBeenCalledWith({ fileId: 'file-123', mimeType: 'text/plain' });
      expect(content).toBe('workspace content');
    });

    it('should get standard files directly using alt=media and not check root folder isolation', async () => {
      mockDriveFilesGet.mockResolvedValueOnce({ data: { mimeType: 'text/plain', name: 'File', parents: ['outside-root'] } });
      mockDriveFilesGet.mockResolvedValueOnce({ data: 'standard content' });
      
      const content = await fetchDriveFileContent('file-456', 'user@example.com');
      
      expect(mockDriveFilesGet).toHaveBeenNthCalledWith(1, { fileId: 'file-456', fields: 'mimeType, name, parents' });
      expect(mockDriveFilesGet).toHaveBeenNthCalledWith(2, { fileId: 'file-456', alt: 'media' });
      expect(content).toBe('standard content');
    });

    it('should use pre-fetched metadata if provided to avoid metadata get API call', async () => {
      mockDriveFilesGet.mockResolvedValueOnce({ data: 'standard content' });
      
      const preFetched = { mimeType: 'text/plain', name: 'File', parents: ['outside-root'] };
      const content = await fetchDriveFileContent('file-456', 'user@example.com', preFetched);
      
      expect(mockDriveFilesGet).toHaveBeenCalledWith({ fileId: 'file-456', alt: 'media' });
      expect(mockDriveFilesGet).not.toHaveBeenCalledWith({ fileId: 'file-456', fields: 'mimeType, name, parents' });
      expect(content).toBe('standard content');
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
});