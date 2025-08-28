import React, { useState, useRef, useEffect, memo } from 'react';
import './ChatList.css';

function ChatList({ userName, userProfilePicture, toggleProfilePopup, handleLogout, currentUserId, onFriendSelect, friends, onDeleteChat, onlineUsers, unreadCounts }) {
  console.log('ChatList received friends prop:', friends); // Added log
  const [dropdownOpen, setDropdownOpen] = useState(null); // Stores the _id of the friend whose dropdown is open
  const dropdownRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState(''); // New state for search query

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  const toggleDropdown = (friendId, event) => {
    event.stopPropagation(); // Prevent onFriendSelect from firing
    setDropdownOpen(dropdownOpen === friendId ? null : friendId);
  };

  // Filter and sort friends based on search query and last message timestamp
  const sortedAndFilteredFriends = friends
    .filter(friend => friend.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const timeA = a.lastMessageTimestamp ? new Date(a.lastMessageTimestamp).getTime() : 0;
      const timeB = b.lastMessageTimestamp ? new Date(b.lastMessageTimestamp).getTime() : 0;
      return timeB - timeA; // Sort in descending order (newest first)
    });

  return (
    <div className="chat-list">
      <div className="chat-list-header">
        <img src="/favicon.svg" alt="Chat App Logo" className="chat-list-logo" />
        <span className="chat-list-title">Chatapp</span>
      </div>
      <input
        type="text"
        placeholder="Search friends..."
        className="chat-list-search-input"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <div className="chat-list-items">
        {sortedAndFilteredFriends.map(friend => (
          friend && friend._id ? (
            <div key={friend._id} className="chat-list-item" onClick={() => onFriendSelect(friend)}>
              <div className="avatar-container">
                <img src={friend.profilePicture} alt="User Avatar" className="avatar" loading="lazy" />
                {onlineUsers.includes(friend._id) ? <div className="online-indicator"></div> : <div className="offline-indicator"></div>}
                {unreadCounts[friend._id] > 0 && (
                  <div className="unread-count">{unreadCounts[friend._id]}</div>
                )}
              </div>
              <div className="chat-info">
                <div className="chat-name">{friend.name}</div>
                
                {friend.lastMessage ? (
                  <div className="last-message">{friend.lastMessage.length > 20 ? friend.lastMessage.substring(0, 20) + '...' : friend.lastMessage}</div>
                ) : (
                  <div className="last-message no-messages">No messages yet</div>
                )}
              </div>
              <div className="time-status-container">
                {friend.lastMessageTimestamp && (
                  <div className="chat-time">{new Date(friend.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                )}
                {friend.lastMessageStatus && friend.lastMessageStatus === 'sent' && <span className="message-status">✓</span>}
                {friend.lastMessageStatus && friend.lastMessageStatus === 'delivered' && <span className="message-status">✓✓</span>}
                {friend.lastMessageStatus && friend.lastMessageStatus === 'seen' && <span className="message-status seen-ticks">✓✓</span>}
              </div>
              <div className="chat-item-options" onClick={(e) => toggleDropdown(friend._id, e)}>
                ...
                {dropdownOpen === friend._id && (
                  <div className="dropdown-menu" ref={dropdownRef}>
                  </div>
                )}
              </div>
            </div>
          ) : null
        ))}
      </div>
    </div>
  );
}

export default memo(ChatList);
