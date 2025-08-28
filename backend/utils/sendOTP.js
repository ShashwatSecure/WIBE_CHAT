const sendOTP = async (email, otp, subject = 'Your OTP for Wibe_Chat Registration', text = '<p>Your One-Time Password (OTP) for Wibe_Chat registration is: <strong>${otp}</strong></p><p>This OTP is valid for 5 minutes.</p>') => {
  try {
    const mailOptions = {
      from: process.env.YOUR_EMAIL_USER,
      to: email,
      subject: subject,
      html: text.replace('${otp}', otp)
    };
    await transporter.sendMail(mailOptions);
    console.log(`OTP sent to ${email}`);
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw new Error('Failed to send OTP');
  }
};

module.exports = sendOTP;