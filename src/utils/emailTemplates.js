
export const getBookingConfirmationTemplate = (bookingData) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: linear-gradient(135deg, #22c55e, #10b981); color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .booking-details { background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { background: #64748b; color: white; padding: 15px; text-align: center; }
        .button { background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎉 Booking Confirmation!</h1>
        <p>MessFinder - Your perfect accommodation partner</p>
      </div>
      
      <div class="content">
        <h2>Hello ${bookingData.tenantName},</h2>
        <p>Your booking Confirmation. Here are your booking details:</p>
        
        <div class="booking-details">
          <h3>📋 Booking Information</h3>
          <p><strong>Mess Name:</strong> ${bookingData.messName}</p>
          <p><strong>Address:</strong> ${bookingData.address}</p>
          <p><strong>Check-in Date:</strong> ${new Date(bookingData.checkInDate).toLocaleDateString()}</p>
          <p><strong>Transaction ID:</strong> ${bookingData.transactionId}</p>
          <p><strong>Amount:</strong> BDT ${bookingData.amount}</p>
          <p><strong>Payment Status:</strong> BDT ${bookingData.PaymentStatus}</p>
          <p><strong>Booking Status:</strong> BDT ${bookingData.bookingStatus}</p>
        </div>
        
        <p><strong>Next Steps:</strong></p>
        <ul>
          <li>Contact the mess owner for check-in instructions</li>
          <li>Keep your transaction ID for reference</li>
          <li>Download your receipt from the app</li>
        </ul>
        
        <a href="${bookingData.bookingLink}" class="button">View Booking Details</a>
      </div>
      
      <div class="footer">
        <p>Thank you for choosing MessFinder!</p>
        <p>Need help? Contact us at support@messfinder.com</p>
        <p>© 2025 MessFinder. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
};

export const getOwnerNotificationTemplate = (bookingData) => {
  return `
    <!DOCTYPE html>
    <html>
    <body>
      <h2>New Booking Received! 🎉</h2>
      <p>You have received a new booking for ${bookingData.messName}.</p>
      <p><strong>Tenant:</strong> ${bookingData.tenantName}</p>
      <p><strong>Check-in:</strong> ${new Date(bookingData.checkInDate).toLocaleDateString()}</p>
      <p><strong>Amount:</strong> BDT ${bookingData.amount}</p>
      <p>Please log in to your dashboard to manage this booking.</p>
    </body>
    </html>
  `;
};

// password reset mail tamplate
export const getPasswordResetTemplate = (userData) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .code-box { background: #fffbeb; border: 2px dashed #f59e0b; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
        .verification-code { font-size: 32px; font-weight: bold; color: #d97706; letter-spacing: 8px; }
        .footer { background: #64748b; color: white; padding: 15px; text-align: center; }
        .note { background: #f1f5f9; padding: 10px; border-radius: 6px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🔐 Password Reset Request</h1>
        <p>MessFinder - Account Security</p>
      </div>
      
      <div class="content">
        <h2>Hello ${userData.name},</h2>
        <p>We received a request to reset your password. Use the verification code below to proceed:</p>
        
        <div class="code-box">
          <h3>Your Verification Code</h3>
          <div class="verification-code">${userData.verificationCode}</div>
          <p><small>This code will expire in 10 minutes</small></p>
        </div>
        
        <div class="note">
          <p><strong>Note:</strong> If you didn't request this reset, please ignore this email or contact our support team immediately.</p>
        </div>
        
        <p>Enter this code in the password reset page to create a new password for your account.</p>
      </div>
      
      <div class="footer">
        <p>Need help? Contact us at support@messfinder.com</p>
        <p>© 2025 MessFinder. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
};

// Password reset successfullt mail tamplate
export const getPasswordResetSuccessTemplate = (userData) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .success-box { background: #ecfdf5; border: 2px solid #10b981; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
        .footer { background: #64748b; color: white; padding: 15px; text-align: center; }
        .security-tips { background: #f0f9ff; padding: 15px; border-radius: 6px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>✅ Password Reset Successful</h1>
        <p>MessFinder - Account Recovery</p>
      </div>
      
      <div class="content">
        <h2>Hello ${userData.name},</h2>
        
        <div class="success-box">
          <h3>🎉 Password Successfully Updated!</h3>
          <p>Your MessFinder account password has been reset successfully.</p>
          <p><strong>Reset Time:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="security-tips">
          <h4>🔒 Security Tips:</h4>
          <ul>
            <li>Use a strong, unique password</li>
            <li>Enable two-factor authentication if available</li>
            <li>Never share your password with anyone</li>
            <li>Log out from shared devices</li>
          </ul>
        </div>
        
        <p>If you did not perform this action, please contact our support team immediately.</p>
        
        <div style="text-align: center; margin: 20px 0;">
          <a href="${process.env.FRONTEND_URL}/login" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Login to Your Account</a>
        </div>
      </div>
      
      <div class="footer">
        <p>Thank you for securing your account!</p>
        <p>Need help? Contact us at support@messfinder.com</p>
        <p>© 2025 MessFinder. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
};


export const getAccountLockedTemplate = (userData) => {
  const unlockTime = new Date(userData.lockUntil).toLocaleString();
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .alert-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; }
        .footer { background: #64748b; color: white; padding: 15px; text-align: center; }
        .button { background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 5px; }
        .info-box { background: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🔒 Account Temporarily Locked</h1>
        <p>MessFinder - Security Alert</p>
      </div>
      
      <div class="content">
        <h2>Hello ${userData.name},</h2>
        
        <div class="alert-box">
          <h3>⚠️ Important Security Notice</h3>
          <p>Your MessFinder account has been temporarily locked due to multiple failed login attempts.</p>
        </div>
        
        <div class="info-box">
          <p><strong>Reason:</strong> ${userData.lockReason || 'Multiple failed authentication attempts'}</p>
          <p><strong>Locked Until:</strong> ${unlockTime}</p>
          <p><strong>Failed Attempts:</strong> ${userData.loginAttempts}</p>
          <p><strong>Lock Duration:</strong> ${userData.lockDuration}</p>
        </div>
        
        <p>This is a security measure to protect your account from unauthorized access.</p>
        
        <p><strong>What you can do:</strong></p>
        <ul>
          <li>Wait for the lock period to expire automatically</li>
          <li>Use the "Forgot Password" feature to reset your password</li>
          <li>Contact our support team if you believe this is an error</li>
        </ul>
        
        <div style="text-align: center; margin: 25px 0;">
          <a href="${process.env.FRONTEND_URL}/forgot-password" class="button">Reset Password</a>
          <a href="mailto:support@messfinder.com" class="button" style="background: #64748b;">Contact Support</a>
        </div>
        
        <p style="color: #ef4444; font-weight: bold;">
          If you did not attempt to log in, please contact our support team immediately as your account may be compromised.
        </p>
      </div>
      
      <div class="footer">
        <p>Security Team - MessFinder</p>
        <p>Email: support@messfinder.com | Phone: +880 XXXX-XXXXXX</p>
        <p>© 2024 MessFinder. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
};

export const getAccountDeactivatedTemplate = (userData) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .alert-box { background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; }
        .footer { background: #64748b; color: white; padding: 15px; text-align: center; }
        .button { background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 5px; }
        .info-box { background: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🚫 Account Deactivated</h1>
        <p>MessFinder - Security Alert</p>
      </div>
      
      <div class="content">
        <h2>Hello ${userData.name},</h2>
        
        <div class="alert-box">
          <h3>🚨 Critical Security Alert</h3>
          <p>Your MessFinder account has been deactivated due to multiple consecutive failed login attempts.</p>
        </div>
        
        <div class="info-box">
          <p><strong>Reason:</strong> ${userData.deactivationReason}</p>
          <p><strong>Failed Attempts:</strong> ${userData.loginAttempts}</p>
          <p><strong>Status:</strong> Account Deactivated</p>
        </div>
        
        <p>This is an extreme security measure to protect your account from brute force attacks.</p>
        
        <p><strong>Immediate Action Required:</strong></p>
        <ul>
          <li>Your account cannot be unlocked automatically</li>
          <li>You must contact our support team to reactivate your account</li>
          <li>You will need to verify your identity</li>
          <li>You may need to reset your password</li>
        </ul>
        
        <div style="text-align: center; margin: 25px 0;">
          <a href="mailto:${userData.contactEmail}" class="button">Contact Support Team</a>
          <a href="${process.env.FRONTEND_URL}/support" class="button" style="background: #64748b;">Visit Support Center</a>
        </div>
        
        <p style="color: #dc2626; font-weight: bold;">
          If you did not attempt to access your account, please contact us immediately as your account security may be compromised.
        </p>
      </div>
      
      <div class="footer">
        <p>Security Team - MessFinder</p>
        <p>Email: ${userData.contactEmail} | Phone: +880 XXXX-XXXXXX</p>
        <p>© 2024 MessFinder. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
};

// if mess status change 
export const getMessStatusUpdateTemplate = (messData) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .status-box { background: #faf5ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8b5cf6; }
        .status-badge { display: inline-block; padding: 6px 12px; border-radius: 20px; color: white; font-weight: bold; }
        .footer { background: #64748b; color: white; padding: 15px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🏠 Mess Status Updated</h1>
        <p>MessFinder - Property Management</p>
      </div>
      
      <div class="content">
        <h2>Hello ${messData.ownerName},</h2>
        <p>Your mess listing status has been updated. Here are the details:</p>
        
        <div class="status-box">
          <h3>📊 Mess Information</h3>
          <p><strong>Mess Name:</strong> ${messData.messName}</p>
          <p><strong>Address:</strong> ${messData.address}</p>
          <p><strong>Previous Status:</strong> ${messData.previousStatus}</p>
          <p><strong>Current Status:</strong> 
            <span class="status-badge" style="background: ${
              messData.currentStatus === 'free' ? '#10b981' :
              messData.currentStatus === 'booked' ? '#ef4444' :
              messData.currentStatus === 'pending' ? '#f59e0b' :
              '#8b5cf6'
            };">
              ${messData.currentStatus.toUpperCase()}
            </span>
          </p>
          <p><strong>Updated At:</strong> ${new Date(messData.updatedAt).toLocaleString()}</p>
        </div>
        
        <p><strong>What this means:</strong></p>
        <ul>
          ${
            messData.currentStatus === 'free' 
              ? '<li>✅ Your mess is now available for new bookings</li>'
              : messData.currentStatus === 'booked'
              ? '<li>✅ Your mess has been successfully booked</li>'
              : messData.currentStatus === 'pending'
              ? '<li>⏳ Your mess has pending booking requests</li>'
              : '<li>📝 Your mess status has been updated</li>'
          }
          <li>You can manage your listing from your dashboard</li>
          <li>Contact support if this status is incorrect</li>
        </ul>
        
        <div style="text-align: center; margin: 20px 0;">
          <a href="${process.env.FRONTEND_URL}/owner/dashboard" style="background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Dashboard</a>
        </div>
      </div>
      
      <div class="footer">
        <p>Thank you for using MessFinder!</p>
        <p>Questions? Contact us at support@messfinder.com</p>
        <p>© 2025 MessFinder. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
};



// payment success mail tamplate with pdf

export const getPaymentSuccessTemplate = (paymentData) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .payment-details { background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .amount-box { background: #dcfce7; padding: 15px; text-align: center; border-radius: 8px; margin: 15px 0; }
        .footer { background: #64748b; color: white; padding: 15px; text-align: center; }
        .button { background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>💰 Payment Successful!</h1>
        <p>MessFinder - Payment Confirmation</p>
      </div>
      
      <div class="content">
        <h2>Hello ${paymentData.userName},</h2>
        <p>Your payment has been processed successfully. Thank you for your transaction!</p>
        
        <div class="payment-details">
          <h3>📋 Payment Information</h3>
          <div class="amount-box">
            <h2>BDT ${paymentData.amount}</h2>
            <p>Amount Paid</p>
          </div>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Transaction ID:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${paymentData.transactionId}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Payment Method:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${paymentData.paymentMethod}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Payment Date:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${new Date(paymentData.paymentDate).toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Mess Name:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${paymentData.messName}</td>
            </tr>
            <tr>
              <td style="padding: 8px;"><strong>Booking Reference:</strong></td>
              <td style="padding: 8px;">${paymentData.bookingId}</td>
            </tr>
          </table>
        </div>
        
        <p><strong>📎 Attachment:</strong> Your payment receipt is attached to this email as a PDF file.</p>
        
        <p><strong>Next Steps:</strong></p>
        <ul>
          <li>Keep this receipt for your records</li>
          <li>Contact the mess owner for check-in details</li>
          <li>Save the transaction ID for future reference</li>
        </ul>
        
        <div style="text-align: center; margin: 25px 0;">
          <a href="${process.env.FRONTEND_URL}/bookings/${paymentData.bookingId}" class="button">View Booking Details</a>
        </div>
      </div>
      
      <div class="footer">
        <p>Thank you for choosing MessFinder!</p>
        <p>For payment inquiries, contact: payments@messfinder.com</p>
        <p>© 2025 MessFinder. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
};


// Status update email template for viewing requests
export const getStatusUpdateTemplate = (requestData) => {
  const { userName, messTitle, oldStatus, newStatus, messAddress, ownerName } = requestData;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0; 
          padding: 0; 
          background-color: #f8fafc;
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background: #ffffff; 
          border-radius: 10px; 
          overflow: hidden; 
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header { 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          color: white; 
          padding: 30px 20px; 
          text-align: center; 
        }
        .header h1 { 
          margin: 0; 
          font-size: 28px; 
          font-weight: 600;
        }
        .header p { 
          margin: 10px 0 0 0; 
          opacity: 0.9; 
          font-size: 16px;
        }
        .content { 
          padding: 30px; 
        }
        .greeting { 
          font-size: 18px; 
          color: #2d3748; 
          margin-bottom: 20px;
        }
        .status-box { 
          background: #f7fafc; 
          padding: 25px; 
          border-radius: 8px; 
          margin: 25px 0; 
          border-left: 4px solid #667eea;
        }
        .status-header { 
          color: #2d3748; 
          margin-bottom: 20px; 
          font-size: 20px; 
          font-weight: 600;
        }
        .status-details { 
          display: grid; 
          gap: 12px;
        }
        .status-item { 
          display: flex; 
          justify-content: space-between; 
          padding: 10px 0; 
          border-bottom: 1px solid #e2e8f0;
        }
        .status-item:last-child { 
          border-bottom: none;
        }
        .status-label { 
          font-weight: 600; 
          color: #4a5568;
        }
        .status-value { 
          color: #2d3748; 
          font-weight: 500;
        }
        .status-badge {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 20px;
          color: white;
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
        }
        .info-section {
          background: ${getStatusColor(newStatus).background};
          color: ${getStatusColor(newStatus).text};
          padding: 20px;
          border-radius: 8px;
          margin: 25px 0;
          border-left: 4px solid ${getStatusColor(newStatus).border};
        }
        .info-section h3 {
          margin-top: 0;
          margin-bottom: 15px;
          font-size: 18px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .steps-list {
          margin: 15px 0;
          padding-left: 20px;
        }
        .steps-list li {
          margin-bottom: 8px;
          line-height: 1.5;
        }
        .action-button {
          display: inline-block;
          background: #667eea;
          color: white;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          text-align: center;
          transition: all 0.3s ease;
          margin: 10px 5px;
        }
        .action-button:hover {
          background: #5a6fd8;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }
        .button-accepted { background: #22c55e; }
        .button-accepted:hover { background: #16a34a; }
        .button-rejected { background: #6c757d; }
        .button-rejected:hover { background: #5a6268; }
        .footer { 
          background: #64748b; 
          color: white; 
          padding: 25px; 
          text-align: center; 
        }
        .footer p { 
          margin: 5px 0; 
        }
        .contact-info {
          margin-top: 15px;
          font-size: 14px;
          opacity: 0.9;
        }
        .status-icon {
          font-size: 20px;
        }
        @media (max-width: 600px) {
          .content {
            padding: 20px;
          }
          .status-item {
            flex-direction: column;
            gap: 5px;
          }
          .action-button {
            display: block;
            width: 100%;
            margin: 10px 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📬 Viewing Request Update</h1>
          <p>MessFinder - Your accommodation partner</p>
        </div>
        
        <div class="content">
          <h2 class="greeting">Hello ${userName},</h2>
          <p>Your mess viewing request status has been updated. Here are the details:</p>
          
          <div class="status-box">
            <h3 class="status-header">📋 Request Details</h3>
            <div class="status-details">
              <div class="status-item">
                <span class="status-label">Mess Name:</span>
                <span class="status-value">${messTitle}</span>
              </div>
              <div class="status-item">
                <span class="status-label">Address:</span>
                <span class="status-value">${messAddress}</span>
              </div>
              <div class="status-item">
                <span class="status-label">Owner:</span>
                <span class="status-value">${ownerName}</span>
              </div>
              <div class="status-item">
                <span class="status-label">Previous Status:</span>
                <span class="status-value">
                  <span class="status-badge" style="background: ${getStatusColor(oldStatus).badge}">
                    ${getStatusDisplayText(oldStatus)}
                  </span>
                </span>
              </div>
              <div class="status-item">
                <span class="status-label">Current Status:</span>
                <span class="status-value">
                  <span class="status-badge" style="background: ${getStatusColor(newStatus).badge}">
                    ${getStatusDisplayText(newStatus)}
                  </span>
                </span>
              </div>
              <div class="status-item">
                <span class="status-label">Updated At:</span>
                <span class="status-value">${new Date().toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          <div class="info-section">
            <h3>
              <span class="status-icon">${getStatusIcon(newStatus)}</span>
              ${getStatusTitle(newStatus)}
            </h3>
            ${getStatusMessage(newStatus)}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            ${getActionButtons(newStatus)}
          </div>
          
          <p style="color: #64748b; font-size: 14px; text-align: center;">
            If you have any questions, please contact the mess owner or our support team.
          </p>
        </div>
        
        <div class="footer">
          <p><strong>Thank you for using MessFinder!</strong></p>
          <p>Find your perfect accommodation with ease</p>
          <div class="contact-info">
            <p>Email: support@messfinder.com | Phone: +880 XXXX-XXXXXX</p>
            <p>© 2025 MessFinder. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Helper functions
const getStatusColor = (status) => {
  const colors = {
    accepted: {
      background: '#f0fdf4',
      text: '#166534',
      border: '#22c55e',
      badge: '#16a34a'
    },
    rejected: {
      background: '#fef2f2',
      text: '#991b1b',
      border: '#ef4444',
      badge: '#dc2626'
    },
    pending: {
      background: '#fffbeb',
      text: '#92400e',
      border: '#f59e0b',
      badge: '#d97706'
    }
  };
  
  return colors[status] || {
    background: '#f8fafc',
    text: '#374151',
    border: '#64748b',
    badge: '#6b7280'
  };
};

const getStatusDisplayText = (status) => {
  const statusMap = {
    accepted: 'Accepted',
    rejected: 'Rejected', 
    pending: 'Pending Review'
  };
  return statusMap[status] || status;
};

const getStatusIcon = (status) => {
  const icons = {
    accepted: '✅',
    rejected: '❌',
    pending: '⏳'
  };
  return icons[status] || '📝';
};

const getStatusTitle = (status) => {
  const titles = {
    accepted: 'Request Accepted!',
    rejected: 'Request Not Accepted',
    pending: 'Request Under Review'
  };
  return titles[status] || 'Status Updated';
};

const getStatusMessage = (status) => {
  const messages = {
    accepted: `
      <p>Great news! The mess owner has accepted your viewing request. You can now proceed with scheduling a visit.</p>
      <p><strong>Next Steps:</strong></p>
      <ul class="steps-list">
        <li>Contact the mess owner to schedule a convenient viewing time</li>
        <li>Prepare questions about facilities, rules, and payment terms</li>
        <li>Bring necessary documents if you're interested in booking</li>
        <li>Confirm the viewing appointment a day before your visit</li>
      </ul>
      <p>We recommend being punctual and professional during your visit.</p>
    `,
    rejected: `
      <p>We're sorry to inform you that your viewing request has not been accepted at this time.</p>
      <p><strong>Possible reasons:</strong></p>
      <ul class="steps-list">
        <li>The mess is no longer available for viewing</li>
        <li>Timing conflict with other scheduled viewings</li>
        <li>The owner has already chosen another tenant</li>
        <li>The mess specifications don't match your requirements</li>
      </ul>
      <p>Don't worry! There are plenty of other great mess options available that might be perfect for you.</p>
    `,
    pending: `
      <p>Your viewing request is currently being reviewed by the mess owner.</p>
      <p><strong>What to expect:</strong></p>
      <ul class="steps-list">
        <li>The owner typically responds within 24-48 hours</li>
        <li>You'll receive another notification once a decision is made</li>
        <li>Keep an eye on your email for updates</li>
      </ul>
      <p>Thank you for your patience during this process.</p>
    `
  };
  
  return messages[status] || '<p>Your request status has been updated.</p>';
};

const getActionButtons = (status) => {
  const baseUrl = process.env.FRONTEND_URL || 'https://messfinder.com';
  
  const buttons = {
    accepted: `
      <a href="${baseUrl}/messes" class="action-button button-accepted">View Mess Details</a>
      <a href="${baseUrl}/dashboard" class="action-button">My Dashboard</a>
    `,
    rejected: `
      <a href="${baseUrl}/messes" class="action-button button-rejected">Browse Other Messes</a>
      <a href="${baseUrl}/dashboard" class="action-button">My Dashboard</a>
    `,
    pending: `
      <a href="${baseUrl}/dashboard" class="action-button">View My Dashboard</a>
      <a href="${baseUrl}/messes" class="action-button">Browse Messes</a>
    `
  };
  
  return buttons[status] || `
    <a href="${baseUrl}/dashboard" class="action-button">View Dashboard</a>
  `;
};

// Email template for request status updates
export const getRequestStatusTemplate = (requestData) => {
  const { 
    userName, 
    userEmail, 
    userPhone, 
    messTitle, 
    messAddress, 
    requestStatus, 
    requestDate,
    requestId,
    userMessage 
  } = requestData;

  const statusColors = {
    pending: '#f59e0b', // amber
    accepted: '#10b981', // green
    rejected: '#ef4444', // red
    cancelled: '#6b7280' // gray
  };

  const statusIcons = {
    pending: '🔔',
    accepted: '✅',
    rejected: '❌',
    cancelled: '🚫'
  };

  const statusMessages = {
    pending: 'New viewing request received',
    accepted: 'Viewing request has been accepted',
    rejected: 'Viewing request has been rejected',
    cancelled: 'Viewing request has been cancelled'
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .status-badge { 
                display: inline-block; 
                padding: 8px 16px; 
                border-radius: 20px; 
                font-weight: bold; 
                margin: 10px 0; 
                background-color: ${statusColors[requestStatus] || '#6b7280'}; 
                color: white; 
            }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
            .user-details { background: #e8f4fd; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>${statusIcons[requestStatus]} ${statusMessages[requestStatus]}</h1>
                <p>Mess: ${messTitle}</p>
            </div>
            
            <div class="content">
                <div class="status-badge">
                    Request Status: ${requestStatus.toUpperCase()}
                </div>
                
                <div class="info-box">
                    <h3>📋 Request Details</h3>
                    <p><strong>Request ID:</strong> ${requestId}</p>
                    <p><strong>Mess Title:</strong> ${messTitle}</p>
                    <p><strong>Mess Address:</strong> ${messAddress}</p>
                    <p><strong>Request Date:</strong> ${new Date(requestDate).toLocaleDateString()}</p>
                </div>
                
                <div class="user-details">
                    <h3>👤 User Information</h3>
                    <p><strong>Name:</strong> ${userName}</p>
                    <p><strong>Email:</strong> ${userEmail}</p>
                    <p><strong>Phone:</strong> ${userPhone || 'Not provided'}</p>
                    ${userMessage ? `<p><strong>Message:</strong> ${userMessage}</p>` : ''}
                </div>
                
                <div style="text-align: center; margin: 25px 0;">
                    <a href="${process.env.FRONTEND_URL}/owner/requests" class="button">View All Requests</a>
                    <a href="${process.env.FRONTEND_URL}/mess/info/${requestData.messId}" class="button" style="background: #10b981;">View Mess Details</a>
                </div>
                
                ${requestStatus === 'pending' ? `
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
                    <h4 style="color: #856404; margin: 0;">Action Required</h4>
                    <p style="color: #856404; margin: 5px 0 0 0;">Please respond to this viewing request within 24 hours.</p>
                </div>
                ` : ''}
                
                <div class="footer">
                    <p>This is an automated notification from MessFinder.</p>
                    <p>If you have any questions, please contact our support team.</p>
                    <p>&copy; ${new Date().getFullYear()} MessFinder. All rights reserved.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
};