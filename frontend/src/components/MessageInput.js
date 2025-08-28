import React, { useState, useRef, useEffect } from 'react'; // Import useState and useRef
import EmojiPicker from 'emoji-picker-react'; // Import EmojiPicker
import DocumentUploadModal from './DocumentUploadModal';
import './MessageInput.css';
import './FilePreview.css';
import './FilePreviewActions.css';
import './DocumentPreview.css';
import './SendButton.css';
import './blocked-message-popup.css';

function MessageInput({ onSendMessage, isBlocked, socket, senderId, receiverId, hasBlockedReceiver, receiverName }) { // Receive isBlocked prop
  const [message, setMessage] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showDocumentUploadModal, setShowDocumentUploadModal] = useState(false);
  const [showBlockedMessagePopup, setShowBlockedMessagePopup] = useState(false); // New state for blocked message popup
  const handleOpenDocumentUploadModal = () => {
    setShowDocumentUploadModal(true);
    setShowAttachmentMenu(false); // Close attachment menu when modal opens
  };

  const handleCloseDocumentUploadModal = () => {
    setShowDocumentUploadModal(false);
  };
  const [showEmojiPicker, setShowEmojiPicker] = useState(false); // New state for emoji picker
  const [showStickerPicker, setShowStickerPicker] = useState(false); // New state for sticker picker
  const [stickerPacks, setStickerPacks] = useState([]); // New state to store sticker packs
  const [selectedStickerPack, setSelectedStickerPack] = useState(null); // New state for selected sticker pack
  const [selectedFiles, setSelectedFiles] = useState([]); // New state for selected files (array)
  const [previewUrls, setPreviewUrls] = useState([]); // New state for preview URLs (array)
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0); // New state for carousel index
  const [showDocumentPreview, setShowDocumentPreview] = useState(false); // New state for document preview
  
  const fileInputRef = useRef(null); // New ref for file input
  const fileInputAllTypesRef = useRef(null); // New ref for all file types input
  const typingTimeoutRef = useRef(null);
  const emojiPickerRef = useRef(null); // New ref for emoji picker container
  const stickerPickerRef = useRef(null); // New ref for sticker picker container
  const attachmentMenuRef = useRef(null); // New ref for attachment menu container
  const filePreviewRef = useRef(null); // New ref for file preview popup

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target) && !event.target.closest('.emoji-button')) {
        setShowEmojiPicker(false);
      }
      if (stickerPickerRef.current && !stickerPickerRef.current.contains(event.target) && !event.target.closest('.sticker-button')) {
        setShowStickerPicker(false);
      }
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target) && !event.target.closest('.plus-button')) {
        setShowAttachmentMenu(false);
      }
      if (filePreviewRef.current && !filePreviewRef.current.contains(event.target) && !event.target.closest('.file-preview-popup')) {
        handleCancelPreview();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (showBlockedMessagePopup) {
      const timer = setTimeout(() => {
        setShowBlockedMessagePopup(false);
      }, 3000); // Hide after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [showBlockedMessagePopup]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isBlocked || hasBlockedReceiver) {
      setShowBlockedMessagePopup(true);
      return;
    }
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const toggleAttachmentMenu = () => {
    setShowAttachmentMenu(!showAttachmentMenu);
    setShowEmojiPicker(false); // Close emoji picker when attachment menu opens
    setShowStickerPicker(false); // Close sticker picker when attachment menu opens
  };

  const toggleEmojiPicker = () => {
    setShowEmojiPicker(!showEmojiPicker);
    setShowAttachmentMenu(false); // Close attachment menu when emoji picker opens
    setShowStickerPicker(false); // Close sticker picker when emoji picker opens
  };

  const toggleStickerPicker = () => {
    setShowStickerPicker(!showStickerPicker);
    setShowAttachmentMenu(false); // Close attachment menu when sticker picker opens
    setShowEmojiPicker(false); // Close emoji picker when sticker picker opens
    if (!showStickerPicker) { // If opening, fetch data
      fetchStickerPacks();
    }
  };

  const fetchStickerPacks = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/stickers/packs`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setStickerPacks(data);
      console.log('Fetched sticker packs metadata:', data);
    } catch (error) {
      console.error('Error fetching sticker packs metadata:', error);
    }
  };

  const handleStickerPackSelect = async (packIdentifier) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/stickers/pack/${packIdentifier}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setSelectedStickerPack(data);
      console.log('Fetched single sticker pack:', data);
    } catch (error) {
      console.error('Error fetching single sticker pack:', error);
    }
  };

  const handleStickerSelect = (stickerUrl) => {
    if (isBlocked || hasBlockedReceiver) {
      setShowBlockedMessagePopup(true);
      return;
    }
    onSendMessage(stickerUrl, false, true); // Send as image, not text, and indicate it's a sticker
    setShowStickerPicker(false); // Close sticker picker after sending
  };

  const handleEmojiSelect = (emojiObject) => {
    setMessage(prevMessage => prevMessage + emojiObject.emoji);
  };

  const handleFileChange = (event) => {
    let files = Array.from(event.target.files);

    // If the input was from "All Type" file input, filter out images and videos
    if (event.target === fileInputAllTypesRef.current) {
      files = files.filter(file => !file.type.startsWith('image/') && !file.type.startsWith('video/'));
    }

    if (files.length > 0) {
      setSelectedFiles(files);
      const urls = files.map(file => {
        console.log('handleFileChange: file object for createObjectURL:', file);
        return URL.createObjectURL(file);
      });
      setPreviewUrls(urls);
      setCurrentPreviewIndex(0); // Reset carousel index
      setShowAttachmentMenu(false); // Close attachment menu after selection
      console.log('handleFileChange: selectedFiles', files);
    }
  };

  const handleSendFile = () => {
    if (isBlocked || hasBlockedReceiver) {
      setShowBlockedMessagePopup(true);
      return;
    }
    if (selectedFiles.length > 0) {
      console.log('handleSendFile: Sending files', selectedFiles);
      selectedFiles.forEach((file, index) => {
        const isImageOrVideo = file.type.startsWith('image/') || file.type.startsWith('video/');
        if (isImageOrVideo) {
          onSendMessage(file, true, false, previewUrls[index], false); 
        } else {
          onSendMessage(file, true, false, previewUrls[index], true);
        }
      });

      setSelectedFiles([]);
      setPreviewUrls([]);
      setCurrentPreviewIndex(0); // Reset carousel index
      setShowDocumentPreview(false);
      console.log('handleSendFile: Cleared selectedFiles and previewUrls');
    }
  };

  const handleCancelPreview = () => {
    setSelectedFiles([]);
    setPreviewUrls([]);
    setCurrentPreviewIndex(0); // Reset carousel index
    setShowDocumentPreview(false);
  };

  const handleNextPreview = () => {
    setCurrentPreviewIndex(prevIndex => (prevIndex + 1) % selectedFiles.length);
  };

  const handlePrevPreview = () => {
    setCurrentPreviewIndex(prevIndex => (prevIndex - 1 + selectedFiles.length) % selectedFiles.length);
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);

    if (socket) {
      if (!typingTimeoutRef.current) {
        socket.emit('typing', { senderId, receiverId });
      }

      clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stopTyping', { senderId, receiverId });
        typingTimeoutRef.current = null;
      }, 1000);
    }
  };

  return (
    <form className="message-input-container" onSubmit={handleSubmit}>
      {previewUrls.length > 0 && (
        <div className="file-preview-popup" ref={filePreviewRef}>
          <div className="file-preview-content">
            {selectedFiles.length > 1 && (
              <button className="carousel-button prev" onClick={handlePrevPreview}>&#10094;</button>
            )}
            {
              (() => {
                const file = selectedFiles[currentPreviewIndex];
                const previewUrl = previewUrls[currentPreviewIndex];
                return (
                  <div className="carousel-item-wrapper" key={currentPreviewIndex}>
                    {file.type.startsWith('image/') ? (
                      <img src={previewUrl} alt="Preview" className="file-preview-image" />
                    ) : file.type.startsWith('video/') ? (
                      <video src={previewUrl} controls className="file-preview-video" />
                    ) : (
                      <div className="document-preview AllTypefile"> {/* Added AllTypefile class */}
                        {(() => {
                          const fileExtension = file.name.split('.').pop().toLowerCase();
                          let iconSrc = '/documentfilelogo/document.png'; // Default icon for all types

                          // Check for specific document types
                          if (fileExtension === 'pdf') {
                            iconSrc = '/documentfilelogo/pdf.png';
                          } else if (fileExtension === 'doc' || fileExtension === 'docx') {
                            iconSrc = '/documentfilelogo/docx.png';
                          } else if (fileExtension === 'xls' || fileExtension === 'xlsx') {
                            iconSrc = '/documentfilelogo/xlsx.png'; // Assuming xlsx.png exists
                          } else if (fileExtension === 'csv') {
                            iconSrc = '/documentfilelogo/csv.png';
                          } else if (fileExtension === 'txt' || fileExtension === 'log') {
                            iconSrc = '/documentfilelogo/log-file.png';
                          } else if (fileExtension === 'html' || fileExtension === 'htm') {
                            iconSrc = '/documentfilelogo/html.png';
                          } else if (fileExtension === 'exe') {
                            iconSrc = '/documentfilelogo/exe.png';
                          } else if (fileExtension === 'iso') {
                            iconSrc = '/documentfilelogo/iso.png';
                          }
                          // Add more conditions for other file types as needed

                          return <img src={iconSrc} alt={fileExtension} className="file-type-icon" />;
                        })()}
                        <span>{file.name}</span>
                      </div>
                    )}
                  </div>
                );
              })()
            }
            {selectedFiles.length > 1 && (
              <button className="carousel-button next" onClick={handleNextPreview}>&#10095;</button>
            )}
            <div className="file-preview-actions">
              <button type="button" onClick={handleCancelPreview}>Cancel</button>
              <button type="button" onClick={handleSendFile}>Send</button>
            </div>
          </div>
        </div>
      )}

      {showDocumentUploadModal && (
        <DocumentUploadModal
          onClose={handleCloseDocumentUploadModal}
          onFileUpload={(file) => {
            console.log('DocumentUploadModal: file object for createObjectURL:', file);
            const previewUrl = URL.createObjectURL(file);
            onSendMessage(file, true, false, previewUrl, true); // message, isFile, isSticker, filePreviewUrl, isDocument
            handleCloseDocumentUploadModal();
          }}
        />
      )}

      {showBlockedMessagePopup && (
        <div className="blocked-message-popup">
          First unblock the user to send messages.
        </div>
      )}

      {hasBlockedReceiver ? (
        <div className="blocked-message">You blocked {receiverName}.</div>
      ) : (
        isBlocked ? (
          <div className="blocked-message">You are blocked by {receiverName}.</div>
        ) : (
          <>
            <div className="input-wrapper">
              <button type="button" className={`plus-button ${showAttachmentMenu ? 'rotated' : ''}`} onClick={toggleAttachmentMenu}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor"/></svg>
              </button>
              <button type="button" className="emoji-button" onClick={toggleEmojiPicker}> {/* New emoji button */}
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5s.67 1.5 1.5 1.5zm3.5 6.5c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5z" fill="currentColor"/></svg>
              </button>
              <button type="button" className="sticker-button" onClick={toggleStickerPicker}> {/* Sticker button */}
                <img src="/wibeicon.png" alt="Sticker" style={{ width: '24px', height: '24px' }} />
              </button>
              <input
                type="text"
                placeholder="Type a message"
                className="message-input"
                value={message}
                onChange={handleTyping}
              />
              <button type="submit" className="send-msg">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/></svg>
              </button>
            </div>

            {showAttachmentMenu && (
              <div className="attachment-menu" ref={attachmentMenuRef}>
                <div className="attachment-menu-item" onClick={handleOpenDocumentUploadModal}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z" fill="currentColor"/></svg>
                  <span>Document</span>
                  
                </div>
                <div className="attachment-menu-item" onClick={() => fileInputRef.current.click()}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" fill="currentColor"/></svg>
                  <span>Photos and Videos</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </div>
                <div className="attachment-menu-item" onClick={() => fileInputAllTypesRef.current.click()}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" fill="currentColor"/></svg>
                  <span>All Type</span>
                  <input
                    type="file"
                    accept="*/*"
                    multiple
                    ref={fileInputAllTypesRef}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </div>
                
                
                
              </div>
            )}

            {showEmojiPicker && (
              <div className="emoji-picker-container" ref={emojiPickerRef}>
                <EmojiPicker onEmojiClick={handleEmojiSelect} />
              </div>
            )}

            {showStickerPicker && (
              <div className="sticker-picker-container" ref={stickerPickerRef}>
                {selectedStickerPack ? (
                  <>
                    <button onClick={() => setSelectedStickerPack(null)} className="back-to-packs-button">
                      Back to Packs
                    </button>
                    <div className="individual-stickers-grid">
                      {selectedStickerPack.stickers.map((sticker, index) => (
                        <img
                          key={index}
                                                      src={sticker.image_file}
                          alt={sticker.image_file}
                          className="individual-sticker-item"
                          onClick={() => {
                            handleStickerSelect(sticker.image_file);
                            setShowStickerPicker(false); // Close picker immediately after selection
                          }}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="sticker-packs-grid">
                    {stickerPacks.length > 0 ? (
                      stickerPacks.map(pack => (
                        <div key={pack.identifier} className="sticker-pack-item" onClick={() => handleStickerPackSelect(pack.identifier)}>
                          <img
                            src={pack.tray_image_file}
                            alt={pack.name}
                            className="sticker-pack-tray-image"
                          />
                          <span>{pack.name}</span>
                        </div>
                      ))
                    ) : (
                      <p>No sticker packs available.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )
      )}
    </form>
  );
}
export default MessageInput;

