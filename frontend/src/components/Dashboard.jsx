import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { DocumentPreview } from './DocumentPreview';
import {
  UploadCloud, FileText, Image, FileCode, File,
  Download, Eye, LogOut, Loader2, AlertCircle, HardDrive, Trash2,
  Folder, FolderPlus, ChevronRight, LayoutGrid, List, Pencil, ArrowLeft, User, Share2
} from 'lucide-react';

export const Dashboard = () => {
  const { user, token, logout, updateProfile } = useAuth();
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderHistory, setFolderHistory] = useState([]); // Breadcrumbs tracking
  const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list'
  const [newFolderName, setNewFolderName] = useState('');
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [deleteConfirmFile, setDeleteConfirmFile] = useState(null);
  const [deleteConfirmFolder, setDeleteConfirmFolder] = useState(null);
  const [renameItem, setRenameItem] = useState(null); // { id, name, type }
  const [renameName, setRenameName] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [uploadType, setUploadType] = useState('file'); // 'file' or 'folder'
  const [selectedFolderFiles, setSelectedFolderFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [profileSecurityQuestion, setProfileSecurityQuestion] = useState("What is your mother's maiden name?");
  const [profileSecurityAnswer, setProfileSecurityAnswer] = useState('');
  const [profileError, setProfileError] = useState(null);
  const [profileSuccess, setProfileSuccess] = useState(null);

  const [profileOldPassword, setProfileOldPassword] = useState('');
  const [profileNewPassword, setProfileNewPassword] = useState('');
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('');

  const profileModalOpenedRef = useRef(false);

  // Sharing states
  const [activeTab, setActiveTab] = useState('my-drive'); // 'my-drive' or 'shared-with-me'
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareItem, setShareItem] = useState(null); // { id, name, type } ('file', 'folder', or 'all')
  const [shareUsername, setShareUsername] = useState('');
  const [sharePermission, setSharePermission] = useState('read');
  const [shareUsers, setShareUsers] = useState([]);
  const [activeShares, setActiveShares] = useState([]);

  useEffect(() => {
    if (showProfileModal) {
      if (!profileModalOpenedRef.current && user?.username) {
        profileModalOpenedRef.current = true;
        setProfileName(user.name || '');
        setProfileUsername(user.username || '');
        setProfileSecurityAnswer('');
        setProfileError(null);
        setProfileSuccess(null);
        setIsEditingProfile(false);
        setIsChangingPassword(false);
        setProfileOldPassword('');
        setProfileNewPassword('');
        setProfileConfirmPassword('');

        const fetchQuestion = async () => {
          try {
            const response = await fetch(`${API_BASE_URL}/auth/security-question/${user.username}`);
            const data = await response.json();
            if (response.ok) {
              setProfileSecurityQuestion(data.securityQuestion);
            }
          } catch (e) {
            console.error(e);
          }
        };
        fetchQuestion();
      }
    } else {
      profileModalOpenedRef.current = false;
    }
  }, [showProfileModal, user]);

  useEffect(() => {
    if (profileError || profileSuccess) {
      const timer = setTimeout(() => {
        setProfileError(null);
        setProfileSuccess(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [profileError, profileSuccess]);

  const handleProfileUpdateSubmit = async (e) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!profileName.trim()) {
      setProfileError('Name is required.');
      return;
    }

    if (!profileUsername.trim()) {
      setProfileError('Username is required.');
      return;
    }

    try {
      await updateProfile(
        profileName,
        profileUsername,
        profileSecurityQuestion,
        profileSecurityAnswer,
        null,
        null
      );
      setProfileSuccess('Profile updated successfully.');
      setTimeout(() => {
        setIsEditingProfile(false);
        setProfileSuccess(null);
      }, 1500);
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile.');
    }
  };

  const handlePasswordChangeSubmit = async (e) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!profileOldPassword) {
      setProfileError('Error: Old password is required.');
      return;
    }
    if (!profileNewPassword) {
      setProfileError('Error: New password is required.');
      return;
    }
    if (profileNewPassword !== profileConfirmPassword) {
      setProfileError('Error: The new password and confirm password do not match.');
      return;
    }

    try {
      await updateProfile(
        profileName,
        profileUsername,
        profileSecurityQuestion,
        profileSecurityAnswer,
        profileOldPassword,
        profileNewPassword
      );
      setProfileSuccess('Password successfully changed');
      setProfileOldPassword('');
      setProfileNewPassword('');
      setProfileConfirmPassword('');
      setTimeout(() => {
        setIsChangingPassword(false);
        setIsEditingProfile(false);
        setProfileSuccess(null);
      }, 2000);
    } catch (err) {
      let errorMsg = err.message || 'Failed to change password.';
      if (errorMsg.toLowerCase().includes('incorrect old password')) {
        errorMsg = 'The older password is incorrect.';
      } else if (errorMsg.toLowerCase().includes('password must be exactly between')) {
        errorMsg = 'Password requirements not met. It must be exactly 8-12 characters, containing at least one uppercase letter, one number, and one special character.';
      }
      setProfileError(`Error: ${errorMsg}`);
    }
  };

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const folderParam = currentFolder ? currentFolder.id : 'root';
      const response = await fetch(`${API_BASE_URL}/files/list?folderId=${folderParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch files');
      setFiles(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, currentFolder]);

  const fetchFolders = useCallback(async () => {
    try {
      const parentParam = currentFolder ? currentFolder.id : 'root';
      const response = await fetch(`${API_BASE_URL}/files/folders/list?parentId=${parentParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch folders');
      setFolders(data);
    } catch (err) {
      console.error(err);
    }
  }, [token, currentFolder]);

  const fetchSharedItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/shares/shared-with-me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch shared items');

      setFiles(data.files.map(f => ({
        id: f.id,
        filename: f.filename,
        originalName: f.name,
        mimeType: f.mimeType,
        uploadDate: f.sharedAt,
        ownerName: f.ownerName,
        permissionLevel: f.permissionLevel,
        shareId: f.shareId
      })));

      setFolders(data.folders.map(f => ({
        id: f.id,
        name: f.name,
        ownerName: f.ownerName,
        permissionLevel: f.permissionLevel,
        shareId: f.shareId
      })));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === 'shared-with-me' && !currentFolder) {
      fetchSharedItems();
    } else {
      fetchFiles();
      fetchFolders();
    }
  }, [activeTab, currentFolder, fetchFiles, fetchFolders, fetchSharedItems]);

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const enterFolder = (folder) => {
    const folderWithPermission = {
      ...folder,
      permissionLevel: folder.permissionLevel || currentFolder?.permissionLevel
    };
    setFolderHistory([...folderHistory, folderWithPermission]);
    setCurrentFolder(folderWithPermission);
  };

  const navigateHistory = (index) => {
    setError(null);
    setSuccess(null);
    if (index === -1) {
      setFolderHistory([]);
      setCurrentFolder(null);
    } else {
      const newHistory = folderHistory.slice(0, index + 1);
      setFolderHistory(newHistory);
      setCurrentFolder(newHistory[index]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (uploadType === 'file') {
        setSelectedFile(droppedFile);
      } else {
        setSelectedFolderFiles(Array.from(e.dataTransfer.files));
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleFolderChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setSelectedFolderFiles(filesArray);
    }
  };

  const handleFilePick = async () => {
    try {
      if (window.showOpenFilePicker) {
        let fileHandles;
        try {
          fileHandles = await window.showOpenFilePicker({
            multiple: false,
            startIn: 'C:\\'
          });
        } catch (e) {
          fileHandles = await window.showOpenFilePicker({
            multiple: false,
            startIn: 'documents'
          });
        }
        if (fileHandles && fileHandles[0]) {
          const file = await fileHandles[0].getFile();
          setSelectedFile(file);
        }
      } else {
        fileInputRef.current.click();
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
        fileInputRef.current.click();
      }
    }
  };

  const handleFolderPick = async () => {
    try {
      if (window.showDirectoryPicker) {
        let dirHandle;
        try {
          dirHandle = await window.showDirectoryPicker({
            startIn: 'C:\\'
          });
        } catch (e) {
          dirHandle = await window.showDirectoryPicker({
            startIn: 'documents'
          });
        }

        if (dirHandle) {
          const files = [];
          const readDirectory = async (handle, currentPath) => {
            for await (const entry of handle.values()) {
              if (entry.kind === 'file') {
                const file = await entry.getFile();
                Object.defineProperty(file, 'webkitRelativePath', {
                  value: currentPath ? `${currentPath}/${entry.name}` : `${handle.name}/${entry.name}`,
                  writable: true,
                  configurable: true
                });
                files.push(file);
              } else if (entry.kind === 'directory') {
                await readDirectory(entry, currentPath ? `${currentPath}/${entry.name}` : `${handle.name}/${entry.name}`);
              }
            }
          };

          await readDirectory(dirHandle, dirHandle.name);
          if (files.length > 0) {
            setSelectedFolderFiles(files);
          }
        }
      } else {
        if (folderInputRef.current) {
          folderInputRef.current.click();
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
        if (folderInputRef.current) {
          folderInputRef.current.click();
        }
      }
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setUploadProgress('');

    if (uploadType === 'file') {
      if (!selectedFile) return;
      setUploading(true);

      const formData = new FormData();
      formData.append('file', selectedFile);

      try {
        const folderParam = currentFolder ? currentFolder.id : 'root';
        const response = await fetch(`${API_BASE_URL}/files/upload?folderId=${folderParam}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        const data = await response.json();

        if (!response.ok) throw new Error(data.message || 'File upload failed');

        setSuccess('File uploaded successfully!');
        setSelectedFile(null);
        fetchFiles();
      } catch (err) {
        setError(err.message);
      } finally {
        setUploading(false);
      }
    } else {
      if (selectedFolderFiles.length === 0) return;
      setUploading(true);

      try {
        const folderCache = {};
        const startFolderId = currentFolder ? currentFolder.id : 'root';

        for (let i = 0; i < selectedFolderFiles.length; i++) {
          const file = selectedFolderFiles[i];
          const relativePath = file.webkitRelativePath || '';
          if (!relativePath) continue;

          const pathParts = relativePath.split('/');
          pathParts.pop();

          let currentParentId = startFolderId;
          let currentPathStr = '';

          for (let j = 0; j < pathParts.length; j++) {
            const folderName = pathParts[j];
            currentPathStr = currentPathStr ? `${currentPathStr}/${folderName}` : folderName;

            if (folderCache[currentPathStr]) {
              currentParentId = folderCache[currentPathStr];
            } else {
              setUploadProgress(`Creating folder: ${currentPathStr}...`);
              const createResponse = await fetch(`${API_BASE_URL}/files/folders/create`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: folderName, parentId: currentParentId })
              });

              const createData = await createResponse.json();
              if (!createResponse.ok) {
                throw new Error(createData.message || `Failed to create folder: ${folderName}`);
              }

              folderCache[currentPathStr] = createData.folder.id;
              currentParentId = createData.folder.id;
            }
          }
        }

        for (let i = 0; i < selectedFolderFiles.length; i++) {
          const file = selectedFolderFiles[i];
          const relativePath = file.webkitRelativePath || '';
          let targetFolderId = startFolderId;

          if (relativePath) {
            const pathParts = relativePath.split('/');
            pathParts.pop();
            const folderPathStr = pathParts.join('/');
            if (folderCache[folderPathStr]) {
              targetFolderId = folderCache[folderPathStr];
            }
          }

          setUploadProgress(`Uploading file ${i + 1} of ${selectedFolderFiles.length}: ${file.name}...`);

          const formData = new FormData();
          formData.append('file', file);

          const response = await fetch(`${API_BASE_URL}/files/upload?folderId=${targetFolderId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.message || `Failed to upload file: ${file.name}`);
          }
        }

        setSuccess(`Folder uploaded successfully! ${selectedFolderFiles.length} files processed.`);
        setSelectedFolderFiles([]);
        fetchFolders();
        fetchFiles();
      } catch (err) {
        setError(err.message);
      } finally {
        setUploading(false);
        setUploadProgress('');
      }
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setError(null);
    setSuccess(null);

    try {
      const parentParam = currentFolder ? currentFolder.id : 'root';
      const response = await fetch(`${API_BASE_URL}/files/folders/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newFolderName, parentId: parentParam })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create folder');

      setSuccess('Folder created successfully.');
      setNewFolderName('');
      setShowFolderModal(false);
      fetchFolders();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRenameOpen = (item, type) => {
    setRenameItem({
      id: item.id,
      type: type,
      name: type === 'file' ? item.originalName : item.name
    });
    setRenameName(type === 'file' ? item.originalName : item.name);
    setShowRenameModal(true);
  };

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!renameName.trim() || !renameItem) return;

    setError(null);
    setSuccess(null);

    const endpoint = renameItem.type === 'file'
      ? `${API_BASE_URL}/files/rename/${renameItem.id}`
      : `${API_BASE_URL}/files/folders/rename/${renameItem.id}`;

    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: renameName })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to rename item');

      setSuccess('Renamed successfully.');
      setShowRenameModal(false);
      setRenameItem(null);

      fetchFolders();
      fetchFiles();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDownload = async (file) => {
    try {
      const response = await fetch(`${API_BASE_URL}/files/download/${file.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Download request failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.originalName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error downloading file: ' + err.message);
    }
  };

  const handleDelete = async (fileId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/files/delete/${fileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Delete request failed');

      setSuccess('Document deleted successfully.');
      setDeleteConfirmFile(null);

      if (activeTab === 'shared-with-me' && !currentFolder) {
        fetchSharedItems();
      } else {
        fetchFiles();
      }
    } catch (err) {
      alert('Error deleting file: ' + err.message);
    }
  };

  const handleDeleteFolder = async (folderId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/files/folders/delete/${folderId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Delete folder failed');

      setSuccess('Folder and all its contents deleted successfully.');
      setDeleteConfirmFolder(null);
      fetchFolders();

      const isInHistory = folderHistory.some(f => f.id === folderId);
      if (isInHistory || (currentFolder && currentFolder.id === folderId)) {
        setCurrentFolder(null);
        setFolderHistory([]);
      } else {
        if (activeTab === 'shared-with-me' && !currentFolder) {
          fetchSharedItems();
        } else {
          fetchFiles();
        }
      }
    } catch (err) {
      alert('Error deleting folder: ' + err.message);
    }
  };

  // Sharing handlers
  const handleShareOpen = async (item, type) => {
    setShareItem({
      id: item?.id || null,
      type: type,
      name: type === 'all' ? 'All Files & Folders' : (type === 'file' ? item.originalName : item.name)
    });
    setShareUsername('');
    setSharePermission('read');
    setShowShareModal(true);

    try {
      const response = await fetch(`${API_BASE_URL}/shares/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setShareUsers(data);
      }
    } catch (e) {
      console.error(e);
    }

    const typeParam = type === 'file' ? 'document' : type;
    const idParam = item?.id || 0;
    try {
      const response = await fetch(`${API_BASE_URL}/shares/active/${typeParam}/${idParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setActiveShares(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleShareSubmit = async (e) => {
    e.preventDefault();
    if (!shareUsername.trim() || !shareItem) return;

    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_BASE_URL}/shares/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sharedWithUsername: shareUsername.trim(),
          resourceType: shareItem.type === 'file' ? 'document' : (shareItem.type === 'folder' ? 'folder' : 'all'),
          resourceId: shareItem.id,
          permissionLevel: sharePermission
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to share resource');

      setSuccess('Shared successfully.');

      const type = shareItem.type === 'file' ? 'document' : shareItem.type;
      const id = shareItem.id || 0;
      const activeRes = await fetch(`${API_BASE_URL}/shares/active/${type}/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const activeData = await activeRes.json();
      if (activeRes.ok) {
        setActiveShares(activeData);
      }
      setShareUsername('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRevokeShare = async (shareId) => {
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_BASE_URL}/shares/revoke/${shareId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to revoke access');

      setSuccess('Access revoked.');
      setActiveShares(activeShares.filter(s => s.shareId !== shareId));
    } catch (err) {
      setError(err.message);
    }
  };

  const getFileIcon = (mimeType) => {
    if (mimeType.startsWith('image/')) return <Image size={28} />;
    if (mimeType === 'application/pdf') return <FileText size={28} />;
    if (mimeType.startsWith('text/') || mimeType === 'application/json') return <FileCode size={28} />;
    return <File size={28} />;
  };

  const hasItems = folders.length > 0 || files.length > 0;

  // Access rights check for actions
  const isOwner = (item) => !item.ownerName;
  const canWrite = (item) => isOwner(item) || item.permissionLevel === 'write';

  const canUploadOrWrite = activeTab === 'my-drive' || (
    currentFolder && (
      currentFolder.permissionLevel === 'write' ||
      folderHistory[0]?.permissionLevel === 'write'
    )
  );

  return (
    <div className="dashboard-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-logo">
          <HardDrive size={24} />
          <span>DocVault</span>
        </div>
        <div className="nav-user" style={{ display: 'flex', alignItems: 'center' }}>
          <span className="nav-username">Welcome, <strong>{user?.name || user?.username}</strong></span>
          <button className="btn-logout" onClick={logout} title="Log Out" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
            <LogOut size={16} />
          </button>
          <button
            className="btn-logout"
            onClick={() => setShowProfileModal(true)}
            style={{
              marginLeft: '10px',
              background: 'rgba(129, 140, 248, 0.1)',
              borderColor: 'rgba(129, 140, 248, 0.2)',
              color: '#818cf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out'
            }}
            title="View Profile"
          >
            <User size={16} />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="dashboard-content">
        {/* Left Side Navigation & Upload Panel */}
        <div className="upload-panel glass-panel">
          <h3>Navigation</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '25px' }}>
            <button
              onClick={() => {
                setActiveTab('my-drive');
                setCurrentFolder(null);
                setFolderHistory([]);
                setError(null);
                setSuccess(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid ' + (activeTab === 'my-drive' ? 'rgba(129, 140, 248, 0.2)' : 'transparent'),
                background: activeTab === 'my-drive' ? 'rgba(129, 140, 248, 0.1)' : 'transparent',
                color: activeTab === 'my-drive' ? '#818cf8' : '#94a3b8',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              <HardDrive size={18} />
              My Drive
            </button>
            <button
              onClick={() => {
                setActiveTab('shared-with-me');
                setCurrentFolder(null);
                setFolderHistory([]);
                setError(null);
                setSuccess(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid ' + (activeTab === 'shared-with-me' ? 'rgba(129, 140, 248, 0.2)' : 'transparent'),
                background: activeTab === 'shared-with-me' ? 'rgba(129, 140, 248, 0.1)' : 'transparent',
                color: activeTab === 'shared-with-me' ? '#818cf8' : '#94a3b8',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              <Share2 size={18} />
              Shared with Me
            </button>

            <button
              onClick={() => handleShareOpen(null, 'all')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(192, 132, 252, 0.1)',
                background: 'rgba(192, 132, 252, 0.05)',
                color: '#c084fc',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: '600',
                transition: 'all 0.2s',
                marginTop: '10px'
              }}
            >
              <Share2 size={18} />
              Share My Entire Drive
            </button>
          </div>

          <h3>{uploadType === 'file' ? 'Upload Document' : 'Upload Folder'}</h3>

          {canUploadOrWrite ? (
            <>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '8px' }}>
                <button
                  type="button"
                  onClick={() => { setUploadType('file'); setError(null); setSuccess(null); }}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    background: uploadType === 'file' ? 'rgba(129, 140, 248, 0.2)' : 'transparent',
                    color: uploadType === 'file' ? '#818cf8' : '#94a3b8',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => { setUploadType('folder'); setError(null); setSuccess(null); }}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    background: uploadType === 'folder' ? 'rgba(129, 140, 248, 0.2)' : 'transparent',
                    color: uploadType === 'folder' ? '#818cf8' : '#94a3b8',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Upload Folder
                </button>
              </div>

              <form onSubmit={handleUploadSubmit}>
                {uploadType === 'file' ? (
                  <div
                    className="dropzone"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={handleFilePick}
                    style={{
                      opacity: 1,
                      cursor: 'pointer',
                      borderColor: 'rgba(255, 255, 255, 0.2)'
                    }}
                  >
                    <UploadCloud size={40} style={{ color: '#818cf8' }} />
                    <div>
                      <p style={{ fontWeight: '500' }}>Drag & Drop file here</p>
                      <p className="dropzone-text">or click to browse local files</p>
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="file-input"
                    />
                  </div>
                ) : (
                  <div
                    className="dropzone"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={handleFolderPick}
                    style={{
                      opacity: 1,
                      cursor: 'pointer',
                      borderColor: 'rgba(255, 255, 255, 0.2)'
                    }}
                  >
                    <FolderPlus size={40} style={{ color: '#c084fc' }} />
                    <div>
                      <p style={{ fontWeight: '500' }}>Select Folder to Upload</p>
                      <p className="dropzone-text">will upload folder and recreate its structure</p>
                    </div>
                    <input
                      type="file"
                      ref={folderInputRef}
                      onChange={handleFolderChange}
                      webkitdirectory=""
                      directory=""
                      multiple
                      className="file-input"
                    />
                  </div>
                )}

                {uploadType === 'file' && selectedFile && (
                  <div className="selected-file-badge">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <FileText size={16} style={{ color: '#818cf8', flexShrink: 0 }} />
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {selectedFile.name}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', flexShrink: 0 }}>
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                )}

                {uploadType === 'folder' && selectedFolderFiles.length > 0 && (
                  <div className="selected-file-badge" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Folder size={16} style={{ color: '#c084fc' }} />
                      <span style={{ fontWeight: '600' }}>
                        {selectedFolderFiles[0].webkitRelativePath.split('/')[0]}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {selectedFolderFiles.length} files selected ({(selectedFolderFiles.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary"
                  style={{ width: '100%', marginTop: '20px' }}
                  disabled={uploading || (uploadType === 'file' ? !selectedFile : selectedFolderFiles.length === 0)}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} style={{ marginRight: '8px', display: 'inline' }} />
                      Uploading...
                    </>
                  ) : (uploadType === 'file' ? 'Upload Document' : 'Upload Folder')}
                </button>
              </form>
            </>
          ) : (
            <div style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center' }}>
              Select a shared folder with write permission to upload files or create directories.
            </div>
          )}

          {uploadProgress && (
            <div style={{ marginTop: '15px', padding: '12px', background: 'rgba(129, 140, 248, 0.05)', borderRadius: '8px', border: '1px solid rgba(129, 140, 248, 0.1)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Loader2 className="animate-spin" size={14} style={{ color: '#818cf8' }} />
              <span>{uploadProgress}</span>
            </div>
          )}
        </div>

        {/* Right Side: Unified Folders & Documents Explorer */}
        <div className="documents-panel glass-panel">
          <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '15px', marginBottom: '20px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {currentFolder && (
                <button
                  onClick={() => navigateHistory(folderHistory.length - 2)}
                  className="btn-back"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    marginRight: '8px',
                    fontWeight: '500',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                >
                  <ArrowLeft size={14} />
                  Back
                </button>
              )}
              <span onClick={() => navigateHistory(-1)} style={{ cursor: 'pointer', color: '#818cf8' }}>
                {activeTab === 'shared-with-me' ? 'Shared with Me' : 'My Drive'}
              </span>
              {folderHistory.map((folder, index) => (
                <React.Fragment key={folder.id}>
                  <ChevronRight size={14} style={{ color: '#94a3b8' }} />
                  <span
                    onClick={() => navigateHistory(index)}
                    style={{
                      cursor: index === folderHistory.length - 1 ? 'default' : 'pointer',
                      color: index === folderHistory.length - 1 ? '#f8fafc' : '#818cf8'
                    }}
                  >
                    {folder.name}
                  </span>
                </React.Fragment>
              ))}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Layout Switcher */}
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.05)', padding: '2px', borderRadius: '6px' }}>
                <button
                  onClick={() => setViewMode('grid')}
                  style={{
                    background: viewMode === 'grid' ? 'rgba(129, 140, 248, 0.2)' : 'transparent',
                    color: viewMode === 'grid' ? '#818cf8' : '#94a3b8',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <LayoutGrid size={14} style={{ marginRight: '4px', display: 'inline', verticalAlign: 'middle' }} />
                  Grid
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  style={{
                    background: viewMode === 'list' ? 'rgba(129, 140, 248, 0.2)' : 'transparent',
                    color: viewMode === 'list' ? '#818cf8' : '#94a3b8',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <List size={14} style={{ marginRight: '4px', display: 'inline', verticalAlign: 'middle' }} />
                  List
                </button>
              </div>

              {canUploadOrWrite && (
                <button
                  className="btn-primary"
                  onClick={() => { setShowFolderModal(true); setNewFolderName(''); setError(null); }}
                  style={{ padding: '8px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FolderPlus size={16} />
                  Create Folder
                </button>
              )}
            </div>
          </h3>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <Loader2 className="animate-spin" size={36} style={{ color: '#818cf8' }} />
            </div>
          ) : !hasItems ? (
            <div className="empty-state" style={{ padding: '60px 20px' }}>
              <Folder size={48} style={{ color: '#475569', marginBottom: '10px' }} />
              <p>This directory is empty.</p>
            </div>
          ) : (
            <>
              {viewMode === 'grid' ? (
                <div className="document-grid">
                  {/* Folders first */}
                  {folders.map(folder => (
                    <div
                      key={`folder-${folder.id}`}
                      className="document-card"
                      onClick={() => enterFolder(folder)}
                      style={{
                        cursor: 'pointer',
                        border: '1px solid rgba(192, 132, 252, 0.15)',
                        background: 'rgba(192, 132, 252, 0.02)',
                        height: '240px'
                      }}
                    >
                      <div className="doc-info">
                        <div className="doc-icon-container" style={{ color: '#c084fc' }}>
                          <Folder size={28} />
                        </div>
                        <div className="doc-title" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: '600' }} title={folder.name}>
                            {folder.name}
                          </span>
                          {folder.ownerName && (
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                              Shared by: <strong>{folder.ownerName}</strong>
                            </span>
                          )}
                        </div>
                        <div className="doc-meta">
                          Folder {folder.permissionLevel ? `(${folder.permissionLevel})` : ''}
                        </div>
                      </div>
                      <div className="doc-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn-action btn-action-preview"
                          onClick={() => enterFolder(folder)}
                          style={{ background: 'rgba(192, 132, 252, 0.15)', color: '#c084fc' }}
                        >
                          <ChevronRight size={14} />
                          Enter
                        </button>

                        {isOwner(folder) && (
                          <button
                            className="btn-action"
                            onClick={() => handleShareOpen(folder, 'folder')}
                            style={{ background: 'rgba(129, 140, 248, 0.15)', color: '#818cf8' }}
                          >
                            <Share2 size={14} />
                            Share
                          </button>
                        )}

                        {canWrite(folder) && (
                          <button
                            className="btn-action btn-action-rename"
                            onClick={() => handleRenameOpen(folder, 'folder')}
                            style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }}
                          >
                            <Pencil size={14} />
                            Rename
                          </button>
                        )}

                        {canWrite(folder) && (
                          <button
                            className="btn-action btn-action-delete"
                            onClick={() => setDeleteConfirmFolder(folder)}
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Documents second */}
                  {files.map(file => (
                    <div key={`file-${file.id}`} className="document-card" style={{ height: '240px' }}>
                      <div className="doc-info">
                        <div className="doc-icon-container">
                          {getFileIcon(file.mimeType)}
                        </div>
                        <div className="doc-title" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: '600' }} title={file.originalName}>
                            {file.originalName}
                          </span>
                          {file.ownerName && (
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                              Shared by: <strong>{file.ownerName}</strong>
                            </span>
                          )}
                        </div>
                        <div className="doc-meta" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span>Document {file.permissionLevel ? `(${file.permissionLevel})` : ''}</span>
                          <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>Uploaded: {new Date(file.uploadDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="doc-actions">
                        <button
                          className="btn-action btn-action-preview"
                          onClick={() => setPreviewFile(file)}
                        >
                          <Eye size={14} />
                          Preview
                        </button>

                        {isOwner(file) && (
                          <button
                            className="btn-action"
                            onClick={() => handleShareOpen(file, 'file')}
                            style={{ background: 'rgba(129, 140, 248, 0.15)', color: '#818cf8' }}
                          >
                            <Share2 size={14} />
                            Share
                          </button>
                        )}

                        {canWrite(file) && (
                          <button
                            className="btn-action btn-action-rename"
                            onClick={() => handleRenameOpen(file, 'file')}
                            style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }}
                          >
                            <Pencil size={14} />
                            Rename
                          </button>
                        )}
                        <button
                          className="btn-action btn-action-download"
                          onClick={() => handleDownload(file)}
                        >
                          <Download size={14} />
                          Download
                        </button>

                        {canWrite(file) && (
                          <button
                            className="btn-action btn-action-delete"
                            onClick={() => setDeleteConfirmFile(file)}
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Folders first */}
                  {folders.map(folder => (
                    <div
                      key={`folder-${folder.id}`}
                      className="folder-card glass-panel"
                      onClick={() => enterFolder(folder)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 20px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: 'rgba(192, 132, 252, 0.02)',
                        border: '1px solid rgba(192, 132, 252, 0.1)',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                        <Folder size={18} style={{ color: '#c084fc', flexShrink: 0 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                          <span style={{ fontWeight: '500', fontSize: '0.9rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {folder.name}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#c084fc' }}>
                            Folder {folder.permissionLevel ? `(${folder.permissionLevel})` : ''}
                            {folder.ownerName && ` | Shared by: ${folder.ownerName}`}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} onClick={(e) => e.stopPropagation()}>
                        {isOwner(folder) && (
                          <button
                            className="btn-action"
                            onClick={() => handleShareOpen(folder, 'folder')}
                            style={{ padding: '6px 12px', flex: 'none', background: 'rgba(129, 140, 248, 0.15)', color: '#818cf8' }}
                            title="Share Folder"
                          >
                            <Share2 size={14} />
                          </button>
                        )}

                        {canWrite(folder) && (
                          <button
                            className="btn-action btn-action-rename"
                            onClick={() => handleRenameOpen(folder, 'folder')}
                            style={{ padding: '6px 12px', flex: 'none', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }}
                            title="Rename Folder"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {canWrite(folder) && (
                          <button
                            className="btn-action btn-action-delete"
                            onClick={() => setDeleteConfirmFolder(folder)}
                            style={{ padding: '6px 12px', flex: 'none' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Documents second */}
                  {files.map(file => (
                    <div
                      key={`file-${file.id}`}
                      className="folder-card glass-panel"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 20px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden', flex: 1 }}>
                        {getFileIcon(file.mimeType)}
                        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                          <span style={{ fontWeight: '500', fontSize: '0.9rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {file.originalName}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            Document {file.permissionLevel ? `(${file.permissionLevel})` : ''}
                            {file.ownerName && ` | Shared by: ${file.ownerName}`}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          className="btn-action btn-action-preview"
                          onClick={() => setPreviewFile(file)}
                          style={{ padding: '6px 12px', flex: 'none' }}
                        >
                          <Eye size={14} />
                        </button>

                        {isOwner(file) && (
                          <button
                            className="btn-action"
                            onClick={() => handleShareOpen(file, 'file')}
                            style={{ padding: '6px 12px', flex: 'none', background: 'rgba(129, 140, 248, 0.15)', color: '#818cf8' }}
                            title="Share File"
                          >
                            <Share2 size={14} />
                          </button>
                        )}

                        {canWrite(file) && (
                          <button
                            className="btn-action btn-action-rename"
                            onClick={() => handleRenameOpen(file, 'file')}
                            style={{ padding: '6px 12px', flex: 'none', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }}
                            title="Rename File"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        <button
                          className="btn-action btn-action-download"
                          onClick={() => handleDownload(file)}
                          style={{ padding: '6px 12px', flex: 'none' }}
                        >
                          <Download size={14} />
                        </button>
                        {canWrite(file) && (
                          <button
                            className="btn-action btn-action-delete"
                            onClick={() => setDeleteConfirmFile(file)}
                            style={{ padding: '6px 12px', flex: 'none' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Share Modal Overlay */}
      {showShareModal && shareItem && (
        <div className="confirm-backdrop" onClick={() => setShowShareModal(false)}>
          <div className="confirm-card glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Share2 size={20} style={{ color: '#818cf8' }} />
              Share Resource
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '4px 0 15px 0' }}>
              Sharing: <strong style={{ color: '#f8fafc' }}>{shareItem.name}</strong>
            </p>

            <form onSubmit={handleShareSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Select User</label>
                <input
                  list="share-users-list"
                  placeholder="Type username to search..."
                  value={shareUsername}
                  onChange={(e) => setShareUsername(e.target.value)}
                  required
                  style={{ marginTop: '5px' }}
                />
                <datalist id="share-users-list">
                  {shareUsers.map(u => (
                    <option key={u.id} value={u.username}>{u.name ? `${u.name} (${u.username})` : u.username}</option>
                  ))}
                </datalist>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Access Permission</label>
                <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                  <button
                    type="button"
                    onClick={() => setSharePermission('read')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid ' + (sharePermission === 'read' ? 'rgba(129, 140, 248, 0.4)' : 'rgba(255,255,255,0.1)'),
                      background: sharePermission === 'read' ? 'rgba(129, 140, 248, 0.15)' : 'transparent',
                      color: sharePermission === 'read' ? '#818cf8' : '#94a3b8',
                      cursor: 'pointer'
                    }}
                  >
                    Viewer (Read-only)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSharePermission('write')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid ' + (sharePermission === 'write' ? 'rgba(129, 140, 248, 0.4)' : 'rgba(255,255,255,0.1)'),
                      background: sharePermission === 'write' ? 'rgba(129, 140, 248, 0.15)' : 'transparent',
                      color: sharePermission === 'write' ? '#818cf8' : '#94a3b8',
                      cursor: 'pointer'
                    }}
                  >
                    Editor (Read & Write)
                  </button>
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ padding: '10px', marginTop: '10px' }}>
                Grant Access
              </button>
            </form>

            <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
              <h4 style={{ fontSize: '0.85rem', color: '#f8fafc', marginBottom: '10px' }}>Who has access</h4>
              {activeShares.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>Not shared with anyone yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                  {activeShares.map(share => (
                    <div key={share.shareId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{share.sharedWithUsername}</span>
                        <span style={{ fontSize: '0.7rem', color: '#818cf8', textTransform: 'capitalize' }}>{share.permissionLevel} permission</span>
                      </div>
                      <button
                        onClick={() => handleRevokeShare(share.shareId)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: 'none',
                          color: '#f87171',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn-confirm-no" onClick={() => setShowShareModal(false)} style={{ padding: '8px 16px' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Overlay */}
      {previewFile && (
        <DocumentPreview
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onDownload={() => handleDownload(previewFile)}
        />
      )}

      {/* Custom Confirmation Dialog Overlay (Files) */}
      {deleteConfirmFile && (
        <div className="confirm-backdrop" onClick={() => setDeleteConfirmFile(null)}>
          <div className="confirm-card glass-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this document?</p>
            <div className="confirm-actions">
              <button
                className="btn-confirm-yes"
                onClick={() => handleDelete(deleteConfirmFile.id)}
              >
                Yes
              </button>
              <button
                className="btn-confirm-no"
                onClick={() => setDeleteConfirmFile(null)}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Dialog Overlay (Folders) */}
      {deleteConfirmFolder && (
        <div className="confirm-backdrop" onClick={() => setDeleteConfirmFolder(null)}>
          <div className="confirm-card glass-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Delete Folder</h3>
            <p>Are you sure you want to delete folder <strong style={{ color: '#c084fc' }}>{deleteConfirmFolder.name}</strong>? This will permanently delete all sub-folders and documents inside it!</p>
            <div className="confirm-actions">
              <button
                className="btn-confirm-yes"
                onClick={() => handleDeleteFolder(deleteConfirmFolder.id)}
              >
                Yes
              </button>
              <button
                className="btn-confirm-no"
                onClick={() => setDeleteConfirmFolder(null)}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Creation Modal Overlay */}
      {showFolderModal && (
        <div className="confirm-backdrop" onClick={() => { setShowFolderModal(false); setNewFolderName(''); setError(null); }}>
          <div className="confirm-card glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h3>Create Folder</h3>
            {error && (
              <div className="error-message" style={{ marginTop: '10px', marginBottom: '10px' }}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}
            <form onSubmit={handleCreateFolder} style={{ marginTop: '15px' }}>
              <input
                type="text"
                placeholder="Folder name (e.g. Invoices)"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                required
                style={{ marginBottom: '20px' }}
              />
              <div className="confirm-actions">
                <button type="submit" className="btn-primary" style={{ padding: '10px 24px' }}>
                  Create
                </button>
                <button type="button" className="btn-confirm-no" onClick={() => { setShowFolderModal(false); setNewFolderName(''); setError(null); }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Modal Overlay */}
      {showRenameModal && renameItem && (
        <div className="confirm-backdrop" onClick={() => { setShowRenameModal(false); setError(null); }}>
          <div className="confirm-card glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h3>Rename {renameItem.type === 'file' ? 'Document' : 'Folder'}</h3>
            {error && (
              <div className="error-message" style={{ marginTop: '10px', marginBottom: '10px' }}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}
            <form onSubmit={handleRenameSubmit} style={{ marginTop: '15px' }}>
              <input
                type="text"
                placeholder="New name"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                required
                style={{ marginBottom: '20px' }}
              />
              <div className="confirm-actions">
                <button type="submit" className="btn-primary" style={{ padding: '10px 24px' }}>
                  Rename
                </button>
                <button type="button" className="btn-confirm-no" onClick={() => { setShowRenameModal(false); setError(null); }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile Modal Overlay */}
      {showProfileModal && (
        <div className="confirm-backdrop" onClick={() => { setShowProfileModal(false); setIsEditingProfile(false); }}>
          <div className="confirm-card glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
              <div style={{
                background: 'rgba(129, 140, 248, 0.15)',
                color: '#818cf8',
                borderRadius: '50%',
                padding: '20px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <User size={48} />
              </div>
            </div>
            <h3 style={{ marginBottom: '20px', fontSize: '1.5rem', fontWeight: '600' }}>User Profile</h3>

            {profileError && (
              <div style={{
                marginTop: '10px',
                marginBottom: '15px',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.85rem',
                textAlign: 'left'
              }}>
                <AlertCircle size={18} style={{ color: '#f87171', flexShrink: 0 }} />
                <span>{profileError}</span>
              </div>
            )}
            {profileSuccess && (
              <div style={{
                marginTop: '10px',
                marginBottom: '15px',
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '8px',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.85rem',
                textAlign: 'left'
              }}>
                <AlertCircle size={18} style={{ color: '#34d399', flexShrink: 0 }} />
                <span>{profileSuccess}</span>
              </div>
            )}

            {!isEditingProfile && !isChangingPassword ? (
              <>
                <div className="profile-subview" style={{ display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'left', marginBottom: '25px', background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>User ID</span>
                    <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontFamily: 'monospace' }}>#{user?.id}</span>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '10px' }}>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</span>
                    <span style={{ fontSize: '1rem', fontWeight: '500', color: '#f8fafc' }}>{user?.name || 'N/A'}</span>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '10px' }}>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Username</span>
                    <span style={{ fontSize: '1rem', fontWeight: '500', color: '#f8fafc' }}>{user?.username}</span>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '10px' }}>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Security Question</span>
                    <span style={{ fontSize: '1rem', fontWeight: '500', color: '#f8fafc' }}>{profileSecurityQuestion || 'None'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn-primary" onClick={() => setIsEditingProfile(true)} style={{ flex: 1, padding: '10px' }}>
                    Edit Profile
                  </button>
                  <button className="btn-confirm-no" onClick={() => setShowProfileModal(false)} style={{ flex: 1, padding: '10px' }}>
                    Close
                  </button>
                </div>
              </>
            ) : isEditingProfile && !isChangingPassword ? (
              <form className="profile-subview" onSubmit={handleProfileUpdateSubmit} style={{ textAlign: 'left' }}>
                <div className="custom-scrollbar" style={{ maxHeight: '380px', overflowY: 'auto', paddingRight: '8px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px', background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label htmlFor="profileName" style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</label>
                      <input
                        type="text"
                        id="profileName"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        required
                        style={{ marginTop: '5px' }}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label htmlFor="profileUsername" style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Username</label>
                      <input
                        type="text"
                        id="profileUsername"
                        value={profileUsername}
                        onChange={(e) => setProfileUsername(e.target.value.toLowerCase().replace(/[^a-z]/g, ''))}
                        required
                        style={{ marginTop: '5px' }}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label htmlFor="profileSecurityQuestion" style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Security Question</label>
                      <select
                        id="profileSecurityQuestion"
                        value={profileSecurityQuestion}
                        onChange={(e) => setProfileSecurityQuestion(e.target.value)}
                        style={{
                          marginTop: '5px',
                          width: '100%',
                          height: '42px',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          background: 'rgba(0, 0, 0, 0.2)',
                          color: '#f8fafc',
                          outline: 'none'
                        }}
                        required
                      >
                        <option value="What is your mother's maiden name?">What is your mother's maiden name?</option>
                        <option value="What was the name of your first pet?">What was the name of your first pet?</option>
                        <option value="What was the name of your first school?">What was the name of your first school?</option>
                        <option value="What is the city where you were born?">What is the city where you were born?</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label htmlFor="profileSecurityAnswer" style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>New Security Answer (Leave blank to keep current)</label>
                      <input
                        type="text"
                        id="profileSecurityAnswer"
                        placeholder="Enter new answer if changing"
                        value={profileSecurityAnswer}
                        onChange={(e) => setProfileSecurityAnswer(e.target.value)}
                        style={{ marginTop: '5px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                    <button
                      type="button"
                      onClick={() => { setIsChangingPassword(true); setIsEditingProfile(false); }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#c084fc',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        fontWeight: '500'
                      }}
                    >
                      Change Password
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="submit" className="btn-primary" style={{ flex: 1, padding: '10px' }}>
                    Save
                  </button>
                  <button type="button" className="btn-confirm-no" onClick={() => setIsEditingProfile(false)} style={{ flex: 1, padding: '10px' }}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <form className="profile-subview" onSubmit={handlePasswordChangeSubmit} style={{ textAlign: 'left' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px', background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="profileOldPassword" style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Older Password</label>
                    <input
                      type="password"
                      id="profileOldPassword"
                      placeholder="••••••••••••"
                      value={profileOldPassword}
                      onChange={(e) => setProfileOldPassword(e.target.value)}
                      required
                      style={{ marginTop: '5px' }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="profileNewPassword" style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>New Password</label>
                    <input
                      type="password"
                      id="profileNewPassword"
                      placeholder="••••••••••••"
                      value={profileNewPassword}
                      onChange={(e) => setProfileNewPassword(e.target.value)}
                      required
                      style={{ marginTop: '5px' }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="profileConfirmPassword" style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confirm Password</label>
                    <input
                      type="password"
                      id="profileConfirmPassword"
                      placeholder="••••••••••••"
                      value={profileConfirmPassword}
                      onChange={(e) => setProfileConfirmPassword(e.target.value)}
                      required
                      style={{ marginTop: '5px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="submit" className="btn-primary" style={{ flex: 1, padding: '10px' }}>
                    Save Password
                  </button>
                  <button type="button" className="btn-confirm-no" onClick={() => { setIsChangingPassword(false); setIsEditingProfile(true); }} style={{ flex: 1, padding: '10px' }}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* Toast Notification Container */}
      {(error || success) && (
        <div className="toast-container" style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxWidth: '350px',
          pointerEvents: 'none'
        }}>
          {error && (
            <div className="error-message" style={{
              margin: 0,
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
              pointerEvents: 'auto',
              background: '#000000',
              color: '#f87171',
              border: '1px solid rgba(248, 113, 113, 0.3)',
              borderRadius: '8px',
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <AlertCircle size={18} style={{ color: '#f87171' }} />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="success-message" style={{
              margin: 0,
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
              pointerEvents: 'auto',
              background: '#000000',
              color: '#34d399',
              border: '1px solid rgba(52, 211, 153, 0.3)',
              borderRadius: '8px',
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <AlertCircle size={18} style={{ color: '#34d399' }} />
              <span>{success}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default Dashboard;
