import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComment, faUserSlash, faSearch } from '@fortawesome/free-solid-svg-icons';
import './FriendsSidebar.css';

function FriendsSidebar({ isOpen, onClose, friends, onFriendSelect, onUnfriend }) {
  const [searchTerm, setSearchTerm] = useState('');
  const sidebarRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleChatClick = (friend) => {
    onFriendSelect(friend);
    onClose();
  };

  const handleUnfriendClick = (friendId, event) => {
    event.stopPropagation(); // Prevent parent div's onClick from firing
    if (onUnfriend) {
      onUnfriend(friendId);
    }
  };

  const filteredFriends = friends.filter(friend =>
    friend.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div ref={sidebarRef} className={`friends-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h3>Friends</h3>
      </div>
      <div className="sidebar-search">
        <div className="search-input-container">
          <input
            type="text"
            placeholder="Search friends..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <FontAwesomeIcon icon={faSearch} className="search-icon" /> {/* Search Icon */}
          
        </div>
      </div>
      
      <div className="sidebar-content">
        {filteredFriends.length > 0 ? (
          filteredFriends.map(friend => (
            <div key={friend._id} className="friend-item">
              <div className="friend-info">
                <img src={friend.profilePicture} alt={friend.name} className="friend-avatar" />
                <span className="friend-name">{friend.name}</span>
                <div className="friend-actions">
                  <button className="chat-button" onClick={() => handleChatClick(friend)}><FontAwesomeIcon icon={faComment} /></button>
                  <button className="unfriend-button" onClick={(e) => handleUnfriendClick(friend._id, e)}><FontAwesomeIcon icon={faUserSlash} /></button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p>No friends found.</p>
        )}
      </div>
    </div>
  );
}

export default FriendsSidebar;