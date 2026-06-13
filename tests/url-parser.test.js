const { extractFileId } = require('../src/url-parser');

describe('URL Parser — extractFileId', () => {
  describe('accepts all 5 documented URL patterns', () => {
    it('parses drive.google.com/file/d/{id}/view', () => {
      expect(extractFileId('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWx/view'))
        .toBe('1AbCdEfGhIjKlMnOpQrStUvWx');
    });

    it('parses drive.google.com/open?id={id}', () => {
      expect(extractFileId('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWx'))
        .toBe('1AbCdEfGhIjKlMnOpQrStUvWx');
    });

    it('parses docs.google.com/document/d/{id}/edit', () => {
      expect(extractFileId('https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWx/edit'))
        .toBe('1AbCdEfGhIjKlMnOpQrStUvWx');
    });

    it('parses docs.google.com/spreadsheets/d/{id}/edit', () => {
      expect(extractFileId('https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWx/edit'))
        .toBe('1AbCdEfGhIjKlMnOpQrStUvWx');
    });

    it('parses docs.google.com/presentation/d/{id}/edit', () => {
      expect(extractFileId('https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOpQrStUvWx/edit'))
        .toBe('1AbCdEfGhIjKlMnOpQrStUvWx');
    });
  });

  describe('ignores query parameters and fragments', () => {
    it('strips ?usp=sharing from /file/d/ pattern', () => {
      expect(extractFileId('https://drive.google.com/file/d/abc123/view?usp=sharing'))
        .toBe('abc123');
    });

    it('strips trailing query string with multiple params from /open pattern', () => {
      expect(extractFileId('https://drive.google.com/open?id=abc123&usp=sharing&mcp_token=secret'))
        .toBe('abc123');
    });

    it('puts id= first in /open pattern', () => {
      expect(extractFileId('https://drive.google.com/open?usp=sharing&id=abc123'))
        .toBe('abc123');
    });

    it('strips #gid=0 fragment from /spreadsheets pattern', () => {
      expect(extractFileId('https://docs.google.com/spreadsheets/d/abc123/edit#gid=0'))
        .toBe('abc123');
    });

    it('strips both query and fragment from /document pattern', () => {
      expect(extractFileId('https://docs.google.com/document/d/abc123/edit?usp=sharing#heading=h.abc'))
        .toBe('abc123');
    });
  });

  describe('handles URL variants and edge cases', () => {
    it('accepts http:// (not just https://)', () => {
      expect(extractFileId('http://drive.google.com/file/d/abc123/view'))
        .toBe('abc123');
    });

    it('accepts uppercase scheme (case-insensitive)', () => {
      expect(extractFileId('HTTPS://drive.google.com/file/d/abc123/view'))
        .toBe('abc123');
    });

    it('accepts trailing slash on path', () => {
      expect(extractFileId('https://drive.google.com/file/d/abc123/'))
        .toBe('abc123');
    });

    it('accepts extra path segments after id', () => {
      expect(extractFileId('https://drive.google.com/file/d/abc123/view/extra/path'))
        .toBe('abc123');
    });

    it('trims leading and trailing whitespace', () => {
      expect(extractFileId('   https://drive.google.com/file/d/abc123/view   '))
        .toBe('abc123');
    });

    it('accepts IDs with hyphens and underscores', () => {
      expect(extractFileId('https://drive.google.com/file/d/abc-123_XYZ_/view'))
        .toBe('abc-123_XYZ_');
    });
  });

  describe('rejects non-URL input (URL-Gated Access)', () => {
    it('rejects bare file ID', () => {
      expect(() => extractFileId('1AbCdEfGhIjKlMnOpQrStUvWx'))
        .toThrow(/full Google Drive URL.*URL-Gated Access/);
    });

    it('rejects bare ID even with whitespace', () => {
      expect(() => extractFileId('  abc123  '))
        .toThrow(/full Google Drive URL.*URL-Gated Access/);
    });

    it('rejects empty string', () => {
      expect(() => extractFileId(''))
        .toThrow(/Expected a Google Drive URL/);
    });

    it('rejects whitespace-only string', () => {
      expect(() => extractFileId('   '))
        .toThrow(/Expected a Google Drive URL/);
    });

    it('rejects null', () => {
      expect(() => extractFileId(null))
        .toThrow(/Expected a Google Drive URL/);
    });

    it('rejects undefined', () => {
      expect(() => extractFileId(undefined))
        .toThrow(/Expected a Google Drive URL/);
    });

    it('rejects non-string types', () => {
      expect(() => extractFileId(123)).toThrow(/Expected a Google Drive URL/);
      expect(() => extractFileId({})).toThrow(/Expected a Google Drive URL/);
      expect(() => extractFileId([])).toThrow(/Expected a Google Drive URL/);
      expect(() => extractFileId(true)).toThrow(/Expected a Google Drive URL/);
    });
  });

  describe('rejects folder URLs (out of scope)', () => {
    it('rejects drive.google.com/drive/folders/{id}', () => {
      expect(() => extractFileId('https://drive.google.com/drive/folders/abc123'))
        .toThrow(/Folder URLs are not supported/);
    });

    it('rejects drive.google.com/drive/folders/{id}?usp=sharing', () => {
      expect(() => extractFileId('https://drive.google.com/drive/folders/abc123?usp=sharing'))
        .toThrow(/Folder URLs are not supported/);
    });
  });

  describe('rejects non-Google-Drive URLs', () => {
    it('rejects example.com URL', () => {
      expect(() => extractFileId('https://example.com/file/d/abc123/view'))
        .toThrow(/Expected a Google Drive URL/);
    });

    it('rejects dropbox.com URL', () => {
      expect(() => extractFileId('https://www.dropbox.com/s/abc123/file?dl=0'))
        .toThrow(/Expected a Google Drive URL/);
    });

    it('rejects google.com (wrong subdomain)', () => {
      expect(() => extractFileId('https://www.google.com/file/d/abc123/view'))
        .toThrow(/Expected a Google Drive URL/);
    });

    it('rejects drive.google.evil.com (lookalike)', () => {
      expect(() => extractFileId('https://drive.google.evil.com/file/d/abc123/view'))
        .toThrow(/Expected a Google Drive URL/);
    });

    it('rejects a URL with the right shape but wrong host prefix', () => {
      expect(() => extractFileId('https://notdrive.google.com/file/d/abc123/view'))
        .toThrow(/Expected a Google Drive URL/);
    });
  });
});
