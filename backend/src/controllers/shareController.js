const { dbRun, dbAll, dbGet } = require('../config/db');

// Share a folder, document, or all documents and folders
const shareResource = async (req, res) => {
  const ownerId = req.user.id;
  const { sharedWithUsername, resourceType, resourceId, permissionLevel } = req.body;

  if (!sharedWithUsername || !resourceType) {
    return res.status(400).json({ message: 'Target username and resource type are required.' });
  }

  if (resourceType !== 'document' && resourceType !== 'folder' && resourceType !== 'all') {
    return res.status(400).json({ message: 'Invalid resource type.' });
  }

  const permLevel = permissionLevel === 'write' ? 'write' : 'read';

  try {
    // Find target user
    const targetUser = await dbGet('SELECT id FROM users WHERE username = ?', [sharedWithUsername.trim()]);
    if (!targetUser) {
      return res.status(404).json({ message: 'User to share with not found.' });
    }

    if (targetUser.id === ownerId) {
      return res.status(400).json({ message: 'You cannot share items with yourself.' });
    }

    const sharedWithId = targetUser.id;
    const rId = resourceType === 'all' ? null : parseInt(resourceId);

    // Validate resource ownership
    if (resourceType === 'document') {
      const doc = await dbGet('SELECT * FROM documents WHERE id = ? AND user_id = ?', [rId, ownerId]);
      if (!doc) return res.status(404).json({ message: 'Document not found or access denied.' });
    } else if (resourceType === 'folder') {
      const folder = await dbGet('SELECT * FROM folders WHERE id = ? AND user_id = ?', [rId, ownerId]);
      if (!folder) return res.status(404).json({ message: 'Folder not found or access denied.' });
    }

    // Check if share already exists
    const existingShare = rId
      ? await dbGet(
          'SELECT id FROM shares WHERE owner_id = ? AND shared_with_id = ? AND resource_type = ? AND resource_id = ?',
          [ownerId, sharedWithId, resourceType, rId]
        )
      : await dbGet(
          'SELECT id FROM shares WHERE owner_id = ? AND shared_with_id = ? AND resource_type = ? AND resource_id IS NULL',
          [ownerId, sharedWithId, resourceType]
        );

    if (existingShare) {
      // Update permission level if it exists
      await dbRun('UPDATE shares SET permission_level = ? WHERE id = ?', [permLevel, existingShare.id]);
      return res.json({ message: 'Share updated successfully.' });
    }

    // Create new share row
    await dbRun(
      'INSERT INTO shares (owner_id, shared_with_id, resource_type, resource_id, permission_level) VALUES (?, ?, ?, ?, ?)',
      [ownerId, sharedWithId, resourceType, rId, permLevel]
    );

    res.status(201).json({ message: 'Resource shared successfully.' });
  } catch (error) {
    console.error('Error sharing resource:', error);
    res.status(500).json({ message: 'Internal server error during sharing.' });
  }
};

