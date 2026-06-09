const { google } = require('googleapis');
const fs = require('fs');
const { getDriveClient } = require('../src/auth');

jest.mock('googleapis', () => {
  const mockGetClient = jest.fn().mockResolvedValue('mock-auth-client');
  const mockGoogleAuth = jest.fn().mockImplementation(() => ({
    getClient: mockGetClient
  }));
  const mockDrive = jest.fn().mockReturnValue({
    files: { list: jest.fn() }
  });

  return {
    google: {
      auth: { GoogleAuth: mockGoogleAuth },
      drive: mockDrive
    }
  };
});

describe('Auth Client', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('should initialize GoogleAuth without explicit credentials (relying on ADC)', async () => {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const drive = await getDriveClient();
    
    expect(google.auth.GoogleAuth).toHaveBeenCalledWith({
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    
    expect(google.drive).toHaveBeenCalledWith({
      version: 'v3',
      auth: 'mock-auth-client'
    });
    
    expect(drive).toBeDefined();
    expect(typeof drive.files.list).toBe('function');
  });

  it('should throw an error if GOOGLE_APPLICATION_CREDENTIALS points to a JSON key (Zero Key Policy)', async () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/key.json';
    const mockReadFileSync = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ private_key: 'some-key' }));

    await expect(getDriveClient()).rejects.toThrow('การใช้ JSON Key ขัดต่อข้อกำหนดความปลอดภัยของโปรเจกต์ โปรดใช้ ADC หรือ WIF เท่านั้น');
    expect(mockReadFileSync).toHaveBeenCalledWith('/path/to/key.json', 'utf8');
  });

  it('should proceed if GOOGLE_APPLICATION_CREDENTIALS points to a WIF config (no private_key)', async () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/wif.json';
    const mockReadFileSync = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ type: 'external_account' }));

    const drive = await getDriveClient();
    expect(drive).toBeDefined();
    expect(mockReadFileSync).toHaveBeenCalledWith('/path/to/wif.json', 'utf8');
  });
});
