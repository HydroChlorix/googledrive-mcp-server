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
 * Fetches a Drive file's metadata and exports its content as plain text.
 *
 * Used by both `getFileContent` (which adds a Root Folder membership check)
 * and the upcoming `get_file_from_url` tool (ADR-0005), which skips that check.
 *
 * @param {object} drive An authenticated googleapis drive client.
 * @param {string} fileId The Drive file ID to fetch.
 * @returns {Promise<{mimeType: string, name: string, parents: string[], content: string}>}
 *   The file's metadata plus its exported/streamed content.
 */
async function fetchAndExportContent(drive, fileId) {
  // Step 1: fetch metadata (mimeType drives export vs raw download)
  const metaRes = await drive.files.get({
    fileId: fileId,
    fields: 'mimeType, name, parents',
  });
  const mimeType = metaRes.data.mimeType;
  const name = metaRes.data.name;
  const parents = metaRes.data.parents || [];

  // Step 3: ADR 0003 Auto-Text Export for Google Workspace files, raw download otherwise
  let content;
  if (mimeType.startsWith('application/vnd.google-apps.')) {
    const exportRes = await drive.files.export({
      fileId: fileId,
      mimeType: 'text/plain',
    });
    content = typeof exportRes.data === 'string' ? exportRes.data : JSON.stringify(exportRes.data);
  } else {
    const getRes = await drive.files.get({
      fileId: fileId,
      alt: 'media',
    });
    content = typeof getRes.data === 'string' ? getRes.data : JSON.stringify(getRes.data);
  }

  return { mimeType, name, parents, content };
}

/**
 * Retrieves file content, automatically exporting Google Workspace files as plain text.
 *
 * Performs an ADR-0002 Root Folder membership check before delegating metadata +
 * content retrieval to the shared `fetchAndExportContent` helper.
 *
 * @param {string} fileId The ID of the file to read.
 * @param {string} identity The user identity from the token (for logging).
 * @returns {Promise<string>} The file content.
 */
async function getFileContent(fileId, identity) {
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  console.error(`[Audit] User ${identity || 'Unknown'} executing get_file_content for fileId: ${fileId}`);

  const drive = await getDriveClient();

  // ADR 0002: perform Root Folder check BEFORE delegating to the helper.
  // We do our own metadata fetch here so that an out-of-folder file never
  // has its content streamed into memory by the helper.
  const guardRes = await drive.files.get({
    fileId: fileId,
    fields: 'mimeType, name, parents',
  });
  const parents = guardRes.data.parents || [];
  if (rootFolderId && !parents.includes(rootFolderId)) {
    throw new Error('Access Denied: File is outside the designated Root Folder.');
  }

  // Delegate the metadata + content work to the shared helper.
  return await fetchAndExportContent(drive, fileId).then((r) => r.content);
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
  fetchAndExportContent,
  createFile,
  updateFile,
  getIdentity
};
