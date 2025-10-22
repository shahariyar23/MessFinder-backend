import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';





const app = express();
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',
      process.env.FRONTEND_URL // Your Vercel URL from environment variable
    ].filter(Boolean); // Remove any undefined values
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma']
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
    res.send('Welcome to Mess Management System API');
});



app.use(errorHandler);
export default app;