import React from 'react';
import './WelcomeScreen.css';

function WelcomeScreen({ onContinue }) {
  return (
    <div className="welcome-container">
      <img src="/chatapp.png" alt="Wibe Chat Logo" className="wibe-logo" />
      <h1>Welcome to Chatapp</h1>
      <button className="welcome-button" onClick={onContinue}>Enter</button>
    </div>
  );
}

export default WelcomeScreen;
