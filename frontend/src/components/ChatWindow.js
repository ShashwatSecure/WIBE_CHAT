import React, { useState, useEffect, useRef, memo } from 'react';
import './ChatWindow.css';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

function ChatWindow({ currentUserId, selectedFriend, onBlockUser, isBlocked, setIsBlocked, hasBlockedSelectedFriend, messages, setMessages, socket, onUnfriend }) {
  const [selectedMessages, setSelectedMessages] = useState([]); // New state for selected messages
  const [isDeleteMode, setIsDeleteMode] = useState(false); // New state for delete mode
  const [isTyping, setIsTyping] = useState(false);
  const [showMenu, setShowMenu] = useState(false); // New state for chat header menu
  const messageListRef = useRef(null);

  useEffect(() => {
    if (!selectedFriend) {
      setMessages([]);
      return;
    }
    setSelectedMessages([]); // Reset selected messages when friend changes
    setIsDeleteMode(false); // Reset delete mode when friend changes

    // Scroll to bottom when selectedFriend changes (i.e., chat window opens/changes)
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }

    // Fetch chat history
    const fetchMessages = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/messages?senderId=${currentUserId}&receiverId=${selectedFriend._id}`);
        const data = await response.json();
        if (response.ok) {
          console.log('Fetched messages from DB:', data.messages); // Added for debugging
          setMessages(data.messages);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    fetchMessages();

    // Mark messages as seen when chat window is opened/selected friend changes
    const markMessagesAsSeen = async () => {
      if (selectedFriend && currentUserId) {
        console.log(`Marking messages as seen: senderId=${selectedFriend._id}, receiverId=${currentUserId}`);
        try {
          await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/messages/mark-as-seen`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId: selectedFriend._id, receiverId: currentUserId }),
          });
          // Update local state to reflect seen status for messages sent by the other user
          setMessages(prevMessages =>
            prevMessages.map(msg =>
              msg.sender.toString() === selectedFriend._id.toString() && msg.status !== 'seen'
                ? { ...msg, status: 'seen' }
                : msg
            )
          );
        } catch (error) {
          console.error('Error marking messages as seen:', error);
        }
      }
    };

    markMessagesAsSeen();

    const handleNewMessage = (newMessage) => {
      console.log('Received new message via socket:', newMessage);
      // Only add message if it belongs to the currently selected chat
      if (selectedFriend && 
          ((newMessage.sender._id === selectedFriend._id && newMessage.receiver._id === currentUserId) ||
           (newMessage.receiver._id === selectedFriend._id && newMessage.sender._id === currentUserId)))
      {
          setMessages(prevMessages => {
            // Check if a message with the same server-generated _id already exists
            const exists = prevMessages.some(msg => msg._id === newMessage._id);
            if (!exists) {
              return [...prevMessages, newMessage];
            }
            return prevMessages;
          });
      }
    };

    socket.on('typing', ({ senderId }) => {
      if (senderId === selectedFriend?._id) {
        setIsTyping(true);
      }
    });

    socket.on('stopTyping', ({ senderId }) => {
      if (senderId === selectedFriend?._id) {
        setIsTyping(false);
      }
    });

    socket.on('newMessage', handleNewMessage);

    socket.on('messageConfirmed', ({ tempId, message }) => {
      console.log('Message confirmed:', message);
      setMessages(prevMessages =>
        prevMessages.map(msg => (msg._id === tempId ? { ...message, _id: message._id, imageUrl: message.imageUrl } : msg))
      );
    });

    const handleMessageStatusUpdate = ({ messageId, status }) => {
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg._id === messageId ? { ...msg, status } : msg
        )
      );
    };

    socket.on('messageStatusUpdate', handleMessageStatusUpdate);

    return () => {
      socket.off('typing');
      socket.off('stopTyping');
      socket.off('newMessage', handleNewMessage);
      socket.off('messageConfirmed');
      socket.off('messageStatusUpdate', handleMessageStatusUpdate);
    };
  }, [currentUserId, selectedFriend, setIsBlocked, setMessages, socket]);

  const handleSendMessage = async (messageContent, isFile = false, isSticker = false, filePreviewUrl = null, isDocument = false) => {
    console.log('handleSendMessage called with:', { messageContent, isFile, isSticker, filePreviewUrl, isDocument });
    if (socket && selectedFriend) {
      // If it's a document and messageContent is an array of files
      if (isDocument && Array.isArray(messageContent)) {
        for (const file of messageContent) {
          await sendSingleFile(file, isDocument, filePreviewUrl);
        }
      } else if (isFile) { // Existing logic for single file (image/video)
        await sendSingleFile(messageContent, isDocument, filePreviewUrl);
      } else if (isSticker) {
        let messageToSend = {
          senderId: currentUserId,
          receiverId: selectedFriend._id,
          tempId: `client-temp-${Date.now()}`,
          imageUrl: messageContent, // messageContent is the sticker URL
          content: '', // No text content for stickers
        };
        socket.emit('sendMessage', messageToSend);
        // Optimistically update the UI for the sender
        const tempMessage = {
          _id: messageToSend.tempId,
          sender: { _id: currentUserId },
          receiver: { _id: selectedFriend._id },
          content: messageToSend.content,
          imageUrl: messageToSend.imageUrl,
          filePreviewUrl: messageToSend.filePreviewUrl,
          isDocument: messageToSend.isDocument,
          timestamp: new Date(),
          status: 'sent',
          unblurredBy: [],
        };
        setMessages(prevMessages => [...prevMessages, tempMessage]);
      } else {
        let messageToSend = {
          senderId: currentUserId,
          receiverId: selectedFriend._id,
          tempId: `client-temp-${Date.now()}`,
          content: messageContent,
        };
        socket.emit('sendMessage', messageToSend);
        // Optimistically update the UI for the sender
        const tempMessage = {
          _id: messageToSend.tempId,
          sender: { _id: currentUserId },
          receiver: { _id: selectedFriend._id },
          content: messageToSend.content,
          imageUrl: messageToSend.imageUrl,
          filePreviewUrl: messageToSend.filePreviewUrl,
          isDocument: messageToSend.isDocument,
          timestamp: new Date(),
          status: 'sent',
          unblurredBy: [],
        };
        setMessages(prevMessages => [...prevMessages, tempMessage]);
      }
    }
  };

  const sendSingleFile = async (file, isDocument, filePreviewUrl) => {
    console.log('sendSingleFile: Starting file send for', file.name);
    const tempId = `client-temp-${Date.now()}`;

    // 1. Create a temporary message for immediate UI update
    const tempMessage = {
      _id: tempId,
      sender: { _id: currentUserId },
      receiver: { _id: selectedFriend._id },
      content: isDocument ? file.name : '',
      imageUrl: filePreviewUrl, // Use the local blob URL for the preview
      isDocument: isDocument,
      fileType: file.type,
      timestamp: new Date(),
      status: 'sending', // Show a sending indicator
      unblurredBy: [],
    };
    setMessages(prevMessages => [...prevMessages, tempMessage]);
    console.log('sendSingleFile: Optimistic message added to UI with tempId:', tempId);

    // 2. Upload the file
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', currentUserId);
    formData.append('fileType', file.type);

    try {
      console.log('sendSingleFile: Uploading file to /api/messages/upload-chat-file...');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/messages/upload-chat-file`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      console.log('sendSingleFile: File upload response:', { ok: response.ok, status: response.status, data });


      if (!response.ok) {
        throw new Error(data.msg || 'File upload failed');
      }

      // 3. Once uploaded, send the real message data via socket
      const messageToSend = {
        senderId: currentUserId,
        receiverId: selectedFriend._id,
        tempId: tempId, // Important: send the same tempId to the server
        content: isDocument ? file.name : '',
        imageUrl: data.file.path, // The permanent URL from the server
        isDocument: isDocument,
        fileType: file.type,
      };

      console.log('sendSingleFile: Emitting sendMessage event with data:', messageToSend);
      socket.emit('sendMessage', messageToSend);
      console.log('sendSingleFile: sendMessage event emitted.');

    } catch (error) {
      console.error('Error during file upload or message sending:', error);
      // If anything fails, update the message status to 'failed'
      setMessages(prevMessages => prevMessages.map(msg =>
        msg._id === tempId ? { ...msg, status: 'failed' } : msg
      ));
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
      });
      const data = await response.json();
      if (response.ok) {
        console.log(data.msg);
        setMessages(prevMessages => prevMessages.filter(msg => msg._id !== messageId));
      } else {
        console.error('Failed to delete message:', data.msg);
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const handleUnblurMessage = async (messageId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/messages/unblur`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, userId: currentUserId }),
      });
      const data = await response.json();
      if (response.ok) {
        console.log(data.msg);
        // Update the message in the state to reflect it's unblurred
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg._id === messageId ? { ...msg, unblurredBy: [...msg.unblurredBy, { _id: currentUserId }] } : msg
          )
        );
      } else {
        console.error('Failed to unblur message:', data.msg);
      }
    } catch (error) {
      console.error('Error unblurring message:', error);
    }
  };

  const onSelectMessage = (messageId) => {
    setSelectedMessages(prevSelected =>
      prevSelected.includes(messageId)
        ? prevSelected.filter(id => id !== messageId)
        : [...prevSelected, messageId]
    );
  };

  const handleDeleteSelectedMessages = async () => {
    console.log('Delete Selected button clicked!'); // Added for debugging
    if (selectedMessages.length === 0) return;

    // Confirmation dialog
    const confirmDelete = window.confirm(`Are you sure you want to delete ${selectedMessages.length} selected messages?`);
    if (!confirmDelete) {
      return; // User cancelled the deletion
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/messages/delete-multiple`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds: selectedMessages, userId: currentUserId }),
      });
      const data = await response.json();
      if (response.ok) {
        console.log(data.msg);
        setMessages(prevMessages => prevMessages.filter(msg => !selectedMessages.includes(msg._id)));
        setSelectedMessages([]); // Clear selection after deletion
        setIsDeleteMode(false); // Exit delete mode after deletion
      } else {
        console.error('Failed to delete selected messages:', data.msg);
      }
    } catch (error) {
      console.error('Error deleting selected messages:', error);
    }
  };

  const handleEnterDeleteMode = () => {
    setIsDeleteMode(true);
    console.log('Entering delete mode. isDeleteMode:', true);
  };

  const handleExitDeleteMode = () => {
    setIsDeleteMode(false);
    setSelectedMessages([]); // Clear any selections when exiting delete mode
    console.log('Selected messages after clearing:', selectedMessages); // Add this line
  };

  return (
    <div className="chat-window" onClick={() => setShowMenu(false)}>
      {!selectedFriend ? (
        <div className="welcome-message-container">
          
          <h2>Welcome to Chatapp!</h2>
          <p>Start chatting with anyone by selecting a friend from the chat list.</p>
        </div>
      ) : (
        <>
          <ChatHeader userName={selectedFriend.name} userProfilePicture={selectedFriend.profilePicture} onBlockUser={() => onBlockUser(selectedFriend._id)} hasBlockedSelectedFriend={hasBlockedSelectedFriend} onToggleDeleteMode={handleEnterDeleteMode} isTyping={isTyping} isOnline={selectedFriend.isOnline} onUnfriend={() => onUnfriend(selectedFriend._id)} showMenu={showMenu} setShowMenu={setShowMenu} />
          <MessageList messages={messages} currentUserId={currentUserId} onUnblurMessage={handleUnblurMessage} onDeleteMessage={handleDeleteMessage} onSelectMessage={onSelectMessage} selectedMessages={selectedMessages} isDeleteMode={isDeleteMode} messageListRef={messageListRef} />
          {isDeleteMode && (
            <div className="delete-mode-actions">
              {selectedMessages.length > 0 && (
                <button onClick={handleDeleteSelectedMessages} className="delete-selected-messages-button">
                  Delete Selected ({selectedMessages.length})
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); console.log('Cancel button clicked!'); handleExitDeleteMode(); }} className="cancel-delete-button">
                Cancel
              </button>
            </div>
          )}
          <MessageInput onSendMessage={handleSendMessage} isBlocked={isBlocked} socket={socket} senderId={currentUserId} receiverId={selectedFriend._id} hasBlockedReceiver={hasBlockedSelectedFriend} receiverName={selectedFriend.name} />
        </>
      )}
    </div>
  );
}

export default memo(ChatWindow);