// Retrieve files and folders shared with the current user
const getSharedWithMe = async (req, res) => {
  const userId = req.user.id;
  const parentFolderId = req.query.folderId && req.query.folderId !== 'null' && req.query.folderId !== 'root'
    ? parseInt(req.query.folderId)
    : null;

  try {
    // If browsing inside a shared folder, we let fileController getFiles/getFolders handle it.
    // This endpoint is only for the "root" of Shared With Me.
    if (parentFolderId) {
      return res.json({ folders: [], files: [] });
    }

    // 1. Fetch direct folders shared with user
    const directFolders = await dbAll(
      `SELECT s.id as shareId, f.id, f.name, u.username as ownerName, s.permission_level as permissionLevel, s.created_at as sharedAt 
       FROM shares s 
       JOIN folders f ON s.resource_id = f.id 
       JOIN users u ON s.owner_id = u.id 
       WHERE s.shared_with_id = ? AND s.resource_type = 'folder'`,
      [userId]
    );

    // 2. Fetch direct documents shared with user
    const directDocuments = await dbAll(
      `SELECT s.id as shareId, d.id, d.original_name as name, d.mime_type as mimeType, u.username as ownerName, s.permission_level as permissionLevel, s.created_at as sharedAt 
       FROM shares s 
       JOIN documents d ON s.resource_id = d.id 
       JOIN users u ON s.owner_id = u.id 
       WHERE s.shared_with_id = ? AND s.resource_type = 'document'`,
      [userId]
    );

    // 3. Fetch resources shared via "all" resource type
    const allShares = await dbAll(
      `SELECT s.id as shareId, s.owner_id as ownerId, u.username as ownerName, s.permission_level as permissionLevel, s.created_at as sharedAt 
       FROM shares s
       JOIN users u ON s.owner_id = u.id
       WHERE s.shared_with_id = ? AND s.resource_type = 'all'`,
      [userId]
    );

    const foldersMap = new Map();
    const documentsMap = new Map();

    // Helper to add folders
    directFolders.forEach(f => {
      foldersMap.set(f.id, { ...f, type: 'folder' });
    });

    // Helper to add documents
    directDocuments.forEach(d => {
      documentsMap.set(d.id, { ...d, type: 'document' });
    });

    // Resolve "all" shares to root folders/documents of the sharing user
    for (const share of allShares) {
      const ownerRootFolders = await dbAll(
        `SELECT f.id, f.name, ? as ownerName, ? as permissionLevel, ? as sharedAt
         FROM folders f 
         WHERE f.user_id = ? AND f.parent_id IS NULL`,
        [share.ownerName, share.permissionLevel, share.sharedAt, share.ownerId]
      );

      const ownerRootDocs = await dbAll(
        `SELECT d.id, d.original_name as name, d.mime_type as mimeType, ? as ownerName, ? as permissionLevel, ? as sharedAt
         FROM documents d 
         WHERE d.user_id = ? AND d.folder_id IS NULL`,
        [share.ownerName, share.permissionLevel, share.sharedAt, share.ownerId]
      );

      ownerRootFolders.forEach(f => {
        if (!foldersMap.has(f.id)) {
          foldersMap.set(f.id, { ...f, shareId: share.shareId, type: 'folder' });
        }
      });

      ownerRootDocs.forEach(d => {
        if (!documentsMap.has(d.id)) {
          documentsMap.set(d.id, { ...d, shareId: share.shareId, type: 'document' });
        }
      });
    }

    res.json({
      folders: Array.from(foldersMap.values()),
      files: Array.from(documentsMap.values())
    });
  } catch (error) {
    console.error('Error fetching shared resources:', error);
    res.status(500).json({ message: 'Internal server error while fetching shared items.' });
  }
};

// Revoke access by share ID
const revokeShare = async (req, res) => {
  const ownerId = req.user.id;
  const shareId = req.params.id;

  try {
    const result = await dbRun('DELETE FROM shares WHERE id = ? AND owner_id = ?', [shareId, ownerId]);
    if (result.changes === 0) {
      return res.status(404).json({ message: 'Share not found or not authorized.' });
    }
    res.json({ message: 'Access revoked successfully.' });
  } catch (error) {
    console.error('Error revoking share:', error);
    res.status(500).json({ message: 'Internal server error during share revocation.' });
  }
};

// Get list of active shares for a resource to allow revoking
const getActiveShares = async (req, res) => {
  const ownerId = req.user.id;
  const { resourceType, resourceId } = req.params;

  try {
    const rId = resourceType === 'all' ? null : parseInt(resourceId);

    const query = rId
      ? `SELECT s.id as shareId, u.username as sharedWithUsername, s.permission_level as permissionLevel 
         FROM shares s 
         JOIN users u ON s.shared_with_id = u.id 
         WHERE s.owner_id = ? AND s.resource_type = ? AND s.resource_id = ?`
      : `SELECT s.id as shareId, u.username as sharedWithUsername, s.permission_level as permissionLevel 
         FROM shares s 
         JOIN users u ON s.shared_with_id = u.id 
         WHERE s.owner_id = ? AND s.resource_type = ? AND s.resource_id IS NULL`;

    const params = rId ? [ownerId, resourceType, rId] : [ownerId, resourceType];
    const activeShares = await dbAll(query, params);

    res.json(activeShares);
  } catch (error) {
    console.error('Error fetching active shares:', error);
    res.status(500).json({ message: 'Internal server error fetching active shares.' });
  }
};

// Get all users in the system (for username autocomplete/search)
const getShareUsers = async (req, res) => {
  const userId = req.user.id;
  try {
    const users = await dbAll('SELECT id, username, name FROM users WHERE id != ?', [userId]);
    res.json(users);
  } catch (error) {
    console.error('Error fetching user list:', error);
    res.status(500).json({ message: 'Internal server error fetching users.' });
  }
};

module.exports = {
  shareResource,
  getSharedWithMe,
  revokeShare,
  getActiveShares,
  getShareUsers
};
