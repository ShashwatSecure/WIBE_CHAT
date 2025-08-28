
import React, { useState, useEffect } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import Auth from './components/Auth';
import WelcomeScreen from './components/WelcomeScreen';
import ChatPage from './components/ChatPage';
import VerticalLineIcons from './components/VerticalLineIcons';
import ProfileSidebar from './components/ProfileSidebar';
import CloudStorageSidebar from './components/CloudStorageSidebar';
import MusicSidebar from './components/MusicSidebar';
import BroadcastSidebar from './components/BroadcastSidebar';
import { io } from 'socket.io-client';



const socket = io(process.env.REACT_APP_BACKEND_URL);

function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [user, setUser] = useState(null);
  const [lastMessage, setLastMessage] = useState('');
  
  const [isProfileSidebarOpen, setProfileSidebarOpen] = useState(false); // Changed from popup to sidebar
  const [isSearchSidebarOpen, setSearchSidebarOpen] = useState(false);
  const [isNotificationSidebarOpen, setNotificationSidebarOpen] = useState(false);
  const [isFriendsSidebarOpen, setFriendsSidebarOpen] = useState(false);
  const [isCloudStorageSidebarOpen, setCloudStorageSidebarOpen] = useState(false);
  const [isMusicSidebarOpen, setMusicSidebarOpen] = useState(false);
  const [isBroadcastSidebarOpen, setBroadcastSidebarOpen] = useState(false);

  useEffect(() => {
    console.log('isMusicSidebarOpen changed:', isMusicSidebarOpen);
  }, [isMusicSidebarOpen]);
  const [isAnySidebarOpen, setIsAnySidebarOpen] = useState(false); // New state to track if any sidebar is open
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0); // New state for pending requests count
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (user) {
      socket.emit('auth', user.userId);

      socket.on('userOnline', (userId) => {
        setOnlineUsers(prev => [...prev, userId]);
      });

      socket.on('userOffline', (userId) => {
        setOnlineUsers(prev => prev.filter(id => id !== userId));
      });

      return () => {
        socket.off('userOnline');
        socket.off('userOffline');
      };
    }
  }, [user]);

  useEffect(() => {
    const fetchLastMessage = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/messages/last`);
        const data = await response.json();
        if (response.ok && data.lastMessage) {
          setLastMessage(data.lastMessage);
        } else {
          setLastMessage('No messages yet or message too short.');
        }
      } catch (error) {
        console.error('Error fetching last message:', error);
        setLastMessage('Error loading last message.');
      }
    };

    fetchLastMessage();
  }, []);

  

  useEffect(() => {
    setIsAnySidebarOpen(
      isProfileSidebarOpen ||
      isSearchSidebarOpen ||
      isNotificationSidebarOpen ||
      isFriendsSidebarOpen ||
      isCloudStorageSidebarOpen ||
      isMusicSidebarOpen ||
      isBroadcastSidebarOpen
    );
  }, [isProfileSidebarOpen, isSearchSidebarOpen, isNotificationSidebarOpen, isFriendsSidebarOpen, isCloudStorageSidebarOpen, isMusicSidebarOpen, isBroadcastSidebarOpen]);

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);
      setShowChat(true);
      setShowWelcome(false);
      socket.emit("add-new-user", userData.userId);
    }
  }, []);

  const handleContinue = () => {
    setShowWelcome(false);
  };

  const handleAuthSuccess = (name, email, profilePicture, userId, username) => {
    const userData = { name, email, profilePicture: profilePicture || 'https://t3.ftcdn.net/jpg/03/46/83/96/360_F_346839683_6nAPzbhpskIpB8pmAwuFkC7c5eD7wYws.jpg', userId, username };
    setUser(userData);
    console.log('User data after setting state:', userData); // Add this line
    setShowChat(true);
    setShowWelcome(false);
    localStorage.setItem('loggedInUser', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    setShowChat(false);
    setShowWelcome(true);
    localStorage.removeItem('loggedInUser');
  };

  const toggleProfileSidebar = () => {
    setProfileSidebarOpen(prev => {
      const newState = !prev;
      if (newState) {
        setSearchSidebarOpen(false);
        setNotificationSidebarOpen(false);
        setFriendsSidebarOpen(false);
        setCloudStorageSidebarOpen(false);
        setMusicSidebarOpen(false);
        setBroadcastSidebarOpen(false);
      }
      return newState;
    });
  };

  const toggleSearchSidebar = () => {
    setSearchSidebarOpen(prev => {
      const newState = !prev;
      if (newState) {
        setProfileSidebarOpen(false);
        setNotificationSidebarOpen(false);
        setFriendsSidebarOpen(false);
        setCloudStorageSidebarOpen(false);
        setMusicSidebarOpen(false);
        setBroadcastSidebarOpen(false);
      }
      return newState;
    });
  };

  const toggleNotificationSidebar = () => {
    setNotificationSidebarOpen(prev => {
      const newState = !prev;
      if (newState) {
        setProfileSidebarOpen(false);
        setSearchSidebarOpen(false);
        setFriendsSidebarOpen(false);
        setCloudStorageSidebarOpen(false);
        setMusicSidebarOpen(false);
        setBroadcastSidebarOpen(false);
      }
      return newState;
    });
  };

  const toggleFriendsSidebar = () => {
    setFriendsSidebarOpen(prev => {
      const newState = !prev;
      if (newState) {
        setProfileSidebarOpen(false);
        setSearchSidebarOpen(false);
        setNotificationSidebarOpen(false);
        setCloudStorageSidebarOpen(false);
        setMusicSidebarOpen(false);
        setBroadcastSidebarOpen(false);
      }
      return newState;
    });
  };

  const toggleCloudStorageSidebar = () => {
    setCloudStorageSidebarOpen(prev => {
      const newState = !prev;
      if (newState) {
        setProfileSidebarOpen(false);
        setSearchSidebarOpen(false);
        setNotificationSidebarOpen(false);
        setFriendsSidebarOpen(false);
        setMusicSidebarOpen(false);
        setBroadcastSidebarOpen(false);
      }
      return newState;
    });
  };

  const toggleMusicSidebar = () => {
    setMusicSidebarOpen(prev => {
      const newState = !prev;
      if (newState) {
        setProfileSidebarOpen(false);
        setSearchSidebarOpen(false);
        setNotificationSidebarOpen(false);
        setFriendsSidebarOpen(false);
        setCloudStorageSidebarOpen(false);
        setBroadcastSidebarOpen(false);
      }
      return newState;
    });
  };

  const toggleBroadcastSidebar = () => {
    setBroadcastSidebarOpen(prev => {
      const newState = !prev;
      if (newState) {
        setProfileSidebarOpen(false);
        setSearchSidebarOpen(false);
        setNotificationSidebarOpen(false);
        setFriendsSidebarOpen(false);
        setCloudStorageSidebarOpen(false);
        setMusicSidebarOpen(false);
      }
      return newState;
    });
  };

  const handleProfileUpdate = async (name, username, profilePicture, oldPassword, newPassword) => {
    const payload = {
      email: user.email,
      name,
      username,
      profilePicture,
      ...(newPassword && { oldPassword, newPassword }),
    };

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        const updatedUser = { ...user, name: data.userName, username: data.username, profilePicture: data.profilePicture };
        setUser(updatedUser);
        localStorage.setItem('loggedInUser', JSON.stringify(updatedUser));
        return { success: true, message: data.msg };
      } else {
        return { success: false, message: data.msg || 'Profile update failed.' };
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      return { success: false, message: 'An error occurred while updating the profile.' };
    }
  };

  const isAuthPage = !showWelcome && !user;

  return (
    <div className={`App ${isAuthPage ? 'auth-app' : ''}`}>
      <ToastContainer
        position="bottom-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
      {showWelcome ? (
        <WelcomeScreen onContinue={handleContinue} />
      ) : showChat && user && user.userId ? (
        <ChatPage
          userName={user.name}
          userEmail={user.email}
          userUsername={user.username} // Pass username
          userProfilePicture={user.profilePicture}
          onLogout={handleLogout}
          onUpdateProfile={handleProfileUpdate} // Pass the update function
          currentUserId={user.userId} // Pass userId to ChatPage
          onNotificationCountChange={setPendingRequestsCount} // Pass setter for count to ChatPage
          pendingRequestsCount={pendingRequestsCount} // Pass the actual count to ChatPage
          isSearchSidebarOpen={isSearchSidebarOpen}
          toggleSearchSidebar={toggleSearchSidebar}
          isNotificationSidebarOpen={isNotificationSidebarOpen}
          toggleNotificationSidebar={toggleNotificationSidebar}
          isFriendsSidebarOpen={isFriendsSidebarOpen}
          toggleFriendsSidebar={toggleFriendsSidebar}
          isCloudStorageSidebarOpen={isCloudStorageSidebarOpen}
          setCloudStorageSidebarOpen={setCloudStorageSidebarOpen}
          toggleCloudStorageSidebar={toggleCloudStorageSidebar}
          toggleMusicSidebar={toggleMusicSidebar}
          toggleBroadcastSidebar={toggleBroadcastSidebar}
          onlineUsers={onlineUsers}
        />
      ) : (
        <Auth onAuthSuccess={handleAuthSuccess} />
      )}

      {user && (
        <VerticalLineIcons
          userProfilePicture={user.profilePicture} // Pass profile picture
          toggleProfilePopup={toggleProfileSidebar} // Pass toggle function
          toggleSearchSidebar={toggleSearchSidebar}
          toggleNotificationSidebar={toggleNotificationSidebar}
          toggleFriendsSidebar={toggleFriendsSidebar}
          toggleCloudStorageSidebar={toggleCloudStorageSidebar}
          handleLogout={handleLogout}
          pendingRequestsCount={pendingRequestsCount} // Pass the count here
          toggleMusicSidebar={toggleMusicSidebar}
          toggleBroadcastSidebar={toggleBroadcastSidebar}
          isAnySidebarOpen={isAnySidebarOpen} // Pass the new state
        />
      )}

      {/* Profile Sidebar Component */}
      {user && (
        <ProfileSidebar
          isOpen={isProfileSidebarOpen}
          onClose={toggleProfileSidebar}
          currentUser={user}
          onUpdateProfile={handleProfileUpdate}
          setCurrentUser={setUser}
        />
      )}

      {user && (
        <div className="cloud-storage-sidebar">
          <CloudStorageSidebar
            isOpen={isCloudStorageSidebarOpen}
            onClose={toggleCloudStorageSidebar}
            currentUserId={user.userId}
          />
        </div>
      )}

      {user && (
        <MusicSidebar
          isOpen={isMusicSidebarOpen}
          onClose={toggleMusicSidebar}
          currentUserId={user.userId}
        />
      )}

      {user && (
        <BroadcastSidebar
          isOpen={isBroadcastSidebarOpen}
          onClose={toggleBroadcastSidebar}
          currentUserId={user.userId}
        />
      )}
    </div>
  );
}

export default App;
