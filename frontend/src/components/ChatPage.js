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

// Helper: deterministic room id for 1-to-1 chats
const makeDirectRoomId = (a, b) => {
  if (!a || !b) return null;
  const [x, y] = [String(a), String(b)].sort(); // keep order stable
  return `room-${x}-${y}`;
};

function ChatPage({
  userName,
  userEmail,
  userUsername,
  userProfilePicture,
  onLogout,
  onUpdateProfile,
  currentUserId,
  onNotificationCountChange,
  isSearchSidebarOpen,
  toggleSearchSidebar,
  isNotificationSidebarOpen,
  toggleNotificationSidebar,
  isFriendsSidebarOpen,
  toggleFriendsSidebar,
  pendingRequestsCount,
  onlineUsers,
  isCloudStorageSidebarOpen,
  setCloudStorageSidebarOpen,
  toggleCloudStorageSidebar
}) {
  const [isProfilePopupOpen, setProfilePopupOpen] = useState(false);
  const [showMusicSidebar, setShowMusicSidebar] = useState(false);
  const [currentUser, setCurrentUser] = useState({
    name: userName,
    email: userEmail,
    username: userUsername,
    profilePicture: userProfilePicture
  });
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friends, setFriends] = useState([]);
  const [messages, setMessages] = useState([]);
  const [, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [isBlocked, setIsBlocked] = useState(false);
  const [hasBlockedSelectedFriend, setHasBlockedSelectedFriend] = useState(false);

  // Refs for stable access
  const selectedFriendRef = useRef(selectedFriend);
  const currentRoomRef = useRef(null);

  useEffect(() => {
    selectedFriendRef.current = selectedFriend;
  }, [selectedFriend]);

  // ==========================
  // Data fetching
  // ==========================
  const fetchFriends = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/friends?userId=${currentUserId}`
      );
      const data = await response.json();
      if (response.ok) {
        const friendsWithOnlineStatus = data.friends.map(friend => ({
          ...friend,
          isOnline: onlineUsers.includes(friend._id)
        }));
        setFriends(friendsWithOnlineStatus);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  }, [currentUserId, onlineUsers]);

  const fetchUnreadCounts = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/user/unreadCounts?userId=${currentUserId}`
      );
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
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/friends/pending?userId=${currentUserId}`
      );
      const data = await response.json();
      if (response.ok) {
        setPendingRequests(data.pendingRequests);
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    }
  }, [currentUserId]);

  const fetchSentRequests = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/friends/sent-requests?userId=${currentUserId}`
      );
      const data = await response.json();
      if (response.ok) {
        setSentRequests(data.sentRequestIds);
      }
    } catch (error) {
      console.error('Error fetching sent requests:', error);
    }
  }, [currentUserId]);

  const fetchBlockStatus = useCallback(async () => {
    if (selectedFriend) {
      try {
        const response = await fetch(
          `${process.env.REACT_APP_BACKEND_URL}/api/user/blockStatus?user1Id=${currentUserId}&user2Id=${selectedFriend._id}`
        );
        const data = await response.json();
        if (response.ok) {
          setIsBlocked(data.user2BlockedUser1);
          setHasBlockedSelectedFriend(data.user1BlockedUser2);
        } else {
          setIsBlocked(false);
        }
      } catch (error) {
        console.error('Error fetching block status:', error);
        setIsBlocked(false);
      }
    } else {
      setIsBlocked(false);
    }
  }, [currentUserId, selectedFriend]);

  // ==========================
  // Socket handlers
  // ==========================
  const handleNewMessage = useCallback(
    newMessage => {
      const isChatOpen =
        selectedFriendRef.current &&
        ((newMessage.sender._id === selectedFriendRef.current._id &&
          newMessage.receiver._id === currentUserId) ||
          (newMessage.receiver._id === selectedFriendRef.current._id &&
            newMessage.sender._id === currentUserId));

      if (isChatOpen) {
        const messageWithSeen = { ...newMessage, status: 'seen' };
        setMessages(prev =>
          prev.find(msg => msg._id === messageWithSeen._id)
            ? prev
            : [...prev, messageWithSeen]
        );
        socket.emit('messagesSeen', {
          chatPartnerId: selectedFriendRef.current._id,
          receiverId: currentUserId
        });
      }

      setFriends(prevFriends =>
        prevFriends
          .map(friend => {
            if (
              friend._id === newMessage.sender._id ||
              friend._id === newMessage.receiver._id
            ) {
              return {
                ...friend,
                lastMessage: newMessage.content,
                lastMessageTimestamp: newMessage.timestamp,
                lastMessageStatus: isChatOpen ? 'seen' : newMessage.status,
                lastMessageId: newMessage._id
              };
            }
            return friend;
          })
          .sort((a, b) => {
            const timeA = a.lastMessageTimestamp
              ? new Date(a.lastMessageTimestamp).getTime()
              : 0;
            const timeB = b.lastMessageTimestamp
              ? new Date(b.lastMessageTimestamp).getTime()
              : 0;
            return timeB - timeA;
          })
      );
    },
    [currentUserId]
  );

  // ==========================
  // Room joining logic
  // ==========================
  useEffect(() => {
    if (!currentUserId) return;

    const onConnect = () => {
      socket.emit('auth', { userId: currentUserId });

      const sf = selectedFriendRef.current?._id;
      const roomId = makeDirectRoomId(currentUserId, sf);
      if (roomId) {
        socket.emit('joinDirectRoom', { roomId });
        currentRoomRef.current = roomId;
      }
    };

    socket.on('connect', onConnect);
    if (socket.connected) onConnect();

    return () => socket.off('connect', onConnect);
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    const newRoom = makeDirectRoomId(currentUserId, selectedFriend?._id);

    if (currentRoomRef.current && currentRoomRef.current !== newRoom) {
      socket.emit('leaveDirectRoom', { roomId: currentRoomRef.current });
      currentRoomRef.current = null;
    }

    if (newRoom) {
      socket.emit('joinDirectRoom', { roomId: newRoom });
      currentRoomRef.current = newRoom;
    }
  }, [selectedFriend, currentUserId]);

  // ==========================
  // Main setup effect
  // ==========================
  useEffect(() => {
    if (!currentUserId) return;

    fetchFriends();
    fetchPendingRequests();
    fetchSentRequests();
    fetchUnreadCounts();

    socket.on('newMessage', handleNewMessage);
    socket.on('receiveMessage', handleNewMessage); // fallback if server emits different event

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('receiveMessage', handleNewMessage);
    };
  }, [
    currentUserId,
    fetchFriends,
    fetchPendingRequests,
    fetchSentRequests,
    fetchUnreadCounts,
    handleNewMessage
  ]);

  // ==========================
  // UI handlers
  // ==========================
  const toggleProfilePopup = useCallback(
    () => setProfilePopupOpen(prev => !prev),
    []
  );
  const toggleMusicSidebar = useCallback(
    () => setShowMusicSidebar(prev => !prev),
    []
  );

  const handleUpdateProfile = useCallback(
    async (name, profilePicture, oldPassword, newPassword) => {
      const result = await onUpdateProfile(
        name,
        profilePicture,
        oldPassword,
        newPassword
      );
      if (result.success) toggleProfilePopup();
      return result;
    },
    [onUpdateProfile, toggleProfilePopup]
  );

  const handleFriendSelect = useCallback(
    friend => {
      const isFriendOnline = onlineUsers.includes(friend._id);
      setSelectedFriend({ ...friend, isOnline: isFriendOnline });
      if (friend && friend._id) {
        setUnreadCounts(prev => ({
          ...prev,
          [friend._id]: 0
        }));
        socket.emit('messagesSeen', {
          chatPartnerId: friend._id,
          receiverId: currentUserId
        });
      }
    },
    [currentUserId, onlineUsers]
  );

  const handleChatPageClick = useCallback(() => {
    if (isCloudStorageSidebarOpen) setCloudStorageSidebarOpen(false);
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
        isBlocked={isBlocked}
        setIsBlocked={setIsBlocked}
        hasBlockedSelectedFriend={hasBlockedSelectedFriend}
        messages={messages}
        setMessages={setMessages}
        socket={socket}
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
        <SearchSidebar
          isOpen={isSearchSidebarOpen}
          onClose={toggleSearchSidebar}
          currentUserId={currentUserId}
          friends={friends}
          onFriendSelect={handleFriendSelect}
          sentRequests={sentRequests}
        />
      )}

      <NotificationSidebar
        isOpen={isNotificationSidebarOpen}
        onClose={toggleNotificationSidebar}
        userId={currentUserId}
        onTotalNotificationCountChange={onNotificationCountChange}
        onNewFriendRequestReceived={fetchPendingRequests}
      />

      {currentUserId && (
        <FriendsSidebar
          isOpen={isFriendsSidebarOpen}
          onClose={toggleFriendsSidebar}
          friends={friends}
          onFriendSelect={handleFriendSelect}
        />
      )}

      <CloudStorageSidebar
        isOpen={isCloudStorageSidebarOpen}
        onClose={() => setCloudStorageSidebarOpen(false)}
      />

      <MusicSidebar isOpen={showMusicSidebar} onClose={toggleMusicSidebar} />
    </div>
  );
}

export default ChatPage;
