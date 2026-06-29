const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { dbRun, dbAll, dbGet } = require('../config/db');

// Recursive helper to build subfolder path
const getFolderPath = async (folderId) => {
  const pathParts = [];
  let currentId = folderId;
  while (currentId) {
    const folder = await dbGet('SELECT * FROM folders WHERE id = ?', [currentId]);
    if (!folder) break;
    pathParts.unshift(folder.name);
    currentId = folder.parent_id;
  }
  return pathParts.join('/');
};

// Access Control Helpers
const hasFolderAccess = async (userId, folderId, ownerId) => {
  // Check if "all" resources of the owner are shared
  const allShare = await dbGet(
    'SELECT * FROM shares WHERE shared_with_id = ? AND owner_id = ? AND resource_type = "all"',
    [userId, ownerId]
  );
  if (allShare) return true;

  // Traverse folders upwards to see if any is shared
  let currentFolderId = folderId;
  while (currentFolderId) {
    const folderShare = await dbGet(
      'SELECT * FROM shares WHERE shared_with_id = ? AND resource_type = "folder" AND resource_id = ?',
      [userId, currentFolderId]
    );
    if (folderShare) return true;

    const folder = await dbGet('SELECT parent_id FROM folders WHERE id = ?', [currentFolderId]);
    if (!folder) break;
    currentFolderId = folder.parent_id;
  }
  return false;
};

const hasAccess = async (userId, resourceType, resourceId) => {
  if (resourceType === 'document') {
    const doc = await dbGet('SELECT * FROM documents WHERE id = ?', [resourceId]);
    if (!doc) return false;
    if (doc.user_id === userId) return true;

    // Check if the document itself is shared
    const directShare = await dbGet(
      'SELECT * FROM shares WHERE shared_with_id = ? AND resource_type = "document" AND resource_id = ?',
      [userId, resourceId]
    );
    if (directShare) return true;

    // Check if "all" resources of the owner are shared
    const allShare = await dbGet(
      'SELECT * FROM shares WHERE shared_with_id = ? AND owner_id = ? AND resource_type = "all"',
      [userId, doc.user_id]
    );
    if (allShare) return true;

    // Check if any parent folder of this document is shared
    if (doc.folder_id) {
      return await hasFolderAccess(userId, doc.folder_id, doc.user_id);
    }
    return false;
  } else if (resourceType === 'folder') {
    const folder = await dbGet('SELECT * FROM folders WHERE id = ?', [resourceId]);
    if (!folder) return false;
    if (folder.user_id === userId) return true;

    return await hasFolderAccess(userId, resourceId, folder.user_id);
  }
  return false;
};

const hasFolderWriteAccess = async (userId, folderId, ownerId) => {
  const allShare = await dbGet(
    'SELECT * FROM shares WHERE shared_with_id = ? AND owner_id = ? AND resource_type = "all" AND permission_level = "write"',
    [userId, ownerId]
  );
  if (allShare) return true;

  let currentFolderId = folderId;
  while (currentFolderId) {
    const folderShare = await dbGet(
      'SELECT * FROM shares WHERE shared_with_id = ? AND resource_type = "folder" AND resource_id = ? AND permission_level = "write"',
      [userId, currentFolderId]
    );
    if (folderShare) return true;

    const folder = await dbGet('SELECT parent_id FROM folders WHERE id = ?', [currentFolderId]);
    if (!folder) break;
    currentFolderId = folder.parent_id;
  }
  return false;
};

const hasWriteAccess = async (userId, resourceType, resourceId) => {
  if (resourceType === 'document') {
    const doc = await dbGet('SELECT * FROM documents WHERE id = ?', [resourceId]);
    if (!doc) return false;
    if (doc.user_id === userId) return true;

    const directShare = await dbGet(
      'SELECT * FROM shares WHERE shared_with_id = ? AND resource_type = "document" AND resource_id = ? AND permission_level = "write"',
      [userId, resourceId]
    );
    if (directShare) return true;

    const allShare = await dbGet(
      'SELECT * FROM shares WHERE shared_with_id = ? AND owner_id = ? AND resource_type = "all" AND permission_level = "write"',
      [userId, doc.user_id]
    );
    if (allShare) return true;

    if (doc.folder_id) {
      return await hasFolderWriteAccess(userId, doc.folder_id, doc.user_id);
    }
  } else if (resourceType === 'folder') {
    const folder = await dbGet('SELECT * FROM folders WHERE id = ?', [resourceId]);
    if (!folder) return false;
    if (folder.user_id === userId) return true;

    return await hasFolderWriteAccess(userId, resourceId, folder.user_id);
  }
  return false;
};

