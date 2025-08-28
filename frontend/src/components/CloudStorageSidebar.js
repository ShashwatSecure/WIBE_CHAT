import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import socket from '../socket'; // Import socket
import './CloudStorageSidebar.css';
import './FilePreview.css';
import StorageProgressBar from './StorageProgressBar';
import UploadProgressToast from './UploadProgressToast';

const MAX_STORAGE_BYTES = 15 * 1024 * 1024 * 1024; // 15 GB in bytes

const getFileExtension = (filename) => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop() : '';
};

const getFileIcon = (filename) => {
  const extension = getFileExtension(filename).toLowerCase();
  console.log(`getFileIcon: Filename: ${filename}, Detected Extension: ${extension}`);
  const basePath = '/documentfilelogo/'; // Path to your local icons
  switch (extension) {
    case 'docx':
      return `${basePath}docx.png`;
    case 'pdf':
      return `${basePath}pdf.png`;
    case 'txt':
      return `${basePath}txt.png`;
    case 'rtf':
      return `${basePath}rtf.png`;
    case 'odt':
      return `${basePath}odt.png`;
    case 'html':
    case 'htm':
      return `${basePath}html.png`;
    case 'md':
      return `${basePath}md.png`;
    case 'tex':
      return `${basePath}tex.png`;
    case 'xml':
      return `${basePath}xml.png`;
    case 'json':
      return `${basePath}json.png`;
    case 'csv':
      return `${basePath}csv.png`;
    case 'xls':
      return `${basePath}xls.png`;
    case 'xlsx':
      return `${basePath}xlsx.png`;
    case 'ppt':
      return `${basePath}ppt.png`;
    case 'pptx':
      return `${basePath}pptx.png`;
    case 'log':
      return `${basePath}log.png`;
    case 'zip':
    case 'rar':
    case '7z':
      return `${basePath}zip.png`; // Using a generic zip icon
    case 'exe':
    case 'msi':
      return `${basePath}exe.png`; // Using a generic exe icon
    case 'iso':
      return `${basePath}iso.png`; // Using a generic iso icon
    case 'java':
    case 'js':
    case 'py':
    case 'cs':
    case 'cpp':
    case 'c':
      return `${basePath}code.png`; // Using a generic code icon
    default:
      return `${basePath}/file.png`; // Default file icon
  }
};

