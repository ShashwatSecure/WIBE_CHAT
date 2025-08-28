import React, { useState, useEffect, useCallback, useRef } from 'react';
import socket from '../socket';
import './ChatPage.css';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import ProfilePopup from './ProfilePopup';
import SearchSidebar from './SearchSidebar';
import NotificationSidebar from './NotificationSidebar';
import FriendsSidebar from './FriendsSidebar';
import CloudStorageSidebar from './CloudStorageSidebar';
import MusicSidebar from './MusicSidebar';
console.log('MusicSidebar imported successfully.', MusicSidebar);
console.log('CloudStorageSidebar imported successfully in ChatPage.js');


function ChatPage({ userName, userEmail, userUsername, userProfilePicture, onLogout, onUpdateProfile, currentUserId, onNotificationCountChange, isSearchSidebarOpen, toggleSearchSidebar, isNotificationSidebarOpen, toggleNotificationSidebar, isFriendsSidebarOpen, toggleFriendsSidebar, pendingRequestsCount, onlineUsers, isCloudStorageSidebarOpen, setCloudStorageSidebarOpen, toggleCloudStorageSidebar }) {
  console.log('ChatPage: Component rendered. currentUserId (prop):', currentUserId); // New log at render
  console.log('ChatPage: Current socket.connected status (outside useEffect):', socket.connected); // New log
  const [isProfilePopupOpen, setProfilePopupOpen] = useState(false);
  const [showMusicSidebar, setShowMusicSidebar] = useState(false); // New state for music sidebar
  const [currentUser, setCurrentUser] = useState({ name: userName, email: userEmail, username: userUsername, profilePicture: userProfilePicture });
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friends, setFriends] = useState([]);
  const [messages, setMessages] = useState([]); // Moved from ChatWindow
  const [, setPendingRequests] = useState([]); // New state for pending requests
  const [sentRequests, setSentRequests] = useState([]); // New state for sent requests
  const [unreadCounts, setUnreadCounts] = useState({}); // New state for unread counts

  const handleUnreadCountUpdate = useCallback(({ senderId, newCount }) => {
    // Only update unread count if the chat window for that sender is not open
    if (!selectedFriendRef.current || selectedFriendRef.current._id !== senderId) {
      setUnreadCounts(prevCounts => ({
          ...prevCounts,
          [senderId]: newCount
      }));
    }
  }, []);

  const handleMessagesSeen = useCallback(({ chatPartnerId, senderId, receiverId }) => {
    console.log(`handleMessagesSeen: chatPartnerId=${chatPartnerId}, senderId=${senderId}, receiverId=${receiverId}`);
    setUnreadCounts(prevCounts => ({
        ...prevCounts,
        [chatPartnerId]: 0
    }));
    setMessages(prevMessages =>
        prevMessages.map(msg =>
            (msg.sender._id === chatPartnerId || msg.sender === chatPartnerId) && msg.status !== 'seen'
                ? { ...msg, status: 'seen' }
                : msg
        )
    );
    setFriends(prevFriends =>
      prevFriends.map(friend =>
        friend._id === chatPartnerId ? { ...friend, lastMessageStatus: 'seen' } : friend
      )
    );
  }, [setMessages, setFriends]);

  const handleMessageStatusUpdateForFriends = useCallback(({ messageId, status, senderId, receiverId }) => {
    console.log(`handleMessageStatusUpdateForFriends: messageId=${messageId}, status=${status}, senderId=${senderId}, receiverId=${receiverId}`);
    setFriends(prevFriends =>
      prevFriends.map(friend => {
        // Determine if the current friend is involved in this message status update
        const isSender = friend._id === senderId;
        const isReceiver = friend._id === receiverId;

        // If the friend is either the sender or receiver of the message
        // and the messageId matches their lastMessageId, update the status.
        // This ensures we only update the status of the *last* message shown in the chat list.
        if ((isSender || isReceiver) && friend.lastMessageId === messageId) {
          console.log(`Updating friend ${friend.name} (ID: ${friend._id}) lastMessageStatus from ${friend.lastMessageStatus} to ${status}. Matched messageId: ${messageId}, friend.lastMessageId: ${friend.lastMessageId}`);
          return { ...friend, lastMessageStatus: status };
        }
        return friend;
      })
    );
  }, [setFriends]);

  const fetchFriends = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/friends?userId=${currentUserId}`);
      const data = await response.json();
      if (response.ok) {
        const friendsWithOnlineStatus = data.friends.map(friend => ({
          ...friend,
          isOnline: onlineUsers.includes(friend._id) // Set isOnline based on onlineUsers prop
        }));
        console.log('Fetched friends data with lastMessageId and lastMessageStatus:', friendsWithOnlineStatus);
        setFriends(friendsWithOnlineStatus);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  }, [currentUserId, onlineUsers]);

  const fetchUnreadCounts = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/unreadCounts?userId=${currentUserId}`);
      const data = await response.json();
      if (response.ok) {
        setUnreadCounts(data);
      }
    } catch (error) {
      console.error('Error fetching unread counts:', error);
    }
  }, [currentUserId]);

  const fetchPendingRequests = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/friends/pending?userId=${currentUserId}`);
      const data = await response.json();
      if (response.ok) {
        setPendingRequests(data.pendingRequests);
      } else {
        console.error(data.msg || 'Failed to fetch pending requests.');
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    }
  }, [currentUserId]);

  const fetchSentRequests = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/friends/sent-requests?userId=${currentUserId}`);
      const data = await response.json();
      if (response.ok) {
        setSentRequests(data.sentRequestIds);
      } else {
        console.error(data.msg || 'Failed to fetch sent requests.');
      }
    } catch (error) {
      console.error('Error fetching sent requests:', error);
    }
  }, [currentUserId]);

  const [isBlocked, setIsBlocked] = useState(false); // New state for block status
  const [hasBlockedSelectedFriend, setHasBlockedSelectedFriend] = useState(false); // New state for block status of selected friend by current user

  const fetchBlockStatus = useCallback(async () => {
    if (selectedFriend) {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/blockStatus?user1Id=${currentUserId}&user2Id=${selectedFriend._id}`);
        const data = await response.json();
        if (response.ok) {
          // A user is blocked if either current user blocked friend, or friend blocked current user
          setIsBlocked(data.user2BlockedUser1);
          setHasBlockedSelectedFriend(data.user1BlockedUser2);
        } else {
          console.error('Failed to fetch block status:', data.msg);
          setIsBlocked(false);
        }
      } catch (error) {
        console.error('Error fetching block status:', error);
        setIsBlocked(false);
      }
    } else {
      setIsBlocked(false); // No friend selected, so not blocked
    }
  }, [currentUserId, selectedFriend]);

  const selectedFriendRef = useRef(selectedFriend);

  useEffect(() => {
    selectedFriendRef.current = selectedFriend;
  }, [selectedFriend]);

  const handleNewMessage = useCallback((newMessage) => {
      const isChatOpen = selectedFriendRef.current &&
                         ((newMessage.sender._id === selectedFriendRef.current._id && newMessage.receiver._id === currentUserId) ||
                          (newMessage.receiver._id === selectedFriendRef.current._id && newMessage.sender._id === currentUserId));

      if (isChatOpen) {
          const messageWithSeen = { ...newMessage, status: 'seen' };
          setMessages(prevMessages => {
              if (prevMessages.find(msg => msg._id === messageWithSeen._id)) {
                  return prevMessages;
              }
              return [...prevMessages, messageWithSeen];
          });
          socket.emit('messagesSeen', { chatPartnerId: selectedFriendRef.current._id, receiverId: currentUserId });
      } else {
          // Normal unread count handling will apply
      }

      setFriends(prevFriends => {
          const updatedFriends = prevFriends.map(friend => {
              if (friend._id === newMessage.sender._id || friend._id === newMessage.receiver._id) {
                  return {
                      ...friend,
                      lastMessage: newMessage.content,
                      lastMessageTimestamp: newMessage.timestamp,
                      lastMessageStatus: isChatOpen ? 'seen' : newMessage.status,
                      lastMessageId: newMessage._id
                  };
              }
              return friend;
          });
          return updatedFriends.sort((a, b) => {
              const timeA = a.lastMessageTimestamp ? new Date(a.lastMessageTimestamp).getTime() : 0;
              const timeB = b.lastMessageTimestamp ? new Date(b.lastMessageTimestamp).getTime() : 0;
              return timeB - timeA;
          });
      });
  }, [currentUserId, setMessages, setFriends]);

  const handleFriendRequestDeclined = useCallback(({ receiverName }) => {
      console.log(`ChatPage: Friend request declined by ${receiverName}.`);
      // NotificationSidebar will handle displaying this
  }, []);

  useEffect(() => {
    const handleUserOnline = (userId) => {
      setFriends(prevFriends => {
        const updatedFriends = prevFriends.map(friend =>
          friend._id === userId ? { ...friend, isOnline: true } : friend
        );
        return updatedFriends;
      });
    };

    const handleUserOffline = (userId) => {
      setFriends(prevFriends => {
        const updatedFriends = prevFriends.map(friend =>
          friend._id === userId ? { ...friend, isOnline: false, lastSeen: new Date() } : friend
        );
        return updatedFriends;
      });
    };

    socket.on('userOnline', handleUserOnline);
    socket.on('userOffline', handleUserOffline);

    return () => {
      socket.off('userOnline', handleUserOnline);
      socket.off('userOffline', handleUserOffline);
    };
  }, []);

  const handleNewFriendRequest = useCallback(() => {
      fetchPendingRequests();
  }, [fetchPendingRequests]);

  const handleBlockStatusUpdate = useCallback(({ user1Id, user2Id, user1BlockedUser2, user2BlockedUser1 }) => {
    console.log('Received blockStatusUpdate:', { user1Id, user2Id, user1BlockedUser2, user2BlockedUser1 });
    if (selectedFriendRef.current) {
      // If current user is user1 in the event
      if (currentUserId === user1Id) {
        if (selectedFriendRef.current._id === user2Id) {
          setHasBlockedSelectedFriend(user1BlockedUser2);
          setIsBlocked(user2BlockedUser1);
        }
      } 
      // If current user is user2 in the event
      else if (currentUserId === user2Id) {
        if (selectedFriendRef.current._id === user1Id) {
          setHasBlockedSelectedFriend(user2BlockedUser1);
          setIsBlocked(user1BlockedUser2);
        }
      }
    }
  }, [currentUserId, selectedFriendRef, setHasBlockedSelectedFriend, setIsBlocked]);

  useEffect(() => {
    console.log('ChatPage: Initial useEffect triggered. currentUserId:', currentUserId);
    if (!currentUserId) {
      console.log('ChatPage: currentUserId is not available yet. Skipping initial data fetches.');
      return;
    }

    fetchFriends();
    fetchPendingRequests();
    fetchSentRequests();
    fetchUnreadCounts();

    // Socket event listeners
    socket.on('error', (error) => {
      console.error('ChatPage: Socket.IO error:', error);
    });
    socket.on('newMessage', handleNewMessage);
    socket.on('unreadCountUpdate', handleUnreadCountUpdate);
    socket.on('messagesSeen', handleMessagesSeen);
    socket.on('messageStatusUpdate', handleMessageStatusUpdateForFriends);
    socket.on('newFriendRequest', handleNewFriendRequest);
    socket.on('friendRequestAccepted', fetchFriends);
    socket.on('friendRequestDeclined', handleFriendRequestDeclined);
    socket.on('blockStatusUpdate', handleBlockStatusUpdate);

    return () => {
      socket.off('error');
      socket.off('newMessage', handleNewMessage);
      socket.off('unreadCountUpdate', handleUnreadCountUpdate);
      socket.off('messagesSeen', handleMessagesSeen);
      socket.off('messageStatusUpdate', handleMessageStatusUpdateForFriends);
      socket.off('newFriendRequest', handleNewFriendRequest);
      socket.off('friendRequestAccepted', fetchFriends);
      socket.off('friendRequestDeclined', handleFriendRequestDeclined);
      socket.off('blockStatusUpdate', handleBlockStatusUpdate);
    };
  }, [currentUserId, fetchFriends, fetchPendingRequests, fetchSentRequests, fetchUnreadCounts, handleNewMessage, handleUnreadCountUpdate, handleMessagesSeen, handleMessageStatusUpdateForFriends, handleNewFriendRequest, handleFriendRequestDeclined, handleBlockStatusUpdate]);

  // New useEffect for block status
  useEffect(() => {
    fetchBlockStatus();
  }, [selectedFriend, fetchBlockStatus]);

  // New useEffect for socket auth
  useEffect(() => {
    if (currentUserId && socket.connected) {
      console.log('ChatPage: Emitting auth for userId:', currentUserId);
      socket.emit('auth', currentUserId);
    }
  }, [currentUserId, socket.connected]);

  // Set currentUser state once
  useEffect(() => {
    setCurrentUser({ name: userName, email: userEmail, username: userUsername, profilePicture: userProfilePicture });
  }, [userName, userEmail, userUsername, userProfilePicture]);

  const toggleProfilePopup = useCallback(() => {
    setProfilePopupOpen(prev => !prev);
  }, []);

  const toggleMusicSidebar = useCallback(() => {
    setShowMusicSidebar(prev => !prev);
  }, []);

  const handleUpdateProfile = useCallback(async (name, profilePicture, oldPassword, newPassword) => {
    const result = await onUpdateProfile(name, profilePicture, oldPassword, newPassword);
    if (result.success) {
      toggleProfilePopup();
    }
    return result;
  }, [onUpdateProfile, toggleProfilePopup]);

  const handleFriendSelect = useCallback((friend) => {
    const isFriendOnline = onlineUsers.includes(friend._id);
    setSelectedFriend({ ...friend, isOnline: isFriendOnline });
    // Reset unread count for the selected friend
    if (friend && friend._id) {
      setUnreadCounts(prevCounts => ({
        ...prevCounts,
        [friend._id]: 0
      }));
      // Optionally, you can also emit a 'messagesSeen' event to the server
      // to sync the read status across devices if needed.
      socket.emit('messagesSeen', { chatPartnerId: friend._id, receiverId: currentUserId });
    }
  }, [currentUserId, onlineUsers]);

  const handleFriendRequestSent = (userId) => {
    setSentRequests((prev) => [...prev, userId]);
  };

  const handleBlockUser = useCallback(async (friendId) => {
    console.log(`Blocking user with ID: ${friendId}`);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockerId: currentUserId, blockedId: friendId }),
      });
      const data = await response.json();
      if (response.ok) {
        console.log(data.msg);
        // Re-fetch block status to update the UI
        const responseStatus = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/blockStatus?user1Id=${currentUserId}&user2Id=${selectedFriend._id}`);
        const dataStatus = await responseStatus.json();
        if (responseStatus.ok) {
          setIsBlocked(dataStatus.user2BlockedUser1);
          setHasBlockedSelectedFriend(dataStatus.user1BlockedUser2);
        }
      } else {
        console.error(data.msg || 'Failed to block user');
      }
    } catch (error) {
      console.error('Error blocking user:', error);
    }
  }, [currentUserId, selectedFriend]);

  const handleUnfriend = useCallback(async (friendId) => {
    console.log(`Unfriending user with ID: ${friendId}`);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/friends/unfriend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, friendId: friendId }),
      });
      const data = await response.json();
      if (response.ok) {
        console.log(data.msg);
        // Remove the unfriended user from the friends list
        setFriends(prevFriends => prevFriends.filter(friend => friend._id !== friendId));
        // Deselect the friend if they were unfriended
        if (selectedFriend && selectedFriend._id === friendId) {
          setSelectedFriend(null);
        }
      } else {
        console.error(data.msg || 'Failed to unfriend user');
      }
    } catch (error) {
      console.error('Error unfriending user:', error);
    }
  }, [currentUserId, selectedFriend]);

  const handleChatPageClick = useCallback(() => {
    if (isCloudStorageSidebarOpen) {
      setCloudStorageSidebarOpen(false);
    }
  }, [isCloudStorageSidebarOpen, setCloudStorageSidebarOpen]);

  return (
    <div className="chat-page-container" onClick={handleChatPageClick}>
      <ChatList
        friends={friends}
        userName={currentUser.name}
        userProfilePicture={currentUser.profilePicture}
        toggleProfilePopup={toggleProfilePopup}
        handleLogout={onLogout}
        currentUserId={currentUserId}
        onFriendSelect={handleFriendSelect}
        onlineUsers={onlineUsers}
        unreadCounts={unreadCounts}
      />
      <ChatWindow
        currentUserId={currentUserId}
        selectedFriend={selectedFriend}
        onBlockUser={handleBlockUser} // Pass the block function
        isBlocked={isBlocked} // Pass block status
        setIsBlocked={setIsBlocked} // Pass setter for real-time updates
        hasBlockedSelectedFriend={hasBlockedSelectedFriend} // Pass block status for button label
        messages={messages} // Pass messages from ChatPage
        setMessages={setMessages} // Pass setMessages to ChatWindow
        socket={socket} // Pass the socket instance
        onUnfriend={handleUnfriend} // Pass unfriend function
      />

      {isProfilePopupOpen && (
        <ProfilePopup
          userName={currentUser.name}
          userEmail={currentUser.email}
          userProfilePicture={currentUser.profilePicture}
          onClose={toggleProfilePopup}
          onUpdate={handleUpdateProfile}
        />
      )}

      {currentUserId && (
        <SearchSidebar isOpen={isSearchSidebarOpen} onClose={toggleSearchSidebar} currentUserId={currentUserId} friends={friends} onFriendSelect={handleFriendSelect} sentRequests={sentRequests} onFriendRequestSent={handleFriendRequestSent} />
      )}

      <NotificationSidebar isOpen={isNotificationSidebarOpen} onClose={toggleNotificationSidebar} userId={currentUserId} onTotalNotificationCountChange={onNotificationCountChange} onNewFriendRequestReceived={fetchPendingRequests} />

      {currentUserId && (
        <FriendsSidebar isOpen={isFriendsSidebarOpen} onClose={toggleFriendsSidebar} friends={friends} onFriendSelect={handleFriendSelect} onUnfriend={handleUnfriend} />
      )}

      <CloudStorageSidebar isOpen={isCloudStorageSidebarOpen} onClose={() => setCloudStorageSidebarOpen(false)} />

      <MusicSidebar isOpen={showMusicSidebar} onClose={toggleMusicSidebar} />

      
      
    </div>
  );
}

export default ChatPage;