// Setup multer storage configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      let ownerUsername = req.user.username;
      let userDir = path.join(__dirname, '../../../uploads', ownerUsername);

      // Check if folderId is passed in query
      const folderId = req.query.folderId;
      if (folderId && folderId !== 'null' && folderId !== 'undefined' && folderId !== 'root') {
        const folder = await dbGet(
          'SELECT f.*, u.username FROM folders f JOIN users u ON f.user_id = u.id WHERE f.id = ?',
          [parseInt(folderId)]
        );
        if (folder) {
          ownerUsername = folder.username;
          userDir = path.join(__dirname, '../../../uploads', ownerUsername);
          const folderPath = await getFolderPath(parseInt(folderId));
          if (folderPath) {
            userDir = path.join(userDir, folderPath);
          }
        }
      }

      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      cb(null, userDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

const uploadFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  const userId = req.user.id;
  const filename = req.file.filename;
  const originalName = req.file.originalname;
  const filepath = req.file.path;
  const mimeType = req.file.mimetype;
  const folderId = req.query.folderId && req.query.folderId !== 'null' && req.query.folderId !== 'root'
    ? parseInt(req.query.folderId)
    : null;

  try {
    let ownerId = userId;
    if (folderId) {
      const folder = await dbGet('SELECT user_id FROM folders WHERE id = ?', [folderId]);
      if (folder) {
        ownerId = folder.user_id;
      }
    }

    const result = await dbRun(
      'INSERT INTO documents (user_id, filename, original_name, filepath, mime_type, folder_id) VALUES (?, ?, ?, ?, ?, ?)',
      [ownerId, filename, originalName, filepath, mimeType, folderId]
    );

    res.status(201).json({
      message: 'File uploaded successfully.',
      document: {
        id: result.lastID,
        filename,
        originalName,
        mimeType,
        folderId,
        uploadDate: new Date()
      }
    });
  } catch (error) {
    console.error('File upload database error:', error);
    res.status(500).json({ message: 'Database error saving uploaded file info.' });
  }
};

const getFiles = async (req, res) => {
  const userId = req.user.id;
  const folderId = req.query.folderId && req.query.folderId !== 'null' && req.query.folderId !== 'root'
    ? parseInt(req.query.folderId)
    : null;

  try {
    let files;
    if (folderId) {
      const canAccess = await hasAccess(userId, 'folder', folderId);
      if (!canAccess) {
        return res.status(403).json({ message: 'Access denied to this folder.' });
      }

      files = await dbAll(
        'SELECT id, filename, original_name as originalName, mime_type as mimeType, upload_date as uploadDate FROM documents WHERE folder_id = ? ORDER BY upload_date DESC',
        [folderId]
      );
    } else {
      files = await dbAll(
        'SELECT id, filename, original_name as originalName, mime_type as mimeType, upload_date as uploadDate FROM documents WHERE user_id = ? AND folder_id IS NULL ORDER BY upload_date DESC',
        [userId]
      );
    }
    res.json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ message: 'Internal server error while fetching files.' });
  }
};

const downloadFile = async (req, res) => {
  const userId = req.user.id;
  const fileId = req.params.id;

  try {
    const canAccess = await hasAccess(userId, 'document', fileId);
    if (!canAccess) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const file = await dbGet('SELECT * FROM documents WHERE id = ?', [fileId]);
    if (!file) {
      return res.status(404).json({ message: 'File not found.' });
    }

    if (!fs.existsSync(file.filepath)) {
      return res.status(404).json({ message: 'File does not exist on disk.' });
    }

    res.download(file.filepath, file.original_name);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ message: 'Internal server error during download.' });
  }
};

