const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { 
  upload, uploadFile, getFiles, downloadFile, 
  previewFile, deleteFile, createFolder, getFolders, deleteFolder,
  renameFolder, renameFile
} = require('../controllers/fileController');

const router = express.Router();

// Apply auth middleware to all file routes
router.use(authenticateToken);

router.post('/upload', upload.single('file'), uploadFile);
router.get('/list', getFiles);
router.get('/download/:id', downloadFile);
router.get('/preview/:id', previewFile);
router.delete('/delete/:id', deleteFile);
router.put('/rename/:id', renameFile);

// Folders
router.post('/folders/create', createFolder);
router.get('/folders/list', getFolders);
router.delete('/folders/delete/:id', deleteFolder);
router.put('/folders/rename/:id', renameFolder);

module.exports = router;
