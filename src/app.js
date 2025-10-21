import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

const app = express();

// CORS configuration
app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://your-frontend-app.vercel.app',
        process.env.FRONTEND_URL
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Cookie']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));
app.use(cookieParser());

// Import routes
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

// API Routes
app.use("/api/v1/user", userRouter);
app.use("/api/v1/mess", messListingRoute);
app.use("/api/v1/mess/save", saveRouter);
app.use("/api/v1/booking", bookingRoute);
app.use("/api/v1/review", reviewRoute);
app.use("/api/v1/admin", adminRoute);
app.use("/api/v1/owner", ownerRoute);
app.use("/api/v1/request", requestRoute);
app.use("/api/v1/payment", paymentRoute);

// Health check
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'MessFinder Backend API',
        version: '1.0.0'
    });
});

// 404 handler - FIXED
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found`
    });
});

// Error handler
app.use(errorHandler);

export default app;