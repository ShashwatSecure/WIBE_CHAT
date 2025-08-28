import React, { useState } from 'react';
import './Auth.css';

function Auth({ onAuthSuccess }) {
  const [activeTab, setActiveTab] = useState('login'); // 'register', 'login', 'otp', 'forgot-password'
  const [forgotPasswordStep, setForgotPasswordStep] = useState('email'); // 'email', 'otp', 'reset'

  const [registerMessage, setRegisterMessage] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [otpMessage, setOtpMessage] = useState('');
  const [otpEmail, setOtpEmail] = useState(''); // To pre-fill OTP form
  const [registerFormData, setRegisterFormData] = useState({ name: '', username: '', email: '', password: '' }); // Store registration data
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState('');
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordOtp, setForgotPasswordOtp] = useState('');
  const [isSubmittingRegister, setIsSubmittingRegister] = useState(false); // New state for preventing multiple submissions

  const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    if (isSubmittingRegister) return; // Prevent multiple submissions

    setIsSubmittingRegister(true); // Disable button
    setRegisterMessage('');
    const name = event.target.registerName.value;
    const username = event.target.registerUsername.value;
    const email = event.target.registerEmail.value;
    const password = event.target.registerPassword.value;

    setRegisterFormData({ name, username, email, password }); // Store data

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, email, password }),
      });
      const data = await response.json();
      console.log('Registration response data:', data);
      if (response.ok) {
        setRegisterMessage({ type: 'success', text: data.msg || 'Registration successful! Please check your email for OTP.' });
        setOtpEmail(email); // Pre-fill OTP email
        setActiveTab('otp'); // Switch to OTP verification after successful registration
      } else {
        setRegisterMessage({ type: 'error', text: data.msg || 'Registration failed.' });
      }
    } catch (error) {
      console.error('Error during registration:', error);
      setRegisterMessage({ type: 'error', text: 'Network error or server is down.' });
    } finally {
      setIsSubmittingRegister(false); // Re-enable button
    }
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setLoginMessage('');
    const email = event.target.loginEmail.value;
    const password = event.target.loginPassword.value;

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (response.ok) {
        setLoginMessage({ type: 'success', text: data.msg || 'Login successful!' });
        onAuthSuccess(data.userName, email, data.profilePicture, data.userId, data.username); // Call success handler with user name, email, and profile picture
      } else {
        setLoginMessage({ type: 'error', text: data.msg || 'Login failed.' });
      }
    } catch (error) {
      console.error('Error during login:', error);
      setLoginMessage({ type: 'error', text: 'Network error or server is down.' });
    }
  };

  const handleOtpSubmit = async (event) => {
    event.preventDefault();
    setOtpMessage('');
    const email = event.target.otpEmail.value;
    const otp = event.target.otpCode.value;
    const { name, username, password } = registerFormData; // Get name and password from stored data

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, name, username, password }), // Send name and password
      });
      const data = await response.json();

      if (response.ok) {
        setOtpMessage({ type: 'success', text: data.msg || 'OTP verified and user registered successfully!' });
        setTimeout(() => {
          setActiveTab('login'); // Redirect to login tab
          setLoginMessage({ type: 'success', text: 'OTP verified. Please login.' }); // Optional: show a message on login tab
        }, 2000); 
      } else {
        setOtpMessage({ type: 'error', text: data.msg || 'OTP verification failed.' });
      }
    } catch (error) {
      console.error('Error during OTP verification:', error);
      setOtpMessage({ type: 'error', text: 'Network error or server is down.' });
    }
  };

  const handleForgotPasswordEmailSubmit = async (event) => {
    event.preventDefault();
    setForgotPasswordMessage('');
    const email = event.target.forgotPasswordEmail.value;
    setForgotPasswordEmail(email);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (response.ok) {
        setForgotPasswordMessage({ type: 'success', text: data.msg });
        setForgotPasswordStep('otp');
      } else if (response.status === 404) {
        setForgotPasswordMessage({ type: 'error', text: data.msg || 'No account found with this email.' });
      } else {
        setForgotPasswordMessage({ type: 'error', text: data.msg || 'An error occurred.' });
      }
    } catch (error) {
      console.error('Error during forgot password:', error);
      setForgotPasswordMessage({ type: 'error', text: 'Network error or server is down.' });
    }
  };

  const handleForgotPasswordOtpSubmit = async (event) => {
    event.preventDefault();
    setForgotPasswordMessage('');
    const otp = event.target.otp.value;
    setForgotPasswordOtp(otp);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/verify-reset-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordEmail, otp }),
      });
      const data = await response.json();

      if (response.ok) {
        setForgotPasswordMessage({ type: 'success', text: data.msg });
        setForgotPasswordStep('reset');
      } else {
        setForgotPasswordMessage({ type: 'error', text: data.msg || 'Invalid OTP.' });
      }
    } catch (error) {
      console.error('Error during OTP verification:', error);
      setForgotPasswordMessage({ type: 'error', text: 'Network error or server is down.' });
    }
  };

  const handleResetPasswordSubmit = async (event) => {
    event.preventDefault();
    setForgotPasswordMessage('');
    const newPassword = event.target.newPassword.value;
    const confirmPassword = event.target.confirmPassword.value;

    if (newPassword !== confirmPassword) {
      setForgotPasswordMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordEmail, otp: forgotPasswordOtp, newPassword }),
      });
      const data = await response.json();

      if (response.ok) {
        setForgotPasswordMessage({ type: 'success', text: data.msg });
        setActiveTab('login');
        setForgotPasswordStep('email');
      } else {
        setForgotPasswordMessage({ type: 'error', text: data.msg || 'Failed to reset password.' });
      }
    } catch (error) {
      console.error('Error during password reset:', error);
      setForgotPasswordMessage({ type: 'error', text: 'Network error or server is down.' });
    }
  };

  return (
    <div className="container">
      <img src="/chatapp.png" alt="Wibe Chat Logo" className="auth-wibe-logo" />
      <div className="tab-buttons">
        <button
          className={activeTab === 'register' ? 'active' : ''}
          onClick={() => setActiveTab('register')}
        >
          Register
        </button>
        <button
          className={activeTab === 'login' ? 'active' : ''}
          onClick={() => setActiveTab('login')}
        >
          Login
        </button>
      </div>

      {activeTab === 'register' && (
        <div id="registerSection" className="form-section active">
          
          <form id="registerForm" onSubmit={handleRegisterSubmit}>
            <div className="form-group">
              <input type="text" id="registerName" name="registerName" placeholder="Name" required />
            </div>
            <div className="form-group">
              <input type="text" id="registerUsername" name="registerUsername" placeholder="Username" required />
            </div>
            <div className="form-group">
              <input type="email" id="registerEmail" name="registerEmail" placeholder="Email" required />
            </div>
            <div className="form-group">
              <input type="password" id="registerPassword" name="registerPassword" placeholder="Password" required />
            </div>
            <div style={{ marginBottom: '20px' }}></div>
            <button type="submit" className="auth-primary-button" disabled={isSubmittingRegister}>Register</button>
          </form>
          {registerMessage && (
            <div className={`message ${registerMessage.type}`}>
              {registerMessage.text}
            </div>
          )}
        </div>
      )}

      {activeTab === 'login' && (
        <div id="loginSection" className="form-section active">
          
          <form id="loginForm" onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <input type="email" id="loginEmail" name="loginEmail" placeholder="Email" required />
            </div>
            <div className="form-group">
              <input type="password" id="loginPassword" name="loginPassword" placeholder="Password" required />
            </div>
            <div style={{ marginBottom: '20px' }}></div>
            <button type="submit" className="auth-primary-button">Login</button>
            <p className="forgot-password-text" onClick={() => setActiveTab('forgot-password')}>Forgot Password?</p>
          </form>
          {/* Request OTP button is removed from here as OTP is now part of registration flow */}
          {loginMessage && (
            <div className={`message ${loginMessage.type}`}>
              {loginMessage.text}
            </div>
          )}
        </div>
      )}

      {activeTab === 'otp' && (
        <div id="otpSection" className="form-section active">
          <h2>Verify OTP</h2>
          <form id="otpForm" onSubmit={handleOtpSubmit}>
            <div className="form-group">
              <input
                type="email"
                id="otpEmail"
                name="otpEmail"
                placeholder="Email"
                value={otpEmail}
                onChange={(e) => setOtpEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <input type="text" id="otpCode" name="otpCode" placeholder="OTP Code" required />
            </div>
            <button type="submit" className="auth-primary-button">Verify OTP</button>
          </form>
          {otpMessage && (
            <div className={`message ${otpMessage.type}`}>
              {otpMessage.text}
            </div>
          )}
        </div>
      )}

      {activeTab === 'forgot-password' && (
        <div id="forgotPasswordSection" className="form-section active">
          {forgotPasswordStep === 'email' && (
            <>
              <h2>Forgot Password</h2>
              <form id="forgotPasswordEmailForm" onSubmit={handleForgotPasswordEmailSubmit}>
                <div className="form-group">
                  <input type="email" id="forgotPasswordEmail" name="forgotPasswordEmail" placeholder="Email" required />
                </div>
                <button type="submit">Submit</button>
              </form>
            </>
          )}

          {forgotPasswordStep === 'otp' && (
            <>
              <h2>Verify OTP</h2>
              <form id="forgotPasswordOtpForm" onSubmit={handleForgotPasswordOtpSubmit}>
                <div className="form-group">
                  <input type="text" id="otp" name="otp" placeholder="OTP" required />
                </div>
                <button type="submit">Verify</button>
              </form>
            </>
          )}

          {forgotPasswordStep === 'reset' && (
            <>
              <h2>Reset Password</h2>
              <form id="resetPasswordForm" onSubmit={handleResetPasswordSubmit}>
                <div className="form-group">
                  <input type="password" id="newPassword" name="newPassword" placeholder="New Password" required />
                </div>
                <div className="form-group">
                  <input type="password" id="confirmPassword" name="confirmPassword" placeholder="Confirm Password" required />
                </div>
                <button type="submit">Reset Password</button>
              </form>
            </>
          )}

          {forgotPasswordMessage && (
            <div className={`message ${forgotPasswordMessage.type}`}>
              {forgotPasswordMessage.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Auth;