const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");

// Mock auth.js, tools.js, urlParser.js
const mockGetDriveClient = jest.fn();
jest.mock('../src/auth.js', () => ({
  getDriveClient: mockGetDriveClient
}));

const mockSearchFiles = jest.fn();
const mockGetFileContent = jest.fn();
const mockFetchDriveFileContent = jest.fn();
const mockCreateFile = jest.fn();
const mockUpdateFile = jest.fn();
const mockGetIdentity = jest.fn().mockResolvedValue('test-user@example.com');

jest.mock('../src/tools.js', () => ({
  searchFiles: mockSearchFiles,
  getFileContent: mockGetFileContent,
  fetchDriveFileContent: mockFetchDriveFileContent,
  createFile: mockCreateFile,
  updateFile: mockUpdateFile,
  getIdentity: mockGetIdentity
}));

const mockParseDriveUrl = jest.fn();
jest.mock('../src/urlParser.js', () => ({
  parseDriveUrl: mockParseDriveUrl
}));

// We need to capture the handlers registered by index.js
let listToolsHandler;
let callToolHandler;

const mockServerInstance = {
  setRequestHandler: jest.fn((schema, handler) => {
    if (schema === ListToolsRequestSchema) {
      listToolsHandler = handler;
    } else if (schema === CallToolRequestSchema) {
      callToolHandler = handler;
    }
  }),
  connect: jest.fn().mockResolvedValue(undefined)
};

jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => mockServerInstance)
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn().mockImplementation(() => ({}))
}));

// Suppress normal server logs during testing
jest.mock('../src/logger.js', () => ({
  info: jest.fn(),
  error: jest.fn()
}));

describe('Index.js MCP Server End-to-End Integration', () => {
  let consoleErrorSpy;

  beforeAll(async () => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetDriveClient.mockResolvedValue({});
    // Requiring index.js will execute main() and register the handlers
    require('../index.js');
    // Wait for the async main() function to register handlers
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should register get_file_from_url tool in ListToolsRequestSchema', async () => {
    expect(listToolsHandler).toBeDefined();
    const result = await listToolsHandler();
    const tool = result.tools.find(t => t.name === 'get_file_from_url');
    expect(tool).toBeDefined();
    expect(tool.description).toContain('Read the content of a file using its Google Drive or Google Docs URL');
    expect(tool.inputSchema.properties.url).toBeDefined();
    expect(tool.inputSchema.required).toContain('url');
  });

  it('should handle get_file_from_url call tool request successfully', async () => {
    expect(callToolHandler).toBeDefined();
    const testUrl = 'https://docs.google.com/document/d/12345/edit';
    const testFileId = '12345';
    const testContent = 'Hello URL file content';

    mockParseDriveUrl.mockReturnValue(testFileId);
    mockFetchDriveFileContent.mockResolvedValue(testContent);

    const response = await callToolHandler({
      params: {
        name: 'get_file_from_url',
        arguments: { url: testUrl }
      }
    });

    expect(mockParseDriveUrl).toHaveBeenCalledWith(testUrl);
    expect(mockFetchDriveFileContent).toHaveBeenCalledWith(testFileId, 'test-user@example.com');
    expect(consoleErrorSpy).toHaveBeenCalledWith('[Audit] User test-user@example.com executing get_file_from_url for URL: ' + testUrl);
    expect(response).toEqual({
      content: [{ type: 'text', text: testContent }]
    });
  });

  it('should return isError when url parsing fails', async () => {
    expect(callToolHandler).toBeDefined();
    const testUrl = 'invalid-url';

    mockParseDriveUrl.mockImplementation(() => {
      throw new Error('Bare file ID provided. A full Google Drive URL is required.');
    });

    const response = await callToolHandler({
      params: {
        name: 'get_file_from_url',
        arguments: { url: testUrl }
      }
    });

    expect(response).toEqual({
      content: [{ type: 'text', text: 'Error: Bare file ID provided. A full Google Drive URL is required.' }],
      isError: true
    });
  });

  it('should return isError when file fetching fails', async () => {
    expect(callToolHandler).toBeDefined();
    const testUrl = 'https://docs.google.com/document/d/12345/edit';
    const testFileId = '12345';

    mockParseDriveUrl.mockReturnValue(testFileId);
    mockFetchDriveFileContent.mockRejectedValue(new Error('Drive API error'));

    const response = await callToolHandler({
      params: {
        name: 'get_file_from_url',
        arguments: { url: testUrl }
      }
    });

    expect(response).toEqual({
      content: [{ type: 'text', text: 'Error: Drive API error' }],
      isError: true
    });
  });
});
