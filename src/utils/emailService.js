import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config(); 

// Create transporter
const transporter = nodemailer.createTransport({
   host: "smtp-relay.brevo.com",
    port: 587,
    secure: false, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, 
  },
  connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000
});

// Verify transporter
transporter.verify((error, success) => {
  if (error) {
    console.log('Email transporter error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

export default transporter;