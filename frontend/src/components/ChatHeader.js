import React from 'react';
import './ChatHeader.css';

function ChatHeader({ userName, userProfilePicture, onBlockUser, hasBlockedSelectedFriend, onToggleDeleteMode, onUnfriend, isTyping, isOnline, showMenu, setShowMenu }) {

  const toggleMenu = () => {
    setShowMenu(!showMenu);
  };

  const statusText = isTyping ? 'typing...' : (isOnline ? 'online' : 'offline');
  const statusClass = isTyping ? 'user-status' : (isOnline ? 'user-status online' : 'user-status offline');

  return (
    <div className="chat-header">
      <img src={userProfilePicture} alt="User Avatar" className="avatar" />
      <div className="user-info">
        <div className="user-name">{userName || 'Guest'}</div>
        <div className={statusClass}>{statusText}</div>
      </div>
      <div className="chat-actions">
        {/* Add icons for call, video call, etc. */}
        
        <div className="three-dots-menu-wrapper" onClick={(e) => { e.stopPropagation(); toggleMenu(); }}>
          <span>&#8942;</span> {/* Three dots menu */}
          {showMenu && (
            <div className="chat-action-menu">
              <div className="menu-item" onClick={onBlockUser}>{hasBlockedSelectedFriend ? 'Unblock' : 'Block'}</div>
              <div className="menu-item" onClick={() => { onToggleDeleteMode(); setShowMenu(false); }}>Delete Messages</div>
              <div className="menu-item" onClick={onUnfriend}>Unfriend</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatHeader;
