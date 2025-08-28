import React, { useRef, useState } from 'react';
import './DocumentUploadModal.css';

function DocumentUploadModal({ onClose, onFileUpload }) {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
      setSelectedFile(files);
    }
  };

  const handleUploadClick = () => {
    if (selectedFile && selectedFile.length > 0) {
      selectedFile.forEach(file => onFileUpload(file));
      onClose();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Select Document</h2>
        <input
          type="file"
          accept=".doc,.docx,.pdf,.txt,.rtf,.odt,.html,.htm,.md,.tex,.xml,.json,.csv,.xls,.xlsx,.ppt,.pptx,.log"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
          multiple
        />
        <button onClick={() => fileInputRef.current.click()} className="select-file-button">
          Choose File
        </button>
        {selectedFile && selectedFile.length > 0 && (
          <div className="selected-files-list">
            <h3>Selected Files:</h3>
            <ul>
              {selectedFile.map((file, index) => (
                <li key={index}>{file.name}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="modal-actions">
          <button onClick={onClose} className="cancel-button">Cancel</button>
          <button onClick={handleUploadClick} disabled={!selectedFile} className="upload-button">Send</button>
        </div>
      </div>
    </div>
  );
}

export default DocumentUploadModal;