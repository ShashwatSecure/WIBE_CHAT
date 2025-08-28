import React, { useEffect, useRef, useState } from 'react';
import './MessageList.css';
import './DocumentMessage.css';

function MessageList({ messages, currentUserId, onUnblurMessage, onDeleteMessage, onSelectMessage, selectedMessages, isDeleteMode, messageListRef }) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const [hoveredMessageId, setHoveredMessageId] = useState(null); // New state to track hovered message
  const [downloadedMessages, setDownloadedMessages] = useState(() => {
    const storedDownloaded = localStorage.getItem('downloadedMessages');
    return storedDownloaded ? JSON.parse(storedDownloaded) : [];
  });

  useEffect(() => {
    localStorage.setItem('downloadedMessages', JSON.stringify(downloadedMessages));
  }, [downloadedMessages]);

  const handleMouseEnter = (messageId) => {
    setHoveredMessageId(messageId);
  };

  const handleMouseLeave = () => {
    setHoveredMessageId(null);
  };

  const handleDownloadClick = (messageId, event) => {
    event.preventDefault(); // Prevent default behavior (opening in new tab)
    setDownloadedMessages(prev => [...prev, messageId]);
    onUnblurMessage(messageId);
    // Manually trigger download
    const link = event.currentTarget;
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
  };

  const getFileExtension = (filename) => {
    return filename.split('.').pop().toLowerCase();
  };

  const getFileNameFromUrl = (url) => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const parts = pathname.split('/');
      return parts[parts.length - 1];
    } catch (error) {
      console.error("Invalid URL:", url, error);
      return url; // Return original URL if it's not a valid URL
    }
  };

  const getDocumentIcon = (extension) => {
    switch (extension) {
      case 'pdf':
        return <img src="/documentfilelogo/pdf.png" alt="PDF Icon" className="document-type-icon" />;
      case 'doc':
      case 'docx':
        return <img src="/documentfilelogo/docx.png" alt="Word Icon" className="document-type-icon" />;
      case 'xls':
      case 'xlsx':
        return <img src="/documentfilelogo/xlsx.png" alt="Excel Icon" className="document-type-icon" />;
      case 'ppt':
      case 'pptx':
        return <img src="/documentfilelogo/pptx-file.png" alt="PowerPoint Icon" className="document-type-icon" />;
      case 'zip':
      case 'rar':
        return <img src="/documentfilelogo/zip.png" alt="Archive Icon" className="document-type-icon" />;
      case 'txt':
        return <img src="/documentfilelogo/txt.png" alt="Text Icon" className="document-type-icon" />;
      case 'csv':
        return <img src="/documentfilelogo/csv.png" alt="CSV Icon" className="document-type-icon" />;
      case 'mp3':
      case 'wav':
      case 'aac':
        return <img src="/documentfilelogo/audio.png" alt="Audio Icon" className="document-type-icon" />;
      case 'mp4':
      case 'mov':
      case 'avi':
        return <img src="/documentfilelogo/video.png" alt="Video Icon" className="document-type-icon" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'webp':
        return <img src="/documentfilelogo/image.png" alt="" className="document-type-icon" />;
      default:
        return <img src="/documentfilelogo/file.png" alt="File Icon" className="document-type-icon" />;
    }
  };

  return(
    <div className="message-list" ref={messageListRef}>
      {messages.map((message, index) => {
        const senderId = (message.sender && typeof message.sender === 'object' ? message.sender._id : message.sender).toString();
        const isSender = senderId === currentUserId.toString();
        const isImage = message.imageUrl && message.fileType && message.fileType.startsWith('image/');
        const isVideo = message.imageUrl && message.fileType && message.fileType.startsWith('video/');
        const isSticker = message.imageUrl && message.imageUrl.startsWith('/hike-stickerd/');
        const isDocument = message.isDocument; // Check for isDocument flag
        const isBlurred = message.imageUrl && !isSender && !isSticker && !message.unblurredBy.some(user => user._id.toString() === currentUserId.toString());
        const imageUrl = message.imageUrl ? (message.imageUrl.startsWith('http') || message.imageUrl.startsWith('blob:') ? message.imageUrl : `${process.env.REACT_APP_BACKEND_URL}${message.imageUrl}`) : '';
        console.log('MessageList: message.isDocument=', message.isDocument, 'imageUrl=', imageUrl);

        return (
          <div
            key={message._id || index}
            className={`message ${
              (message.sender && typeof message.sender === 'object' ? message.sender._id : message.sender).toString() === currentUserId.toString()
                ? 'sent'
                : 'received'
            } ${isSticker ? 'no-background-message' : ''}`}
            onMouseEnter={() => handleMouseEnter(message._id || index)}
            onMouseLeave={handleMouseLeave}
          >
            {isSender ? (
              <>
                {message.content && <p>{message.content}</p>}
                {isImage && message.imageUrl && (
                  <img src={imageUrl} alt="" className={`message-image ${isBlurred ? 'blurred-image' : ''}`} onClick={() => isBlurred && onUnblurMessage(message._id)} />
                )}
                {isVideo && message.imageUrl && (
                  <video src={imageUrl} controls className={`message-video ${isBlurred ? 'blurred-image' : ''}`} onClick={() => isBlurred && onUnblurMessage(message._id)} />
                )}
                {isSticker && message.imageUrl && (
                  <img src={imageUrl} alt="Sticker" className="message-sticker" />
                )}
                {isDocument && message.imageUrl && !isImage && !isVideo && (
                  <div className="document-message-container">
                    <div className="document-icon">{getDocumentIcon(getFileExtension(getFileNameFromUrl(imageUrl)))}</div>
                    <span className="document-file-name">{getFileNameFromUrl(imageUrl)}</span>
                  </div>
                )}
                <div className="message-meta">
                  <span className="message-time">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {isSender && (
                    <span className="message-status">
                      {message.status === 'sent' && '✓'}
                      {message.status === 'delivered' && '✓✓'}
                      {message.status === 'seen' && <span className="seen-ticks">✓✓</span>}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                {message.content && <p>{message.content}</p>}
                {isImage && message.imageUrl && (
                  <div className="image-video-container">
                    <img src={imageUrl} alt="" className={`message-image ${isBlurred ? 'blurred-image' : ''}`} onClick={() => isBlurred && onUnblurMessage(message._id)} />
                    {!downloadedMessages.includes(message._id) && (
                      <a
                        href={imageUrl}
                        download
                        className="download-icon"
                        title={`Download ${getFileNameFromUrl(imageUrl)}`}
                        onClick={(e) => handleDownloadClick(message._id, e)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                      </a>
                    )}
                  </div>
                )}
                {isVideo && message.imageUrl && (
                  <div className="image-video-container">
                    <video src={imageUrl} controls className={`message-video ${isBlurred ? 'blurred-image' : ''}`} onClick={() => isBlurred && onUnblurMessage(message._id)} />
                    {!downloadedMessages.includes(message._id) && (
                      <a
                        href={imageUrl}
                        download
                        className="download-icon"
                        title={`Download ${getFileNameFromUrl(imageUrl)}`}
                        onClick={(e) => handleDownloadClick(message._id, e)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                      </a>
                    )}
                  </div>
                )}
                {isDocument && message.imageUrl && !isImage && !isVideo && (
                  <div className="document-message-container">
                    <div className="document-icon">{getDocumentIcon(getFileExtension(getFileNameFromUrl(imageUrl)))}</div>
                    <span className="document-file-name">{getFileNameFromUrl(imageUrl)}</span>
                    {!downloadedMessages.includes(message._id) && (
                      <a
                        href={imageUrl}
                        download
                        className="download-icon"
                        title={`Download ${getFileNameFromUrl(imageUrl)}`}
                        onClick={(e) => handleDownloadClick(message._id, e)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                      </a>
                    )}
                  </div>
                )}
                {isSticker && message.imageUrl && (
                  <img src={imageUrl} alt="Sticker" className="message-sticker" />
                )}
                <span className="message-time">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </>
            )}
            {isSender && isDeleteMode && (
              <>
                <input
                  type="checkbox"
                  className="message-checkbox"
                  checked={selectedMessages.includes(message._id)}
                  onChange={() => onSelectMessage(message._id)}
                />
                {hoveredMessageId === (message._id || index) && (
                  <button
                    className="delete-message-button"
                    onClick={() => {
                      const confirmDelete = window.confirm('Are you sure you want to delete this message?');
                      if (confirmDelete) {
                        onDeleteMessage(message._id);
                      }
                    }}
                    title="Delete Message"
                  >
                    &#x2715; {/* Multiplication X symbol for delete */}
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}

export default MessageList;
