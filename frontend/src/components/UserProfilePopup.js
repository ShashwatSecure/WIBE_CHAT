import React from 'react';
import './UserProfilePopup.css';

function UserProfilePopup({ user, onClose, onAddFriend }) {
  return (
    <div className="user-profile-popup">
      <div className="user-profile-popup-content">
        <h3>User Profile</h3>
        <img src={user.profilePicture} alt="User Avatar" className="user-profile-avatar" />
        <h4>{user.name}</h4>
        <p>@{user.username}</p>
        <p>{user.email}</p>
        <button onClick={() => onAddFriend(user)}>Add Friend</button>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export default UserProfilePopup;
