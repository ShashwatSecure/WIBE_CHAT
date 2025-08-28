import React from 'react';

const UploadProgressToast = ({ progress, cancelUpload, toastId }) => {
  const handleCancelClick = () => {
    console.log('Cancel button clicked in toast.');
    cancelUpload(toastId);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <span>Uploading: {progress}%</span>
      <button
        onClick={handleCancelClick}
        style={{
          marginLeft: '10px',
          padding: '5px 10px',
          backgroundColor: '#dc3545',
          color: 'white',
          border: 'none',
          borderRadius: '3px',
          cursor: 'pointer',
        }}
      >
        Cancel
      </button>
    </div>
  );
};

export default UploadProgressToast;