import React, { useState, useEffect } from 'react';
import './ProfileSidebar.css'; // Styling ke liye

const ProfileSidebar = ({ isOpen, onClose, currentUser, onUpdateProfile, setCurrentUser }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState(''); // New state for username
  const [profilePicture, setProfilePicture] = useState(''); // For displaying current/preview image
  const [newProfilePictureFile, setNewProfilePictureFile] = useState(null); // For new file upload
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [message, setMessage] = useState(''); // For success/error messages
  const [isLoading, setIsLoading] = useState(false); // New state for loading indicator

  const sidebarRef = React.useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      setMessage('');
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Jab currentUser data change ho, toh form fields update karein
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setEmail(currentUser.email || '');
      setUsername(currentUser.username || ''); // Initialize username
      setProfilePicture(currentUser.profilePicture || '');
    }
  }, [currentUser]);

  const fileInputRef = React.useRef(null);

  // Profile picture file select hone par preview dikhane ke liye
  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewProfilePictureFile(file);
      setProfilePicture(URL.createObjectURL(file)); // Create a local URL for preview
    }
  };

  const handleProfilePicClick = () => {
    fileInputRef.current.click(); // Trigger click on the hidden file input
  };

  // Profile update form submit hone par
  const handleProfileUpdateSubmit = async (e) => {
    e.preventDefault();
    if (username.includes('@')) {
        setMessage('Username cannot contain the "@" symbol.');
        setIsLoading(false);
        return;
    }
    setMessage(''); // Clear previous messages
    setIsLoading(true); // Set loading to true

    let updatedProfilePictureUrl = profilePicture;

    // Agar naya profile picture file select kiya gaya hai, toh pehle upload karein
    if (newProfilePictureFile) {
      const formData = new FormData();
      formData.append('image', newProfilePictureFile);
      try {
        const uploadResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/upload-single-file`, {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadResponse.json();
        if (uploadResponse.ok && uploadData.filePath) {
          updatedProfilePictureUrl = uploadData.filePath;
          console.log('Uploaded profile picture URL:', updatedProfilePictureUrl); // Add this line
        } else {
          setMessage('Failed to upload new profile picture.');
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.error('Error uploading profile picture:', error);
        setMessage('Error uploading profile picture.');
        setIsLoading(false);
        return;
      }
    }

    // Ab profile details update karein
    console.log('Sending to onUpdateProfile:', { name, username, updatedProfilePictureUrl }); // Add this line
    const result = await onUpdateProfile(name, username, updatedProfilePictureUrl);
    if (result.success) {
      setMessage('Profile updated successfully!');
      setNewProfilePictureFile(null); // Clear the file input
      // Update currentUser state with the new profile picture URL
      setCurrentUser(prevUser => ({
        ...prevUser,
        name: name,
        username: username,
        profilePicture: updatedProfilePictureUrl
      }));
    } else {
      setMessage(result.message || 'Failed to update profile.');
    }
    setIsLoading(false); // Set loading to false
  };

  // Password change form submit hone par
  const handlePasswordChangeSubmit = async (e) => {
    e.preventDefault();
    setMessage(''); // Clear previous messages
    setIsLoading(true); // Set loading to true

    if (newPassword !== confirmNewPassword) {
      setMessage('New passwords do not match.');
      setIsLoading(false);
      return;
    }

    const result = await onUpdateProfile(name, username, currentUser.profilePicture, oldPassword, newPassword);
    if (result.success) {
      setMessage('Password changed successfully!');
      // Clear password fields
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } else {
      setMessage(result.message || 'Failed to change password.');
    }
    setIsLoading(false); // Set loading to false
  };

  return (
    <div className={`profile-sidebar ${isOpen ? 'open' : ''}`} ref={sidebarRef}> {/* Use profile-sidebar class */}
      <div className="sidebar-header">
        <h3>Profile Settings</h3>
      </div>
      <div className="sidebar-content">
        {isLoading && <p className="sidebar-message">Loading...</p>}
        {!isLoading && message && <p className="sidebar-message">{message}</p>}

        {currentUser && (
          <div className="user-info-display">
            <img src={profilePicture} alt="Profile" className="profile-display-pic" onClick={handleProfilePicClick} />
            <input type="file" id="profilePicInputHidden" accept="image/*" onChange={handleProfilePictureChange} ref={fileInputRef} style={{ display: 'none' }} />
            <p><strong>Name:</strong> {name}</p>
            <p><strong>Username:</strong> {username}</p>
            <p><strong>Email:</strong> {email}</p>
          </div>
        )}

        {/* Profile Update Form */}
        <form onSubmit={handleProfileUpdateSubmit} className="profile-update-form">
          <h4>Update Profile</h4>
          <div className="form-group">
            <label htmlFor="nameInput">Name:</label>
            <input
              type="text"
              id="nameInput"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="usernameInput">Username:</label>
            <input
              type="text"
              id="usernameInput"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <button type="submit" className="modern-submit-button">Save Profile</button>
        </form>

        {/* Password Change Form */}
        <form onSubmit={handlePasswordChangeSubmit} className="password-change-form">
          <h4>Change Password</h4>
          <div className="form-group">
            <label htmlFor="oldPasswordInput">Old Password:</label>
            <input
              type="password"
              id="oldPasswordInput"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="newPasswordInput">New Password:</label>
            <input
              type="password"
              id="newPasswordInput"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirmNewPasswordInput">Confirm New Password:</label>
            <input
              type="password"
              id="confirmNewPasswordInput"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="modern-submit-button">Change Password</button>
        </form>
      </div>
    </div>
  );
};

export default ProfileSidebar;