const previewFile = async (req, res) => {
  const userId = req.user.id;
  const fileId = req.params.id;

  try {
    const canAccess = await hasAccess(userId, 'document', fileId);
    if (!canAccess) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const file = await dbGet('SELECT * FROM documents WHERE id = ?', [fileId]);
    if (!file) {
      return res.status(404).json({ message: 'File not found.' });
    }

    if (!fs.existsSync(file.filepath)) {
      return res.status(404).json({ message: 'File does not exist on disk.' });
    }

    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`);
    fs.createReadStream(file.filepath).pipe(res);
  } catch (error) {
    console.error('Error serving preview:', error);
    res.status(500).json({ message: 'Internal server error serving preview.' });
  }
};

const deleteFile = async (req, res) => {
  const userId = req.user.id;
  const fileId = req.params.id;

  try {
    const canWrite = await hasWriteAccess(userId, 'document', fileId);
    if (!canWrite) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const file = await dbGet('SELECT * FROM documents WHERE id = ?', [fileId]);
    if (!file) {
      return res.status(404).json({ message: 'File not found.' });
    }

    if (fs.existsSync(file.filepath)) {
      try {
        fs.unlinkSync(file.filepath);
      } catch (err) {
        console.error('Error removing file from disk:', err);
      }
    }

    await dbRun('DELETE FROM documents WHERE id = ?', [fileId]);
    res.json({ message: 'File deleted successfully.' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ message: 'Internal server error during file deletion.' });
  }
};

// Folders Management
const createFolder = async (req, res) => {
  const userId = req.user.id;
  const username = req.user.username;
  const { name, parentId } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ message: 'Folder name is required.' });
  }

  const sanitizedName = name.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
  if (sanitizedName === '') {
    return res.status(400).json({ message: 'Invalid folder name.' });
  }

  const pId = parentId && parentId !== 'root' ? parseInt(parentId) : null;

  try {
    let ownerId = userId;
    let ownerUsername = username;

    if (pId) {
      const parentFolder = await dbGet(
        'SELECT f.*, u.username FROM folders f JOIN users u ON f.user_id = u.id WHERE f.id = ?',
        [pId]
      );
      if (parentFolder) {
        ownerId = parentFolder.user_id;
        ownerUsername = parentFolder.username;
      }
      const canWrite = await hasWriteAccess(userId, 'folder', pId);
      if (!canWrite) {
        return res.status(403).json({ message: 'Access denied to parent folder.' });
      }
    }

    const existingFolder = pId
      ? await dbGet('SELECT * FROM folders WHERE user_id = ? AND name = ? AND parent_id = ?', [ownerId, sanitizedName, pId])
      : await dbGet('SELECT * FROM folders WHERE user_id = ? AND name = ? AND parent_id IS NULL', [ownerId, sanitizedName]);

    if (existingFolder) {
      return res.status(400).json({ message: 'A folder with this name already exists here.' });
    }

    const result = await dbRun(
      'INSERT INTO folders (user_id, name, parent_id) VALUES (?, ?, ?)',
      [ownerId, sanitizedName, pId]
    );

    const folderPath = await getFolderPath(result.lastID);
    const fullDirPath = path.join(__dirname, '../../../uploads', ownerUsername, folderPath);
    if (!fs.existsSync(fullDirPath)) {
      fs.mkdirSync(fullDirPath, { recursive: true });
    }

    res.status(201).json({
      message: 'Folder created successfully.',
      folder: {
        id: result.lastID,
        name: sanitizedName,
        parentId: pId
      }
    });
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({ message: 'Internal server error during folder creation.' });
  }
};

const getFolders = async (req, res) => {
  const userId = req.user.id;
  const parentId = req.query.parentId && req.query.parentId !== 'null' && req.query.parentId !== 'root'
    ? parseInt(req.query.parentId)
    : null;

  try {
    let folders;
    if (parentId) {
      const canAccess = await hasAccess(userId, 'folder', parentId);
      if (!canAccess) {
        return res.status(403).json({ message: 'Access denied to this folder.' });
      }

      folders = await dbAll('SELECT id, name, parent_id as parentId, created_at as createdAt FROM folders WHERE parent_id = ? ORDER BY name ASC', [parentId]);
    } else {
      folders = await dbAll('SELECT id, name, parent_id as parentId, created_at as createdAt FROM folders WHERE user_id = ? AND parent_id IS NULL ORDER BY name ASC', [userId]);
    }
    res.json(folders);
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({ message: 'Internal server error while fetching folders.' });
  }
};

const deleteFolderRecursively = async (folderId, ownerId, ownerUsername) => {
  const subfolders = await dbAll('SELECT id FROM folders WHERE parent_id = ?', [folderId]);
  for (const sub of subfolders) {
    await deleteFolderRecursively(sub.id, ownerId, ownerUsername);
  }

  const docs = await dbAll('SELECT id, filepath FROM documents WHERE folder_id = ?', [folderId]);
  for (const doc of docs) {
    if (fs.existsSync(doc.filepath)) {
      try {
        fs.unlinkSync(doc.filepath);
      } catch (err) {
        console.error('Error removing document during folder delete:', err);
      }
    }
    await dbRun('DELETE FROM documents WHERE id = ?', [doc.id]);
  }

  const folderPath = await getFolderPath(folderId);
  if (folderPath) {
    const fullDirPath = path.join(__dirname, '../../../uploads', ownerUsername, folderPath);
    if (fs.existsSync(fullDirPath)) {
      try {
        fs.rmdirSync(fullDirPath);
      } catch (err) {
        console.error('Error removing directory:', err);
      }
    }
  }

  await dbRun('DELETE FROM folders WHERE id = ?', [folderId]);
};

const deleteFolder = async (req, res) => {
  const userId = req.user.id;
  const folderId = req.params.id;

  try {
    const folder = await dbGet('SELECT * FROM folders WHERE id = ?', [folderId]);
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found.' });
    }

    const canWrite = await hasWriteAccess(userId, 'folder', folderId);
    if (!canWrite) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const owner = await dbGet('SELECT username FROM users WHERE id = ?', [folder.user_id]);
    const ownerUsername = owner ? owner.username : req.user.username;

    await deleteFolderRecursively(folder.id, folder.user_id, ownerUsername);

    res.json({ message: 'Folder and all its contents deleted successfully.' });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({ message: 'Internal server error during folder deletion.' });
  }
};

const renameFolder = async (req, res) => {
  const userId = req.user.id;
  const folderId = req.params.id;
  const { name } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ message: 'New folder name is required.' });
  }

  const sanitizedName = name.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
  if (sanitizedName === '') {
    return res.status(400).json({ message: 'Invalid folder name.' });
  }

  try {
    const folder = await dbGet('SELECT * FROM folders WHERE id = ?', [folderId]);
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found.' });
    }

    const canWrite = await hasWriteAccess(userId, 'folder', folderId);
    if (!canWrite) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const owner = await dbGet('SELECT username FROM users WHERE id = ?', [folder.user_id]);
    const ownerUsername = owner ? owner.username : req.user.username;

    const existingFolder = folder.parent_id
      ? await dbGet('SELECT * FROM folders WHERE user_id = ? AND name = ? AND parent_id = ? AND id != ?', [folder.user_id, sanitizedName, folder.parent_id, folderId])
      : await dbGet('SELECT * FROM folders WHERE user_id = ? AND name = ? AND parent_id IS NULL AND id != ?', [folder.user_id, sanitizedName, folderId]);

    if (existingFolder) {
      return res.status(400).json({ message: 'A folder with this name already exists here.' });
    }

    const oldFolderPath = await getFolderPath(folderId);
    const oldFullDirPath = path.join(__dirname, '../../../uploads', ownerUsername, oldFolderPath);

    await dbRun('UPDATE folders SET name = ? WHERE id = ?', [sanitizedName, folderId]);

    const newFolderPath = await getFolderPath(folderId);
    const newFullDirPath = path.join(__dirname, '../../../uploads', ownerUsername, newFolderPath);

    if (fs.existsSync(oldFullDirPath)) {
      try {
        fs.renameSync(oldFullDirPath, newFullDirPath);
      } catch (err) {
        console.error('Error renaming directory on disk:', err);
      }
    }

    res.json({ message: 'Folder renamed successfully.' });
  } catch (error) {
    console.error('Error renaming folder:', error);
    res.status(500).json({ message: 'Internal server error during folder rename.' });
  }
};

const renameFile = async (req, res) => {
  const userId = req.user.id;
  const fileId = req.params.id;
  const { name } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ message: 'New name is required.' });
  }

  try {
    const canWrite = await hasWriteAccess(userId, 'document', fileId);
    if (!canWrite) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const file = await dbGet('SELECT * FROM documents WHERE id = ?', [fileId]);
    if (!file) {
      return res.status(404).json({ message: 'File not found.' });
    }

    const oldExt = path.extname(file.original_name);
    let newName = name.trim();
    if (path.extname(newName) !== oldExt) {
      newName = newName + oldExt;
    }

    await dbRun('UPDATE documents SET original_name = ? WHERE id = ?', [newName, fileId]);

    res.json({ message: 'Document renamed successfully.' });
  } catch (error) {
    console.error('Error renaming document:', error);
    res.status(500).json({ message: 'Internal server error during document rename.' });
  }
};

module.exports = {
  upload,
  uploadFile,
  getFiles,
  downloadFile,
  previewFile,
  deleteFile,
  createFolder,
  getFolders,
  deleteFolder,
  renameFolder,
  renameFile
};
