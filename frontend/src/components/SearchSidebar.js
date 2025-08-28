import React, { useState, useEffect, useRef } from 'react';
import './SearchSidebar.css';

function SearchSidebar({ isOpen, onClose, currentUserId, friends, onFriendSelect, sentRequests, onFriendRequestSent }) {
  const [searchEmail, setSearchEmail] = useState('');
  const [searchedUsers, setSearchedUsers] = useState([]); // Changed to an array for multiple users
  const [searchMessage, setSearchMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false); // New state for loading indicator
  const sidebarRef = useRef(null); // Create a ref for the sidebar

  

  // Effect to handle clicks outside the sidebar
  useEffect(() => {
    console.log('SearchSidebar currentUserId changed:', currentUserId);
    function handleClickOutside(event) {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        onClose();
      }
    }

    // Add event listener when sidebar is open
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      // Clear search state when sidebar closes
      setSearchEmail('');
      setSearchedUsers([]); // Clear the array
      setSearchMessage('');
      document.removeEventListener('mousedown', handleClickOutside);
    }

    // Cleanup function to remove event listener when component unmounts
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, currentUserId]); // Re-run effect when isOpen, onClose or currentUserId changes

  const handleSearchChange = (e) => {
    const newValue = e.target.value;
    setSearchEmail(newValue);
    handleSearchSubmit(newValue); // Pass the new value directly
  };

  const handleSearchSubmit = async (searchQuery) => {
    if (!searchQuery) {
      setSearchedUsers([]);
      setSearchMessage('');
      return;
    }

    setIsLoading(true); // Set loading to true
    setSearchMessage('Searching...'); // Show searching message

    try {
      let url = `${process.env.REACT_APP_BACKEND_URL}/api/user/search?`;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (emailRegex.test(searchQuery)) {
        url += `email=${searchQuery}`;
      } else if (searchQuery.includes('@')) { // Simple check for email format
        url += `email=${searchQuery}`;
      } else {
        url += `username=${searchQuery}&name=${searchQuery}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (response.ok) {
        const users = data.users; // Ab multiple users aayenge
        console.log('Raw users from backend:', users); // New log to debug
        const filteredUsers = users.filter(user => user._id !== currentUserId); // Filter out current user

        if (filteredUsers.length > 0) {
          setSearchedUsers(filteredUsers.map(user => ({
            ...user,
            isFriend: friends.some(friend => friend._id === user._id),
            requestSent: sentRequests.includes(user._id) // Check if request was already sent
          })));
          setSearchMessage('');
        } else {
          setSearchedUsers([]);
          setSearchMessage('No users found.');
        }
      } else {
        setSearchMessage(data.msg || 'User not found.');
        setSearchedUsers([]);
      }
    } catch (error) {
      console.error('Error searching user:', error);
      setSearchMessage('Network error or server is down.');
      setSearchedUsers([]);
    } finally {
      setIsLoading(false); // Set loading to false regardless of success or failure
    }
  };

  const handleAddFriend = async (userToAdd) => {
    const senderIdToSend = currentUserId || ''; // Ensure senderId is not undefined
    // setSearchMessage('Sending friend request...'); // Removed this line
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/friends/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: senderIdToSend, receiverEmail: userToAdd.email }),
      });
      const data = await response.json();

      if (response.ok) {
        onFriendRequestSent(userToAdd._id); // Notify ChatPage
        // Update the specific user in searchedUsers to mark as request sent
        setSearchedUsers(prevUsers =>
          prevUsers.map(user =>
            user._id === userToAdd._id ? { ...user, requestSent: true } : user
          )
        );
        // Optionally, trigger a re-fetch of friends in ChatPage if friend request is accepted immediately
      } else {
        setSearchMessage(data.msg || 'Failed to send friend request.');
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      setSearchMessage('Network error or server is down.');
    }
  };

  const handleStartChat = (friend) => {
    onFriendSelect(friend);
    onClose(); // Close the sidebar after starting chat
  };

  return (
    <div className={`search-sidebar ${isOpen ? 'open' : ''}`} ref={sidebarRef}> {/* Attach ref to the sidebar div */}
      <div className="sidebar-header">
        <h3>Search User</h3>
        {/* Removed close button */}
      </div>
      <div className="sidebar-content">
        <form onSubmit={(e) => {
            e.preventDefault();
            handleSearchSubmit();
          }}>
          <input
            type="text"
            placeholder="Search user by email or username"
            value={searchEmail}
            onChange={handleSearchChange}
          />
          
        </form>
        {isLoading && <div className="search-message">Loading...</div>}
        {!isLoading && searchMessage && <div className="search-message">{searchMessage}</div>}

        {searchedUsers.map(user => (
          <div key={user._id} className="searched-user-card">
            <img src={user.profilePicture} alt="User Avatar" className="searched-user-avatar" />
            <div className="searched-user-info">
              <h4>{user.name} {user.isFriend && <span className="friend-name-tick-icon">&#10003;</span>}</h4>
              <p>{user.username ? `@${user.username}` : (user.email.length > 17 ? user.email.substring(0, 14) + '...' : user.email)}</p>
            </div>
            <div className="searched-user-actions">
              {user.isFriend ? (
                null
              ) : user.requestSent ? (
                <button disabled>Sent</button>
              ) : (
                <button onClick={() => handleAddFriend(user)}>Add</button>
              )}
              {user.isFriend ? (
                <button onClick={() => handleStartChat(user)}>Chat</button>
              ) : (
                null
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SearchSidebar;