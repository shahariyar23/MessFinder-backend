import transporter from '../emailService.js';
import { getAccountDeactivatedTemplate, getBookingConfirmationTemplate, getOwnerNotificationTemplate, getPasswordResetSuccessTemplate, getPasswordResetTemplate, getPaymentSuccessTemplate, getRequestStatusTemplate, getStatusUpdateTemplate } from '../emailTemplates.js';
import path from 'path';
import fs from 'fs';
import { generatePaymentReceiptPDF } from '../paymentPDFGenerator.js';



export const sendBookingConfirmation = async (userEmail, bookingData) => {
  try {
    const mailOptions = {
      from: `"MessFinder" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: `Booking Confirmed - ${bookingData.transactionId}`,
      html: getBookingConfirmationTemplate(bookingData),
      attachments: [
        {
          filename: `receipt-${bookingData.transactionId}.pdf`,
          path: bookingData.receiptPath,
        }
      ]
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Booking confirmation email sent:', result.messageId);
    return result;
  } catch (error) {
    console.error('Error sending booking confirmation email:', error);
    throw error;
  }
};

export const sendOwnerNotification = async (ownerEmail, bookingData) => {
  try {
    const mailOptions = {
      from: `"MessFinder" <${process.env.EMAIL_USER}>`,
      to: ownerEmail,
      subject: `New Booking - ${bookingData.messName}`,
      html: getOwnerNotificationTemplate(bookingData),
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Owner notification email sent:', result.messageId);
    return result;
  } catch (error) {
    console.error('Error sending owner notification email:', error);
    throw error;
  }
};

export const sendWelcomeEmail = async (userEmail, userName) => {
  try {
    const mailOptions = {
      from: `"MessFinder" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: 'Welcome to MessFinder! 🎉',
      html: `
        <h2>Welcome to MessFinder, ${userName}! 👋</h2>
        <p>We're excited to have you on board. Find your perfect mess accommodation with ease.</p>
        <p>Get started by browsing available mess options in your preferred location.</p>
        <a href="${process.env.FRONTEND_URL}/browse" style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Browse Messes</a>
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent:', result.messageId);
    return result;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
};

export const sendPaymentSuccess = async (userEmail, paymentData) => {
  let receiptPath = null;

  try {
    // Generate PDF receipt
    const fileName = `receipt-${paymentData.transactionId}-${Date.now()}.pdf`;
    const outputDir = path.join(process.cwd(), 'temp-receipts');
    const outputPath = path.join(outputDir, fileName);
    
    // Ensure directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate PDF
    receiptPath = await generatePaymentReceiptPDF(paymentData, outputPath);
    
    const mailOptions = {
      from: `"MessFinder" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: `Payment Successful - ${paymentData.transactionId}`,
      html: getPaymentSuccessTemplate(paymentData),
      attachments: [
        {
          filename: `payment-receipt-${paymentData.transactionId}.pdf`,
          path: receiptPath,
        }
      ]
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Payment success email sent:', result.messageId);
    
    // Clean up: Delete the temporary PDF file after sending
    setTimeout(() => {
      if (fs.existsSync(receiptPath)) {
        fs.unlinkSync(receiptPath);
        console.log('Temporary PDF deleted:', receiptPath);
      }
    }, 5000);
    
    return result;
  } catch (error) {
    console.error('Error sending payment success email:', error);
    
    // Clean up on error
    if (receiptPath && fs.existsSync(receiptPath)) {
      fs.unlinkSync(receiptPath);
    }
    
    throw error;
  }
};


export const sendPasswordResetCode = async (userEmail, userData) => {
  try {
    const mailOptions = {
      from: `"MessFinder" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: 'Password Reset Code - MessFinder',
      html: getPasswordResetTemplate(userData),
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Password reset code email sent:', result.messageId);
    return result;
  } catch (error) {
    console.error('Error sending password reset code email:', error);
    throw error;
  }
};


export const sendPasswordResetSuccess = async (userEmail, userData) => {
  try {
    const mailOptions = {
      from: `"MessFinder" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: 'Password Reset Successful - MessFinder',
      html: getPasswordResetSuccessTemplate(userData),
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Password reset success email sent:', result.messageId);
    return result;
  } catch (error) {
    console.error('Error sending password reset success email:', error);
    throw error;
  }
};


export const sendStatusUpdateEmail = async (userEmail, requestData) => {
    try {
      const { userName, messTitle, newStatus } = requestData;
      
      const subject = getStatusUpdateSubject(newStatus, messTitle);
      
      const mailOptions = {
        from: `"MessFinder" <${process.env.EMAIL_USER}>`,
        to: userEmail,
        subject: subject,
        html: getStatusUpdateTemplate(requestData),
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('Status update email sent:', result.messageId);
      return result;
    } catch (error) {
      console.error('Error sending status update email:', error);
      throw error;
    }
};

const getStatusUpdateSubject = (status, messTitle) => {
  const subjectMap = {
    accepted: `🎉 Viewing Request Accepted - ${messTitle}`,
    rejected: `Update on Your Viewing Request - ${messTitle}`,
    pending: `Viewing Request Status Update - ${messTitle}`
  };
  
  return subjectMap[status] || `Viewing Request Update - ${messTitle}`;
};

export const sendAccountDeactivatedNotification = async (userEmail, userData) => {
  try {
    const mailOptions = {
      from: `"MessFinder Security" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: '🚫 Account Deactivated - Security Alert',
      html: getAccountDeactivatedTemplate(userData),
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Account deactivated notification sent:', result.messageId);
    return result;
  } catch (error) {
    console.error('Error sending account deactivated notification:', error);
    throw error;
  }
};

export const sendRequestStatusUpdateToOwner = async (ownerEmail, requestData) => {
  try {
    const { 
      userName, 
      userEmail, 
      userPhone, 
      messTitle, 
      messAddress, 
      requestStatus, 
      requestDate,
      requestId 
    } = requestData;

    const subject = `🔔 New Viewing Request from ${userName}`;
    
    const mailOptions = {
      from: `"MessFinder" <${process.env.EMAIL_USER}>`,
      to: ownerEmail,
      subject: subject,
      html: getRequestStatusTemplate(requestData),
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Request status update email sent to owner:', result.messageId);
    return result;
  } catch (error) {
    console.error('Error sending request status update email to owner:', error);
    throw error;
  }
};





