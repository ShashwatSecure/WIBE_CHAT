const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.YOUR_EMAIL_USER,
    pass: process.env.YOUR_EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

const sendOTP = async (email, otp, subject, htmlContent) => {
  try {
    const mailOptions = {
      from: process.env.YOUR_EMAIL_USER,
      to: email,
      subject: subject,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${email}`);
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw new Error('Failed to send OTP email');
  }
};

module.exports = sendOTP;