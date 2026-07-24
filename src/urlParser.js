/**
 * Parses a Google Drive or Google Docs URL and extracts the file ID.
 * Supports the following patterns:
 * - drive.google.com/file/d/{id}/view
 * - drive.google.com/open?id={id}
 * - docs.google.com/document/d/{id}/edit
 * - docs.google.com/spreadsheets/d/{id}/edit
 * - docs.google.com/presentation/d/{id}/edit
 *
 * Rejects bare file IDs, folder URLs, non-Google-Drive URLs, and invalid formats.
 * Strips query parameters before parsing/extracting.
 *
 * @param {string} url - The URL to parse.
 * @returns {string} The extracted Google Drive File ID.
 * @throws {Error} Clear, descriptive error if the URL is invalid or unsupported.
 */
function parseDriveUrl(url) {
  if (typeof url !== 'string') {
    throw new Error('URL must be a string.');
  }

  const cleanInput = url.trim();
  if (!cleanInput) {
    throw new Error('Empty URL provided.');
  }

  // Reject bare file IDs: only valid file ID characters, no URL elements like dots or slashes
  if (/^[a-zA-Z0-9_-]+$/.test(cleanInput)) {
    throw new Error('Bare file ID provided. A full Google Drive URL is required.');
  }

  // Reject inputs that obviously lack URL components
  if (!cleanInput.includes('.') || !cleanInput.includes('/')) {
    throw new Error('Invalid URL format. A full Google Drive URL is required.');
  }

  // Normalize URL by prepending protocol if missing
  let normalizedUrl = cleanInput;
  if (!/^[a-zA-Z0-9+.-]+:\/\//.test(normalizedUrl)) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  let urlObj;
  try {
    urlObj = new URL(normalizedUrl);
  } catch (err) {
    throw new Error('Invalid URL format: unable to parse URL.');
  }

  let hostname = urlObj.hostname.toLowerCase();
  if (hostname.startsWith('www.')) {
    hostname = hostname.substring(4);
  }

  // Validate hostname
  if (hostname !== 'drive.google.com' && hostname !== 'docs.google.com') {
    throw new Error('Non-Google-Drive URL provided. Only Google Drive and Google Docs URLs are supported.');
  }

  // Reject folder URLs
  const pathname = urlObj.pathname;
  if (pathname.includes('/folders/') || pathname.includes('/drive/folders/')) {
    throw new Error('Folder URLs are not supported. Only file URLs can be parsed.');
  }

  // Strip query parameters before parsing/extracting
  const pathLower = pathname.toLowerCase().replace(/\/$/, '');
  if (pathLower === '/open') {
    const idVal = urlObj.searchParams.get('id');
    urlObj.search = '';
    if (idVal) {
      urlObj.searchParams.set('id', idVal);
    }
  } else {
    urlObj.search = '';
  }
  urlObj.hash = ''; // Clear hash fragment as well

  const cleanPathname = urlObj.pathname;
  let fileId = null;

  if (hostname === 'drive.google.com') {
    if (cleanPathname.toLowerCase().replace(/\/$/, '') === '/open') {
      fileId = urlObj.searchParams.get('id');
    } else {
      const match = cleanPathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)\/view\/?$/i);
      if (match) {
        fileId = match[1];
      }
    }
  } else if (hostname === 'docs.google.com') {
    const docMatch = cleanPathname.match(/^\/document\/d\/([a-zA-Z0-9_-]+)\/edit\/?$/i);
    const sheetMatch = cleanPathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)\/edit\/?$/i);
    const presMatch = cleanPathname.match(/^\/presentation\/d\/([a-zA-Z0-9_-]+)\/edit\/?$/i);

    if (docMatch) {
      fileId = docMatch[1];
    } else if (sheetMatch) {
      fileId = sheetMatch[1];
    } else if (presMatch) {
      fileId = presMatch[1];
    }
  }

  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    throw new Error('Unsupported Google Drive URL pattern.');
  }

  return fileId;
}

module.exports = {
  parseDriveUrl
};
