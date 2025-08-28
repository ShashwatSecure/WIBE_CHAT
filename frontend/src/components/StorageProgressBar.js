import React from 'react';

const MAX_STORAGE_BYTES = 15 * 1024 * 1024 * 1024; // 15 GB in bytes

const StorageProgressBar = React.memo(({ usedStorage, loading, error, uploadProgress, isUploading }) => {

  const percentageUsed = Math.max(0, Math.min(100, (usedStorage / MAX_STORAGE_BYTES) * 100));
  const usedGB = (usedStorage / (1024 * 1024 * 1024)).toFixed(2);
  const maxGB = (MAX_STORAGE_BYTES / (1024 * 1024 * 1024)).toFixed(0);

  console.log(`StorageProgressBar: usedStorage=${usedStorage}, percentageUsed=${percentageUsed}, uploadProgress=${uploadProgress}, isUploading=${isUploading}`);

  return (
    <>
      {loading && <p>Loading storage data...</p>}
      {error && <p className="error-message">{error}</p>}
      {!loading && !error && (
        <div className="storage-info">
          {isUploading ? (
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ 
                  transform: `scaleX(${uploadProgress / 100})`,
                  backgroundColor: uploadProgress >= 80 ? 'red' : 'green'
                }}
              ></div>
            </div>
          ) : (
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ 
                  transform: `scaleX(${percentageUsed / 100})`,
                  backgroundColor: percentageUsed >= 80 ? 'red' : 'green'
                }}
              ></div>
            </div>
          )}
          <p>{isUploading ? `Uploading: ${uploadProgress}%` : `${usedGB} GB / ${maxGB} GB (${percentageUsed.toFixed(2)}%)`}</p>
          {percentageUsed >= 100 && (
            <p className="storage-limit-reached">Storage limit reached!</p>
          )}
        </div>
      )}
    </>
  );
});

export default StorageProgressBar;
