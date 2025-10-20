
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


// Account lock mail tamplate
export const getAccountLockedTemplate = (userData) => {
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
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🚫 Account Temporarily Locked</h1>
        <p>MessFinder - Security Alert</p>
      </div>
      
      <div class="content">
        <h2>Hello ${userData.name},</h2>
        
        <div class="alert-box">
          <h3>⚠️ Important Security Notice</h3>
          <p>Your MessFinder account has been temporarily locked due to multiple failed login attempts or suspicious activity.</p>
        </div>
        
        <p><strong>Reason:</strong> ${userData.lockReason || 'Multiple failed authentication attempts'}</p>
        <p><strong>Locked Until:</strong> ${new Date(userData.lockUntil).toLocaleString()}</p>
        
        <p>To regain access to your account, you can:</p>
        <ul>
          <li>Wait for the lock period to expire automatically</li>
          <li>Reset your password using the link below</li>
          <li>Contact our support team for immediate assistance</li>
        </ul>
        
        <div style="text-align: center; margin: 25px 0;">
          <a href="${process.env.FRONTEND_URL}/reset-password" class="button">Reset Password</a>
          <a href="mailto:support@messfinder.com" class="button" style="background: #64748b;">Contact Support</a>
        </div>
        
        <p>If you believe this is an error, please contact our support team immediately.</p>
      </div>
      
      <div class="footer">
        <p>Security Team - MessFinder</p>
        <p>Email: support@messfinder.com | Phone: +880 XXXX-XXXXXX</p>
        <p>© 2025 MessFinder. All rights reserved.</p>
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