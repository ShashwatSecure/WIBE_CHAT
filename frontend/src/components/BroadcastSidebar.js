import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

import './BroadcastSidebar.css';

function BroadcastSidebar({ isOpen, onClose, currentUserId }) {
  const [newGroupName, setNewGroupName] = useState('');
  const [broadcastGroups, setBroadcastGroups] = useState([]);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState({});
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [scheduledBroadcasts, setScheduledBroadcasts] = useState([]);
  const [isScheduledPopupOpen, setIsScheduledPopupOpen] = useState(false); // New state for scheduled popup
  const [isHistoryPopupOpen, setIsHistoryPopupOpen] = useState(false); // New state for history popup
  const [broadcastHistory, setBroadcastHistory] = useState([]); // New state for broadcast history
  const [currentTime, setCurrentTime] = useState(new Date()); // New state for live time
  const [, setIsUploading] = useState(false);
  
  

  const handleFriendSelection = (friendId) => {
    const groupId = selectedGroup._id;
    setSelectedFriends((prevSelectedFriends) => {
      const groupSelections = prevSelectedFriends[groupId] || [];
      if (groupSelections.includes(friendId)) {
        return {
          ...prevSelectedFriends,
          [groupId]: groupSelections.filter((id) => id !== friendId),
        };
      } else {
        return {
          ...prevSelectedFriends,
          [groupId]: [...groupSelections, friendId],
        };
      }
    });
  };

  const handleGroupSelection = (groupId) => {
    setSelectedGroups((prevSelectedGroups) => {
      if (prevSelectedGroups.includes(groupId)) {
        return prevSelectedGroups.filter((id) => id !== groupId);
      } else {
        return [...prevSelectedGroups, groupId];
      }
    });
  };

  

  const fetchBroadcastGroups = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/broadcast-groups/${currentUserId}`);
      const data = await response.json();
      if (response.ok) {
        console.log('Fetched broadcast groups:', data.groups);
        setBroadcastGroups(data.groups);
      } else {
        console.error('Failed to fetch broadcast groups:', data.msg);
      }
    } catch (error) {
      console.error('Error fetching broadcast groups:', error);
    }
  }, [currentUserId]);

  const fetchFriends = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/friends?userId=${currentUserId}`);
      const data = await response.json();
      if (response.ok) {
        setFriends(data.friends);
      } else {
        console.error('Failed to fetch friends:', data.msg);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  }, [currentUserId]);

  const fetchScheduledBroadcasts = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/broadcast/scheduled/${currentUserId}`);
      const data = await response.json();
      if (response.ok) {
        setScheduledBroadcasts(data.scheduledBroadcasts);
      } else {
        console.error('Failed to fetch scheduled broadcasts:', data.msg);
      }
    } catch (error) {
      console.error('Error fetching scheduled broadcasts:', error);
    }
  }, [currentUserId]);

  const fetchBroadcastHistory = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/broadcast/history/${currentUserId}`);
      const data = await response.json();
      if (response.ok) {
        setBroadcastHistory(data.broadcastHistory);
      } else {
        console.error('Failed to fetch broadcast history:', data.msg);
      }
    } catch (error) {
      console.error('Error fetching broadcast history:', error);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (isOpen && currentUserId) {
      fetchBroadcastGroups();
    }

    const socket = io(process.env.REACT_APP_BACKEND_URL);

    socket.on('connect', () => {
      console.log('Connected to socket server');
    });

    socket.on('broadcastGroupCreated', (newGroup) => {
      if (newGroup.ownerId === currentUserId) {
        setBroadcastGroups((prevGroups) => [...prevGroups, newGroup]);
      }
    });

    socket.on('broadcastGroupDeleted', (deletedGroupId) => {
      setBroadcastGroups((prevGroups) => prevGroups.filter(group => group._id !== deletedGroupId));
    });

    socket.on('broadcastScheduled', (newBroadcast) => {
      if (newBroadcast.senderId === currentUserId) {
        fetchScheduledBroadcasts();
      }
    });

    socket.on('broadcastCancelled', (cancelledBroadcastId) => {
      fetchScheduledBroadcasts();
    });

    socket.on('broadcastSent', (sentBroadcast) => {
      if (sentBroadcast.senderId === currentUserId) {
        fetchBroadcastHistory();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [isOpen, currentUserId, fetchBroadcastGroups, fetchScheduledBroadcasts, fetchBroadcastHistory]);

  useEffect(() => {
    if (isPopupOpen && currentUserId) {
      fetchFriends();
    }
  }, [isPopupOpen, currentUserId, fetchFriends]);

  // Effect to update current time every second for live pending time
  useEffect(() => {
    let interval;
    if (isScheduledPopupOpen) {
      interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isScheduledPopupOpen]);

  const filteredFriends = friends.filter(friend =>
    friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateGroup = async () => {
    if (newGroupName.trim() && currentUserId) {
      console.log('Attempting to create group:', newGroupName.trim(), 'for user:', currentUserId);
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/broadcast-groups`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newGroupName.trim(), ownerId: currentUserId }),
        });
        const data = await response.json();
        console.log('Create group API response:', data);
        if (response.ok) {
          setBroadcastGroups([...broadcastGroups, data.group]);
          setNewGroupName('');
        } else {
          console.error('Failed to create broadcast group:', data.msg);
        }
      } catch (error) {
        console.error('Error creating broadcast group:', error);
      }
    }
  };

  const handleDeleteGroup = async (id) => {
    if (currentUserId) {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/broadcast-groups/${id}?userId=${currentUserId}`, {
          method: 'DELETE',
        });
        const data = await response.json();
        if (response.ok) {
          setBroadcastGroups(broadcastGroups.filter(group => group._id !== id));
        } else {
          console.error('Failed to delete broadcast group:', data.msg);
        }
      } catch (error) {
        console.error('Error deleting broadcast group:', error);
      }
    }
  };

  const handleGroupClick = (group) => {
    setSelectedGroup(group);
    setIsPopupOpen(true);
  };

  const handleClosePopup = () => {
    setIsPopupOpen(false);
    setSelectedGroup(null);
    setSearchQuery('');
    setFriends([]); // Clear friends when closing popup
  };

  const handleSendBroadcast = async () => {
    const recipients = selectedGroups.reduce((acc, groupId) => {
      const groupFriends = selectedFriends[groupId] || [];
      return [...acc, ...groupFriends];
    }, []);

    const uniqueRecipients = [...new Set(recipients)];

    if (uniqueRecipients.length === 0) {
      alert('Please select at least one friend to send the broadcast.');
      return;
    }

    if (!message.trim()) {
      alert('Please enter a message.');
      return;
    }

    

    const formData = new FormData();
    formData.append('message', message);
    formData.append('recipients', JSON.stringify(uniqueRecipients));
    const scheduledAt = date && time ? new Date(`${date}T${time}`) : new Date();
    formData.append('scheduledAt', scheduledAt.toISOString());
    formData.append('senderId', currentUserId);

    console.log('handleSendBroadcast: Function started.');
    console.log('handleSendBroadcast: Recipients:', uniqueRecipients);
    console.log('handleSendBroadcast: Message:', message);

    // Log FormData content (for debugging, might not show file content directly)
    for (let pair of formData.entries()) {
      console.log(pair[0]+ ', ' + pair[1]); 
    }

    console.log('handleSendBroadcast: Attempting axios.post...');
    try {
      console.log('handleSendBroadcast: Before axios.post call.');
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/broadcast/send`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const alertMessage = date && time ? 'Broadcast scheduled successfully!' : 'Broadcast sent successfully!';
      alert(alertMessage);
      setMessage('');
      setDate('');
      setTime('');
      setSelectedGroups([]);
      setSelectedGroups([]); // Clear selected groups
      setSelectedFriends({});
      setIsUploading(false); // Reset uploading status
    } catch (error) {
      console.error('Error sending broadcast:', error);
      alert('An error occurred while sending the broadcast.');
      setIsUploading(false); // Reset uploading status on error
    }
  };

  const handleCancelBroadcast = async (broadcastId) => {
    if (window.confirm('Are you sure you want to cancel this scheduled broadcast?')) {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/broadcast/scheduled/${broadcastId}`, {
          method: 'DELETE',
        });
        const data = await response.json();
        if (response.ok) {
          alert(data.msg);
          fetchScheduledBroadcasts(); // Refresh the list
        } else {
          alert(`Failed to cancel broadcast: ${data.msg}`);
        }
      } catch (error) {
        console.error('Error cancelling broadcast:', error);
        alert('An error occurred while cancelling the broadcast.');
      }
    }
  };

  const calculatePendingTime = (scheduledTime) => {
    const diff = new Date(scheduledTime).getTime() - currentTime.getTime(); // Use currentTime state

    if (diff <= 0) {
      return "Past Due";
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}m `;
    result += `${seconds}s`;
    return result.trim();
  };

  const [message, setMessage] = useState('');
  const isSendButtonDisabled = message.trim() === '';

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="broadcast-sidebar-header">
        <h3>Broadcast Sidebar</h3>
        <button onClick={onClose} className="close-btn">&times;</button>
      </div>
      <div className="broadcast-sidebar-content">
        <button
          className="broadcast-see-scheduled-btn"
          onClick={() => {
            setIsScheduledPopupOpen(true);
            fetchScheduledBroadcasts();
          }}
        >
          See Scheduled Messages
        </button>
        <div className="broadcast-datetime-group">
          <input
            type="date"
            className="broadcast-date-picker"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <input
            type="time"
            className="broadcast-time-picker"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
        
        <textarea
          value={message}
          onChange={(e) => {
            console.log('Textarea onChange:', e.target.value);
            setMessage(e.target.value);
          }}
          className="broadcast-textarea"
          placeholder="Type your broadcast message..."
        ></textarea>
        <button
          className="broadcast-send-button"
          onClick={() => {
            console.log('Send Broadcast button clicked!');
            handleSendBroadcast();
          }}
          disabled={isSendButtonDisabled}
        >
          Send Broadcast
        </button>
        <div className="broadcast-input-group">
          <input
            type="text"
            className="broadcast-new-text-field"
            placeholder="Enter group name..."
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <button className="broadcast-create-button" onClick={handleCreateGroup}>Create</button>
        </div>
        <div className="broadcast-group-list">
          {broadcastGroups.map(group => (
            <div
              key={group._id}
              className={`broadcast-group-item ${selectedGroups.includes(group._id) ? 'selected' : ''}`}>
              <input
                type="checkbox"
                checked={selectedGroups.includes(group._id)}
                onChange={() => handleGroupSelection(group._id)}
                style={{ marginRight: '10px' }}
              />
              <span onClick={() => handleGroupClick(group)}>{group.name}</span>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group._id); }} className="broadcast-delete-icon">&times;</button>
            </div>
          ))}
        </div>
      </div>

      {/* Scheduled Messages Popup */}
      {isScheduledPopupOpen && (
        <div className="broadcast-scheduled-popup-overlay">
          <div className="broadcast-scheduled-popup-content">
            <div className="broadcast-scheduled-popup-header">
              <h4>Scheduled Broadcasts</h4>
              <button onClick={() => setIsScheduledPopupOpen(false)} className="broadcast-scheduled-popup-close-btn">&times;</button>
            </div>
            <div className="broadcast-scheduled-popup-body">
              <button
                className="broadcast-history-btn"
                onClick={() => {
                  setIsHistoryPopupOpen(true);
                  fetchBroadcastHistory();
                }}
              >
                Broadcast History
              </button>
              {scheduledBroadcasts.length > 0 ? (
                scheduledBroadcasts.map(broadcast => (
                  <div key={broadcast._id} className="broadcast-scheduled-item">
                    <p><strong>Message:</strong> {broadcast.message}</p>
                    <p><strong>Scheduled For:</strong> {new Date(broadcast.scheduledAt).toLocaleString()}</p>
                    <p><strong>Pending Time:</strong> {calculatePendingTime(broadcast.scheduledAt)}</p>
                    <button onClick={() => handleCancelBroadcast(broadcast._id)} className="broadcast-cancel-scheduled-btn">Delete</button>
                  </div>
                ))
              ) : (
                <p>No scheduled broadcasts.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Broadcast History Popup */}
      {isHistoryPopupOpen && (
        <div className="broadcast-history-popup-overlay">
          <div className="broadcast-history-popup-content">
            <div className="broadcast-history-popup-header">
              <h4>Broadcast History</h4>
              <button onClick={() => setIsHistoryPopupOpen(false)} className="broadcast-history-popup-close-btn">&times;</button>
            </div>
            <div className="broadcast-history-popup-body">
              {broadcastHistory.length > 0 ? (
                broadcastHistory.map(broadcast => (
                  <div key={broadcast._id} className="broadcast-history-item">
                    <p><strong>Message:</strong> {broadcast.message}</p>
                    {broadcast.files && broadcast.files.length > 0 && (
                      <div>
                        <strong>Files:</strong>
                        <ul>
                          {broadcast.files.map((file, index) => (
                            <li key={index}><a href={file.path} target="_blank" rel="noopener noreferrer">{file.filename}</a></li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p><strong>Scheduled For:</strong> {new Date(broadcast.scheduledAt).toLocaleString()}</p>
                    <p><strong>Status:</strong> {broadcast.isSent ? 'Sent' : 'Pending'}</p>
                  </div>
                ))
              ) : (
                <p>No broadcast history.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {isPopupOpen && selectedGroup && (
        <div className="broadcast-popup-overlay">
          <div className="broadcast-popup-content">
            <div className="broadcast-popup-header">
              <h4>{selectedGroup.name}</h4>
              <button onClick={handleClosePopup} className="broadcast-popup-close-btn">&times;</button>
            </div>
            <div className="broadcast-popup-body">
              <input
                type="text"
                className="broadcast-popup-search-field"
                placeholder="Search friends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="broadcast-friend-list">
                {filteredFriends.length > 0 ? (
                  filteredFriends.map(friend => (
                    <div key={friend._id} className="broadcast-friend-item">
                      <input
                        type="checkbox"
                        checked={(selectedFriends[selectedGroup._id] || []).includes(friend._id)}
                        onChange={() => handleFriendSelection(friend._id)}
                        style={{ marginRight: '10px' }}
                      />
                      <img src={friend.profilePicture} alt="Profile" className="broadcast-friend-avatar" />
                      <span>{friend.name} ({friend.username})</span>
                    </div>
                  ))
                ) : (
                  <p>No friends found.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BroadcastSidebar;