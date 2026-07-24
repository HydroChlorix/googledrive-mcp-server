const { getDriveClient } = require('./auth');

/**
 * Extracts identity from environment or drive client.
 */
async function getIdentity() {
  return process.env.IMPERSONATED_USER_EMAIL || 'Impersonated Service Account Session';
}

/**
 * Executes a search query in Google Drive, restricted to the Root Folder.
 * 
 * @param {string} query The search query string.
 * @param {string} identity The user identity from the token (for logging).
 * @returns {Array} List of files matching the query.
 */
async function searchFiles(query, identity) {
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootFolderId) {
    throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID is not set in environment variables.');
  }

  // ADR 0002: Root Folder Isolation
  const isolatedQuery = `(${query}) and '${rootFolderId}' in parents`;
  
  // ADR 0004: Identity-Rich Logging
  console.error(`[Audit] User ${identity || 'Unknown'} executing search_files with isolated query: ${isolatedQuery}`);

  const drive = await getDriveClient();
  const res = await drive.files.list({
    q: isolatedQuery,
    fields: 'files(id, name, mimeType, modifiedTime)',
    spaces: 'drive',
  });

  return res.data.files || [];
}

/**
 * Internal helper to fetch file metadata, perform auto-text export (ADR-0003)
 * for Google Workspace files, and read content for normal files. No Root Folder checks.
 * 
 * @param {string} fileId The ID of the file to fetch.
 * @param {string} identity The user identity from the token (for logging).
 * @param {Object} [preFetchedMeta] Optional pre-fetched file metadata.
 * @returns {Promise<string>} The file content.
 */
async function fetchDriveFileContent(fileId, identity, preFetchedMeta = null) {
  const drive = await getDriveClient();
  
  let mimeType;
  if (preFetchedMeta && preFetchedMeta.mimeType) {
    mimeType = preFetchedMeta.mimeType;
  } else {
    const metaRes = await drive.files.get({
      fileId: fileId,
      fields: 'mimeType, name, parents'
    });
    mimeType = metaRes.data.mimeType;
  }

  // ADR 0003: Auto-Text Export
  if (mimeType.startsWith('application/vnd.google-apps.')) {
    const exportRes = await drive.files.export({
      fileId: fileId,
      mimeType: 'text/plain'
    });
    return typeof exportRes.data === 'string' ? exportRes.data : JSON.stringify(exportRes.data);
  } else {
    const getRes = await drive.files.get({
      fileId: fileId,
      alt: 'media'
    });
    // Depending on the file type, getRes.data might be a stream or buffer. 
    // Assuming mostly text-based interaction for LLMs.
    return typeof getRes.data === 'string' ? getRes.data : JSON.stringify(getRes.data);
  }
}

/**
 * Retrieves file content, automatically exporting Google Workspace files as plain text.
 * Enforces Root Folder isolation.
 * 
 * @param {string} fileId The ID of the file to read.
 * @param {string} identity The user identity from the token (for logging).
 * @returns {Promise<string>} The file content.
 */
async function getFileContent(fileId, identity) {
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  console.error(`[Audit] User ${identity || 'Unknown'} executing get_file_content for fileId: ${fileId}`);
  
  const drive = await getDriveClient();
  
  // First, get file metadata to check mimeType and parents (ADR 0002)
  const metaRes = await drive.files.get({
    fileId: fileId,
    fields: 'mimeType, name, parents'
  });
  
  const parents = metaRes.data.parents || [];

  if (rootFolderId && !parents.includes(rootFolderId)) {
    throw new Error('Access Denied: File is outside the designated Root Folder.');
  }

  return fetchDriveFileContent(fileId, identity, metaRes.data);
}

/**
 * Creates a new file inside the Root Folder.
 * 
 * @param {string} name The file name.
 * @param {string} content The text content of the file.
 * @param {string} mimeType The mime type (default: text/plain).
 * @param {string} identity The user identity.
 * @returns {Object} The created file metadata.
 */
async function createFile(name, content, mimeType = 'text/plain', identity) {
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootFolderId) {
    throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID is not set in environment variables.');
  }

  console.error(`[Audit] User ${identity || 'Unknown'} executing create_file: ${name}`);

  const drive = await getDriveClient();
  const res = await drive.files.create({
    requestBody: {
      name: name,
      mimeType: mimeType,
      parents: [rootFolderId]
    },
    media: {
      mimeType: mimeType,
      body: content
    },
    fields: 'id, name, mimeType'
  });

  return res.data;
}

/**
 * Updates an existing file's content.
 * 
 * @param {string} fileId The file ID to update.
 * @param {string} content The new text content.
 * @param {string} identity The user identity.
 * @returns {Object} The updated file metadata.
 */
async function updateFile(fileId, content, identity) {
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  console.error(`[Audit] User ${identity || 'Unknown'} executing update_file for fileId: ${fileId}`);

  const drive = await getDriveClient();
  
  // ADR 0002: Verify file is in root folder before update
  const metaRes = await drive.files.get({
    fileId: fileId,
    fields: 'parents'
  });
  
  const parents = metaRes.data.parents || [];
  if (rootFolderId && !parents.includes(rootFolderId)) {
    throw new Error('Access Denied: File is outside the designated Root Folder.');
  }
  
  const res = await drive.files.update({
    fileId: fileId,
    media: {
      body: content
    },
    fields: 'id, name, modifiedTime'
  });

  return res.data;
}

module.exports = {
  searchFiles,
  getFileContent,
  fetchDriveFileContent,
  createFile,
  updateFile,
  getIdentity
};
