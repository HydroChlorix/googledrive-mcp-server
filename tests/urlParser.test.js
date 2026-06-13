const { parseDriveUrl } = require('../src/urlParser');

describe('parseDriveUrl', () => {
  // Test case helper with different protocol and www prefixes
  const generateUrlVariations = (urlBody) => [
    `https://${urlBody}`,
    `http://${urlBody}`,
    urlBody,
    `https://www.${urlBody}`,
    `http://www.${urlBody}`,
    `www.${urlBody}`
  ];

  describe('Valid URL Patterns', () => {
    const testId = '1h8d_xJyL_B3z-Uu-SAMPLE-ID_99';

    // 1. drive.google.com/file/d/{id}/view
    it('should extract file ID from drive.google.com/file/d/{id}/view', () => {
      const variations = generateUrlVariations(`drive.google.com/file/d/${testId}/view`);
      variations.forEach(url => {
        expect(parseDriveUrl(url)).toBe(testId);
      });
    });

    // 2. drive.google.com/open?id={id}
    it('should extract file ID from drive.google.com/open?id={id}', () => {
      const variations = generateUrlVariations(`drive.google.com/open?id=${testId}`);
      variations.forEach(url => {
        expect(parseDriveUrl(url)).toBe(testId);
      });
    });

    // 3. docs.google.com/document/d/{id}/edit
    it('should extract file ID from docs.google.com/document/d/{id}/edit', () => {
      const variations = generateUrlVariations(`docs.google.com/document/d/${testId}/edit`);
      variations.forEach(url => {
        expect(parseDriveUrl(url)).toBe(testId);
      });
    });

    // 4. docs.google.com/spreadsheets/d/{id}/edit
    it('should extract file ID from docs.google.com/spreadsheets/d/{id}/edit', () => {
      const variations = generateUrlVariations(`docs.google.com/spreadsheets/d/${testId}/edit`);
      variations.forEach(url => {
        expect(parseDriveUrl(url)).toBe(testId);
      });
    });

    // 5. docs.google.com/presentation/d/{id}/edit
    it('should extract file ID from docs.google.com/presentation/d/{id}/edit', () => {
      const variations = generateUrlVariations(`docs.google.com/presentation/d/${testId}/edit`);
      variations.forEach(url => {
        expect(parseDriveUrl(url)).toBe(testId);
      });
    });
  });

  describe('Query Parameter Stripping', () => {
    const testId = '1a2b3c4d5e6f7g8h9i0j';

    it('should strip query parameters (e.g. ?usp=sharing) and extract correct ID', () => {
      expect(parseDriveUrl(`https://docs.google.com/document/d/${testId}/edit?usp=sharing`)).toBe(testId);
      expect(parseDriveUrl(`docs.google.com/spreadsheets/d/${testId}/edit?usp=drivesdk&authuser=0`)).toBe(testId);
      expect(parseDriveUrl(`https://drive.google.com/file/d/${testId}/view?usp=sharing`)).toBe(testId);
    });

    it('should preserve only the id parameter for open?id={id} and strip others', () => {
      expect(parseDriveUrl(`https://drive.google.com/open?id=${testId}&usp=sharing`)).toBe(testId);
      expect(parseDriveUrl(`drive.google.com/open?usp=sharing&id=${testId}&authuser=1`)).toBe(testId);
    });

    it('should strip hash fragments', () => {
      expect(parseDriveUrl(`https://docs.google.com/document/d/${testId}/edit#heading=h.123`)).toBe(testId);
      expect(parseDriveUrl(`https://drive.google.com/file/d/${testId}/view#page=2`)).toBe(testId);
    });
  });

  describe('Casing and Trailing Slashes', () => {
    const testId = 'CasingTestId123';

    it('should match patterns case-insensitively for static parts but preserve case of file ID', () => {
      expect(parseDriveUrl(`docs.google.com/document/d/${testId}/EDIT`)).toBe(testId);
      expect(parseDriveUrl(`docs.google.com/spreadsheets/d/${testId}/edit/`)).toBe(testId);
      expect(parseDriveUrl(`drive.google.com/FILE/d/${testId}/VIEW`)).toBe(testId);
    });

    it('should trim surrounding whitespace from URL', () => {
      expect(parseDriveUrl(`   https://drive.google.com/file/d/${testId}/view   `)).toBe(testId);
    });
  });

  describe('Rejection Scenarios (Error Throwing)', () => {
    // A. Bare File IDs
    it('should reject bare file IDs with a descriptive error', () => {
      const bareIds = [
        '1h8d_xJyL_B3z-Uu-SAMPLE-ID',
        '12345',
        'a',
        'some_file_id_without_dots_or_slashes'
      ];
      bareIds.forEach(id => {
        expect(() => parseDriveUrl(id)).toThrow('Bare file ID provided. A full Google Drive URL is required.');
      });
    });

    // B. Folder URLs
    it('should reject folder URLs with a descriptive error', () => {
      const folderUrls = [
        'https://drive.google.com/drive/folders/12345',
        'drive.google.com/drive/folders/1a2b3c?usp=sharing',
        'https://drive.google.com/drive/u/0/folders/abc-123',
        'drive.google.com/drive/folders/some-folder/view'
      ];
      folderUrls.forEach(url => {
        expect(() => parseDriveUrl(url)).toThrow('Folder URLs are not supported. Only file URLs can be parsed.');
      });
    });

    // C. Non-Google-Drive URLs
    it('should reject non-Google-Drive URLs with a descriptive error', () => {
      const nonGoogleUrls = [
        'https://dropbox.com/s/12345/file.txt',
        'https://google.com',
        'https://gmail.com/mail',
        'https://example.com/file/d/123/view',
        'drive.google.com.attacker.com/file/d/123/view'
      ];
      nonGoogleUrls.forEach(url => {
        expect(() => parseDriveUrl(url)).toThrow('Non-Google-Drive URL provided. Only Google Drive and Google Docs URLs are supported.');
      });
    });

    // D. Invalid formats / Malformed URL inputs
    it('should reject malformed and invalid inputs with descriptive errors', () => {
      const invalidInputs = [
        '',
        '   ',
        'http://',
        'docs.google.com',
        'drive.google.com/invalidpath',
        'docs.google.com/document/d/123', // missing /edit
        'drive.google.com/file/d/123',     // missing /view
        'drive.google.com/open'            // missing id param
      ];
      invalidInputs.forEach(input => {
        expect(() => parseDriveUrl(input)).toThrow();
      });
    });

    it('should reject non-string inputs', () => {
      expect(() => parseDriveUrl(null)).toThrow('URL must be a string.');
      expect(() => parseDriveUrl(undefined)).toThrow('URL must be a string.');
      expect(() => parseDriveUrl(12345)).toThrow('URL must be a string.');
      expect(() => parseDriveUrl({})).toThrow('URL must be a string.');
    });
  });
});