function CloudStorageSidebar({ isOpen, onClose, currentUserId }) {
  const [usedStorage, setUsedStorage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]); // New state for files
  const [folderCreationError, setFolderCreationError] = useState(null);
  const [, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [, setUploadError] = useState(null);
  const [, setUploadSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // New state for upload status
  const [activeTab, setActiveTab] = useState('folders'); // 'folders' or 'upload'
  const [openMenuId, setOpenMenuId] = useState(null); // State to track which folder's menu is open
  const [renamingFolderId, setRenamingFolderId] = useState(null); // State to track which folder is being renamed
  const [newFolderNameInput, setNewFolderNameInput] = useState(''); // State for the new folder name input
  const [currentParentFolderId, setCurrentParentFolderId] = useState(null); // New state for current parent folder
  const [folderPathHistory, setFolderPathHistory] = useState([]); // To keep track of folder navigation history (stores {id, name} objects)
  const fileInputRef = useRef(null); // Ref for the hidden file input
  const [selectedFolderForUpload, setSelectedFolderForUpload] = useState(null); // New state to store folder ID for upload
  const currentXhr = useRef(null); // Use useRef to store the current XHR object
  const toastIdRef = useRef(null);

  const cancelUpload = (toastId) => {
    if (currentXhr.current) {
      currentXhr.current.abort();
    }
    if (toastId) {
      toast.dismiss(toastId);
    }
  };
 



  const handleUpload = async (fileToUpload) => {
    if (!fileToUpload) {
      toast.error('Please select a file to upload.');
      return;
    }

    setIsUploading(true); // Set uploading status to true
    const toastId = toast.info(
      <UploadProgressToast progress={0} cancelUpload={() => cancelUpload(toastId)} />,
      { autoClose: false, closeButton: false, draggable: false }
    );
    toastIdRef.current = toastId; // Store toastId in ref

    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('userId', currentUserId);
    formData.append('folderId', selectedFolderForUpload); // Use the state variable directly
    console.log('FormData content:', { file: fileToUpload.name, userId: currentUserId, folderId: selectedFolderForUpload });

    try {
      setUploadError(null);
      setUploadSuccess(false);

      const xhr = new XMLHttpRequest();
      currentXhr.current = xhr; // Store XHR object in ref
      console.log('XHR object set:', xhr);

          xhr.upload.addEventListener('progress', (event) => {
        console.log('Upload progress event:', event);
        if (event.lengthComputable) {
          const percentCompleted = Math.round((event.loaded * 100) / event.total);
          console.log(`File: ${fileToUpload.name}, Loaded: ${event.loaded}, Total: ${event.total}, Percent: ${percentCompleted}%`);
          toast.update(toastId, { render: <UploadProgressToast progress={percentCompleted} cancelUpload={() => cancelUpload(toastId)} />, type: 'info' });
          setUploadProgress(percentCompleted);
        }
      });

      xhr.open('POST', `${process.env.REACT_APP_BACKEND_URL}/api/cloud/upload`);
      xhr.send(formData);

      xhr.onload = () => {
        toast.dismiss(toastId);
        console.log('XHR onload triggered. Status:', xhr.status, 'Response:', xhr.responseText);
        if (xhr.status === 200) {
          toast.success(`${fileToUpload.name} uploaded successfully!`);
          setUploadSuccess(true);
          setSelectedFile(null);
          fetchStorageUsage();
          setSelectedFolderForUpload(null); // Clear selected folder for upload
        } else {
          const errorData = JSON.parse(xhr.responseText);
          toast.error(errorData.msg || 'File upload failed.');
          setUploadError(errorData.msg || 'File upload failed.');
        }
        setIsUploading(false); // Set uploading status to false on load
        currentXhr.current = null; // Clear XHR object
      };

      xhr.onerror = () => {
        toast.dismiss(toastId);
        console.error('XHR onerror triggered. Network error or server unreachable.');
        toast.error('Network error or server unreachable.');
        setUploadError('Network error or server unreachable.');
        setIsUploading(false); // Set uploading status to false on error
        currentXhr.current = null; // Clear XHR object
      };

      xhr.onabort = () => {
        toast.dismiss(toastId);
        toast.info('Upload cancelled.');
        setUploadProgress(0);
        setIsUploading(false);
        currentXhr.current = null;
      };

    } catch (err) {
      console.error('Error during upload:', err);
      setUploadError('An unexpected error occurred during upload.');
      setIsUploading(false); // Set uploading status to false on unexpected error
      currentXhr.current = null; // Clear XHR object
    }
  };
    const fetchItems = useCallback(async () => {
    try {
      // Fetch folders
      const foldersResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/cloud/folders?ownerId=${currentUserId}${currentParentFolderId ? `&parentFolderId=${currentParentFolderId}` : ''}`);
      if (!foldersResponse.ok) {
        throw new Error(`HTTP error! status: ${foldersResponse.status}`);
      }
      const foldersData = await foldersResponse.json();
      setFolders(foldersData.folders);

      // Fetch files
      const filesResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/cloud/files?ownerId=${currentUserId}${currentParentFolderId ? `&folderId=${currentParentFolderId}` : '&folderId=null'}`);
      if (!filesResponse.ok) {
        throw new Error(`HTTP error! status: ${filesResponse.status}`);
      }
      const filesData = await filesResponse.json();
      console.log('Fetched files:', filesData.files);
      setFiles(filesData.files);

    } catch (err) {
      console.error("Error fetching items:", err);
    }
  }, [currentUserId, currentParentFolderId]);

  const handleFolderClick = (folderId, folderName) => {
    setFolderPathHistory(prevHistory => [...prevHistory, { id: folderId, name: folderName }]);
    setCurrentParentFolderId(folderId);
  };

  const handleBreadcrumbClick = (index) => {
    if (index === -1) { // Clicked on Root
      setFolderPathHistory([]);
      setCurrentParentFolderId(null);
    } else {
      const newHistory = folderPathHistory.slice(0, index + 1);
      setFolderPathHistory(newHistory);
      setCurrentParentFolderId(newHistory[newHistory.length - 1].id);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setFolderCreationError('Folder name cannot be empty.');
      return;
    }
    setFolderCreationError(null);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/cloud/folders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newFolderName, ownerId: currentUserId, parentFolderId: currentParentFolderId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.msg || 'Failed to create folder');
      }

      await response.json();
      setNewFolderName('');
      // Folders will be updated via socket.io event
    } catch (err) {
      console.error('Error creating folder:', err);
      setFolderCreationError(err.message);
    }
  };

  const handleFileChange = (event) => {
    console.log('handleFileChange triggered.');
    const file = event.target.files[0];
    if (file) {
      // Client-side check for file size and total storage before upload
      if (file.size > MAX_STORAGE_BYTES) {
        toast.error(`File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed file size of ${(MAX_STORAGE_BYTES / (1024 * 1024)).toFixed(0)} MB.`);
        setSelectedFile(null);
        setUploadSuccess(false);
        setUploadProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = ''; // Clear the file input
        }
        return; // Stop the function here if file is too large
      }

      if (usedStorage + file.size > MAX_STORAGE_BYTES) {
        toast.error(`Not enough storage space. You have ${(usedStorage / (1024 * 1024)).toFixed(2)} MB used and the limit is ${(MAX_STORAGE_BYTES / (1024 * 1024)).toFixed(0)} MB.`);
        setSelectedFile(null);
        setUploadSuccess(false);
        setUploadProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = ''; // Clear the file input
        }
        return; // Stop the function here if not enough storage
      }

      setSelectedFile(file);
      setUploadError(null);
      setUploadSuccess(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Clear the file input
      }
      // Always trigger upload after file selection
      handleUpload(file); // Pass the file directly
    }
  };

  const handleUploadClick = (folderId) => {
    console.log('handleUploadClick triggered for folderId:', folderId);
    setSelectedFolderForUpload(folderId);
    fileInputRef.current.click(); // Trigger the hidden file input
  };

  const handleDeleteFolder = async (folderId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/cloud/folders/${folderId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: currentUserId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.msg || 'Failed to delete folder');
      }

      // Remove the deleted folder from the state
      setFolders(prevFolders => prevFolders.filter(folder => folder._id !== folderId));
    } catch (err) {
      console.error('Error deleting folder:', err);
      // Optionally, show an error message to the user
    }
  };

  const handleDeleteFile = async (fileId, fileSize) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/cloud/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: currentUserId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.msg || 'Failed to delete file');
      }

      // Remove the deleted file from the state
      setFiles(prevFiles => prevFiles.filter(file => file._id !== fileId));
      setUsedStorage(prevStorage => prevStorage - fileSize); // Update used storage
    } catch (err) {
      console.error('Error deleting file:', err);
      // Optionally, show an error message to the user
    }
  };

  const toggleFolderMenu = (folderId) => {
    setOpenMenuId(openMenuId === folderId ? null : folderId);
  };

  const startRename = (folderId, currentName) => {
    console.log('startRename called for folderId:', folderId, 'currentName:', currentName);
    setRenamingFolderId(folderId);
    setNewFolderNameInput(currentName);
    setOpenMenuId(null); // Close the menu
  };

  const cancelRename = useCallback(() => {
    console.log('cancelRename called.');
    setRenamingFolderId(null);
    setNewFolderNameInput('');
  }, []);

  const handleRenameFolder = async (folderId) => {
    console.log('handleRenameFolder called for folderId:', folderId, 'newName:', newFolderNameInput);
    if (!newFolderNameInput.trim()) {
      // Optionally, show an error for empty name
      return;
    }
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/cloud/folders/${folderId}/rename`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newName: newFolderNameInput, userId: currentUserId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.msg || 'Failed to rename folder');
      }

      // Update the folder name in the state
      setFolders(prevFolders =>
        prevFolders.map(folder =>
          folder._id === folderId ? { ...folder, name: newFolderNameInput } : folder
        )
      );
      cancelRename(); // Exit rename mode
    } catch (err) {
      console.error('Error renaming folder:', err);
      // Optionally, show an error message to the user
    }
  };

  const fetchStorageUsage = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/cloud-storage-usage?userId=${currentUserId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setUsedStorage(data.cloudStorageUsed);
    } catch (err) {
      console.error("Error fetching cloud storage usage:", err);
      setError("Failed to load storage data.");
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (isOpen && currentUserId) {
      setLoading(true); // Set loading true only on initial open
      fetchStorageUsage();
    }
  }, [isOpen, currentUserId, fetchStorageUsage]);

  useEffect(() => {
    if (isOpen && currentUserId) {
        fetchItems(); // Fetch folders and files when sidebar opens

        socket.on('newCloudFolder', (newFolder) => {
          setFolders(prevFolders => [newFolder, ...prevFolders]);
        });

        socket.on('cloudFolderDeleted', (deletedFolderId) => {
          setFolders(prevFolders => prevFolders.filter(folder => folder._id !== deletedFolderId));
        });

        socket.on('cloudFolderRenamed', ({ folderId, newName }) => {
          setFolders(prevFolders =>
            prevFolders.map(folder =>
              folder._id === folderId ? { ...folder, name: newName } : folder
            )
          );
        });

        socket.on('newCloudFile', (newFile) => {
          // Only add the new file if it belongs to the currently viewed folder
          const isRootFile = currentParentFolderId === null || currentParentFolderId === 'null';
          const isNewFileInRoot = newFile.folder === null;
          const isNewFileInCurrentFolder = newFile.folder === currentParentFolderId;

          if ((isRootFile && isNewFileInRoot) || (!isRootFile && isNewFileInCurrentFolder)) {
            setFiles(prevFiles => [newFile, ...prevFiles]);
          }
        });

        socket.on('cloudFileDeleted', (deletedFileId) => {
          setFiles(prevFiles => prevFiles.filter(file => file._id !== deletedFileId));
        });

        const handleClickOutside = (event) => {
          // Close menu if click is outside the folder/file item and its menu
          if (openMenuId && !event.target.closest('.folder-item') && !event.target.closest('.file-item')) {
            setOpenMenuId(null);
          }
          // Close rename input if click is outside the entire sidebar
          if (renamingFolderId && !event.target.closest('.sidebar')) {
            cancelRename();
          }
        };

        document.addEventListener('click', handleClickOutside);

        return () => {
          socket.off('newCloudFolder');
          socket.off('cloudFolderDeleted');
          socket.off('cloudFolderRenamed');
          socket.off('newCloudFile');
          socket.off('cloudFileDeleted');
          document.removeEventListener('click', handleClickOutside);
        };
      }
  }, [isOpen, currentUserId, fetchItems, currentParentFolderId, folderPathHistory, openMenuId, renamingFolderId, cancelRename]);

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header cloud-storage-header">
        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="feather feather-hard-drive"
            style={{ marginRight: '10px' }}
          >
            <line x1="22" y1="12" x2="2" y2="12"></line>
            <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
            <line x1="6" y1="16" x2="6.01" y2="16"></line>
            <line x1="10" y1="16" x2="10.01" y2="16"></line>
          </svg>
          <StorageProgressBar usedStorage={usedStorage} loading={loading} error={error} uploadProgress={uploadProgress} isUploading={isUploading} />
        </div>
      </div>
      <div className="sidebar-content">
        <div className="tabs-container">
          <button
            className={`tab-button ${activeTab === 'folders' ? 'active' : ''}`}
            onClick={() => setActiveTab('folders')}
          >
            Your Folders
          </button>
          
        </div>

        {activeTab === 'folders' && (
          <div className="folders-section">
            <div className="create-folder-section">
              <input
                type="text"
                placeholder="New folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="new-folder-input"
              />
              <button onClick={handleCreateFolder} className="create-folder-button">
                Create
              </button>
            </div>
            {folderCreationError && <p className="error-message">{folderCreationError}</p>}

            <div className="breadcrumb-container">
              <span className="breadcrumb-item" onClick={() => handleBreadcrumbClick(-1)}>Root</span>
              {folderPathHistory.map((folder, index) => (
                <span key={folder.id || `root-${index}`} className="breadcrumb-item" onClick={() => handleBreadcrumbClick(index)}>
                  / {folder.name}
                </span>
              ))}
            </div>

            <div className="current-folder-actions">
              <button
                className="upload-file-to-current-folder-button"
                onClick={() => handleUploadClick(currentParentFolderId)}
                disabled={isUploading} // Disable upload button during upload
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="feather feather-upload"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Upload File
              </button>
            </div>

            <div className="folders-grid">
              {folders.length === 0 && files.length === 0 ? (
                <p>No items yet. Create one!</p>
              ) : (
                <>
                  {folders.map((folder) => (
                    <div
                      key={folder._id}
                      className="folder-item"
                      onClick={renamingFolderId === folder._id ? null : () => handleFolderClick(folder._id, folder.name)} // Navigate into folder
                    >
                      {renamingFolderId === folder._id ? (
                        <div className="rename-input-container">
                          <input
                            type="text"
                            value={newFolderNameInput}
                            onChange={(e) => setNewFolderNameInput(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') handleRenameFolder(folder._id);
                            }}
                            onMouseDown={(e) => e.stopPropagation()} // Prevent folder navigation
                            className="folder-rename-input"
                          />
                        </div>
                      ) : (
                        <>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="feather feather-folder"
                          >
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                          </svg>
                          <span className="folder-name">{folder.name}</span>
                          <div className="folder-actions">
                            <button
                              className="three-dots-button"
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent folder item click
                                toggleFolderMenu(folder._id);
                              }}
                              style={{ opacity: openMenuId === folder._id ? 1 : undefined }}
                            >
                              &#8942;
                            </button>
                            {openMenuId === folder._id && (
                              <div className="folder-menu">
                                <button onClick={(e) => {
                                  e.stopPropagation(); // Prevent click from propagating to document
                                  startRename(folder._id, folder.name);
                                }}>Rename</button>
                                <button onClick={(e) => {
                                  e.stopPropagation(); // Prevent click from propagating to folder item
                                  handleDeleteFolder(folder._id);
                                  setOpenMenuId(null);
                                }}>Delete</button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {files.map((file) => (
                    <div
                      key={file._id}
                      className="file-item"
                    >
                      {console.log('File object:', file, 'File path:', file.path, 'File type:', file.fileType)}
                      {(() => {
                        const finalUrl = `${process.env.REACT_APP_BACKEND_URL}${encodeURI(file.path)}`;
                        console.log('Generated URL for preview:', finalUrl);
                        if (file.fileType.startsWith('image/')) {
                          return <img src={finalUrl} alt={file.name} className="file-thumbnail" onLoad={() => console.log('Image loaded successfully:', finalUrl)} onError={() => console.error('Image failed to load:', finalUrl)} />;
                        } else if (file.fileType.startsWith('video/')) {
                          return <video src={finalUrl} controls className="file-thumbnail" onLoadedData={() => console.log('Video loaded successfully:', finalUrl)} onError={() => console.error('Video failed to load:', finalUrl)} />;
                        } else {
                          return <img src={getFileIcon(file.name)} alt={`${file.fileType} icon`} className="file-thumbnail" onError={(e) => { e.target.onerror = null; e.target.src='/documentfilelogo/file.png' }} />;
                        }
                      })()}
                      <span>{(() => {
                        const fileName = file.name;
                        const lastDotIndex = fileName.lastIndexOf('.');
                        if (lastDotIndex === -1) {
                          return fileName.length > 10 ? fileName.substring(0, 10) : fileName;
                        }
                        const baseName = fileName.substring(0, lastDotIndex);
                        const extension = fileName.substring(lastDotIndex);
                        return baseName.length > 10 ? baseName.substring(0, 10) + extension : fileName;
                      })()}</span>
                      <div className="file-actions">
                        <button
                          className="three-dots-button"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent file item click
                            toggleFolderMenu(file._id); // Reusing toggleFolderMenu for files
                          }}
                          style={{ opacity: openMenuId === file._id ? 1 : undefined }}
                        >
                          &#8942;
                        </button>
                        {openMenuId === file._id && (
                          <div className="folder-menu"> {/* Reusing folder-menu class for styling */}
                            <a href={`${process.env.REACT_APP_BACKEND_URL}${encodeURI(file.path)}`} download={file.name}
                              onClick={(e) => {
                                e.preventDefault(); // Prevent default behavior (opening in new tab)
                                setOpenMenuId(null);
                                const link = e.currentTarget;
                                const url = link.href;
                                const fileName = link.download;

                                fetch(url)
                                  .then(response => response.blob())
                                  .then(blob => {
                                    const blobUrl = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = blobUrl;
                                    a.download = fileName;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    window.URL.revokeObjectURL(blobUrl);
                                  })
                                  .catch(error => console.error('Error downloading file:', error));
                              }}>
                              <button>Download</button>
                            </a>
                            <button onClick={() => {
                              handleDeleteFile(file._id, file.size);
                              setOpenMenuId(null);
                            }}>Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }} // Hidden file input
        disabled={isUploading} // Disable during upload
      />
    </div>
  );
}

export default CloudStorageSidebar;