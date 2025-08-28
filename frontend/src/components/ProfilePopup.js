import React, { useState, useEffect, useRef } from 'react';

function ProfilePopup({ userName, userEmail, userProfilePicture, onClose, onUpdate }) {
  const [name, setName] = useState(userName);
  const [profilePicture, setProfilePicture] = useState(userProfilePicture);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });

  const fileInputRef = useRef(null);

  useEffect(() => {
    setName(userName);
    setProfilePicture(userProfilePicture);
  }, [userName, userProfilePicture]);

  const handleUpdate = async () => {
    // Basic validation for password change
    if (newPassword && newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (newPassword && !oldPassword) {
      setPasswordMessage({ type: 'error', text: 'Old password is required to set a new one.' });
      return;
    }
    setPasswordMessage({ type: '', text: '' }); // Clear any previous messages

    const result = await onUpdate(name, profilePicture, oldPassword, newPassword);

    if (result.success) {
      setPasswordMessage({ type: 'success', text: result.message });
      // Clear password fields on successful update
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onClose(); // Close popup on success
    } else {
      setPasswordMessage({ type: 'error', text: result.message });
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicture(reader.result); // Set the Base64 string as profile picture
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="profile-popup">
      <div className="profile-popup-content">
        <h3>Edit Profile</h3>
        <img
          src={profilePicture}
          alt="User Avatar"
          className="profile-popup-avatar"
          onClick={handleAvatarClick}
          style={{ cursor: 'pointer' }}
        />
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <div className="form-group">
          <label htmlFor="profileEmail">Email:</label>
          <p id="profileEmail">{userEmail}</p>
        </div>

        <div className="form-group">
          <label htmlFor="profileName">Name:</label>
          <input
            type="text"
            id="profileName"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <hr />
        <h4>Change Password</h4>
        {passwordMessage.text && (
          <div className={`message ${passwordMessage.type}`}>
            {passwordMessage.text}
          </div>
        )}
        <div className="form-group">
          <label htmlFor="oldPassword">Old Password:</label>
          <input
            type="password"
            id="oldPassword"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="newPassword">New Password:</label>
          <input
            type="password"
            id="newPassword"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm New Password:</label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <button className="update-button" onClick={handleUpdate}>Update Profile</button>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export default ProfilePopup;
