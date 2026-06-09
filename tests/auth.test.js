const { google } = require('googleapis');
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
  it('should initialize GoogleAuth without explicit credentials (relying on ADC)', async () => {
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
});
