import React, { useState, useEffect, useRef, useCallback } from 'react';
import socket from '../socket'; // Import the shared socket instance
import './NotificationSidebar.css';
import './NotificationSidebar.css';



function NotificationSidebar({ isOpen, onClose, userId, onTotalNotificationCountChange, onNewFriendRequestReceived }) {
  const [notifications, setNotifications] = useState([]); // Combined state for all notifications
  const [message, setMessage] = useState('');
  const [totalNotificationCount, setTotalNotificationCount] = useState(0); // Internal state for total count
  const sidebarRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    console.log('NotificationSidebar: Attempting to fetch notifications for userId:', userId);
    try {
      const [notificationsResponse, pendingRequestsResponse] = await Promise.all([
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/notifications?userId=${userId}`),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/friends/pending?userId=${userId}`)
      ]);

      const notificationsData = await notificationsResponse.json();
      const pendingRequestsData = await pendingRequestsResponse.json();

      let combinedNotifications = [];

      if (notificationsResponse.ok && notificationsData.notifications) {
        combinedNotifications = notificationsData.notifications.map(notif => ({
          ...notif,
          type: notif.type === 'friend_request_accepted' ? 'accepted' : notif.type === 'friend_request_declined' ? 'declined' : notif.type
        }));
      }

      if (pendingRequestsResponse.ok && pendingRequestsData.pendingRequests) {
        // Map pending requests to a format compatible with existing notifications
        const formattedPendingRequests = pendingRequestsData.pendingRequests.map(req => ({
          _id: req._id,
          type: 'friendRequest', // This type is used in the render logic
          sender: req.sender,
          message: `${req.sender.name} sent you a friend request.`,
          createdAt: req.createdAt,
          status: req.status // 'pending'
        }));
        combinedNotifications = [...combinedNotifications, ...formattedPendingRequests];
      }

      // Sort notifications by creation date, newest first
      combinedNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      console.log('NotificationSidebar: Combined notifications before setting state:', combinedNotifications);
      setNotifications(combinedNotifications);
      setTotalNotificationCount(combinedNotifications.length);
      console.log('NotificationSidebar: Combined notifications after fetch:', combinedNotifications);
      console.log('NotificationSidebar: Current notifications state:', notifications); // Add this log to see the state after update
      if (combinedNotifications.length === 0) {
        setMessage('No new notifications.');
      } else {
        setMessage('');
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setMessage('Network error or server is down.');
    }
  }, [userId]);

  useEffect(() => {
    console.log('NotificationSidebar: useEffect triggered.');
    if (isOpen && userId) {
      fetchNotifications();
    }

    function handleClickOutside(event) {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, userId, fetchNotifications]);

  const handleClearAllNotifications = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/notifications/clear-all?userId=${userId}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (response.ok) {
        setMessage(data.msg);
        setNotifications([]); // Clear notifications from frontend state
        setTotalNotificationCount(0); // Reset total count
      } else {
        setMessage(data.msg || 'Failed to clear notifications.');
      }
    } catch (error) {
      console.error('Error clearing notifications:', error);
      setMessage('Network error or server is down.');
    }
  };

  const handleRespondRequest = async (requestId, status) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/friends/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, status }),
      });
      const data = await response.json();

      if (response.ok) {
        setMessage(data.msg);
        fetchNotifications(); // Refresh the list
      } else {
        setMessage(data.msg || 'Failed to respond to request.');
      }
    } catch (error) {
      console.error('Error responding to request:', error);
      setMessage('Network error or server is down.');
    }
  };

  useEffect(() => {
    if (onTotalNotificationCountChange) {
      onTotalNotificationCountChange(totalNotificationCount);
    }
  }, [totalNotificationCount, onTotalNotificationCountChange]);

  return (
    <div className={`notification-sidebar ${isOpen ? 'open' : ''}`} ref={sidebarRef}>
      <div className="sidebar-header">
        <h3>Friend Requests</h3>
        <button onClick={handleClearAllNotifications} className="clear-all-button">Clear All</button>
      </div>
      <div className="sidebar-content">
        {message && <div className="sidebar-message">{message}</div>}
        {notifications.length > 0 ? (
          notifications.map((notification, index) => (
            <div key={notification._id || `notif-${index}`} className="notification-card">
              {notification.type === 'friendRequest' ? (
                <div className="friend-request-card">
                  <div className="request-header">
                    <img src={notification.sender.profilePicture} alt="Sender Avatar" className="sender-avatar" />
                    <div className="request-info">
                      <h4>{notification.sender.name}</h4>
                      <p>sent you a friend request.</p>
                    </div>
                  </div>
                  <div className="request-actions">
                    <button onClick={() => handleRespondRequest(notification._id, 'accepted')}>Accept</button>
                    <button onClick={() => handleRespondRequest(notification._id, 'declined')}>Decline</button>
                  </div>
                </div>
              ) : notification.type === 'declined' ? (
                <div className="decline-notification-card">
                  <p>{notification.message}</p>
                </div>
              ) : notification.type === 'accepted' ? (
                <div className="accepted-notification-card">
                  <p>{notification.message}</p>
                </div>
              ) : null}
            </div>
          ))
        ) : (
          !message && <div className="no-notifications-message"><p>No new notifications.</p></div>
        )}
      </div>
    </div>
  );
}

export default NotificationSidebar;