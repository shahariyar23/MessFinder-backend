import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';





const app = express();
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',
      process.env.FRONTEND_URL,
      // Add pattern for Vercel preview deployments
      /\.vercel\.app$/
    ].filter(Boolean);
    
    console.log('CORS Origin Check:', {
      incomingOrigin: origin,
      allowedOrigins: allowedOrigins
    });
    
    if (!origin) {
      return callback(null, true);
    }
    
    // Check exact match first
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Check regex patterns
    for (const pattern of allowedOrigins) {
      if (pattern instanceof RegExp && pattern.test(origin)) {
        console.log('CORS: Regex match allowed -', origin);
        return callback(null, true);
      }
    }
    
    console.log('CORS: Origin blocked -', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie']
};
app.use(cors(corsOptions));
app.use(express.json({limit: '10mb'}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));
app.use(cookieParser());



// Routes import
import userRouter from './routes/user.route.js';
import errorHandler from './middleware/errorHandler.js';
import messListingRoute from './routes/messlisting.route.js';
import bookingRoute from './routes/booking.route.js';
import reviewRoute from './routes/review.route.js';
import adminRoute from './routes/admin.route.js';
import ownerRoute from './routes/owner.route.js';
import requestRoute from './routes/requestMessView.route.js';
import saveRouter from './routes/saveMess.route.js';
import paymentRoute from './routes/payment.route.js';


app.use("/api/v1/user", userRouter);
app.use("/api/v1/mess", messListingRoute);
app.use("/api/v1/mess/save", saveRouter);
app.use("/api/v1/booking", bookingRoute);
app.use("/api/v1/review", reviewRoute);
app.use("/api/v1/admin", adminRoute);
app.use("/api/v1/owner", ownerRoute);
app.use("/api/v1/request", requestRoute);
app.use("/api/v1/payment", paymentRoute);

app.route('/', (req, res) => {
    res.json('Welcome to Mess Management System API');
});



// Health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    frontendUrl: process.env.FRONTEND_URL,
    corsConfig: {
      allowedOrigins: [
        'http://localhost:5173',
        process.env.FRONTEND_URL
      ].filter(Boolean)
    }
  });
});

// Test CORS route
app.get('/test-cors', (req, res) => {
  res.json({
    message: 'CORS is working!',
    origin: req.headers.origin,
    cookies: req.cookies
  });
});



app.use(errorHandler);
export default app;