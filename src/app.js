import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';






const app = express();
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));
app.use(express.json({limit: '10mb'}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));
app.use(cookieParser());



// Routes import
import userRouter from './routes/user.route.js';
import errorHandler from './middleware/errorHandler.js';
import messListingRoute from './routes/messlisting.route.js';


app.use(errorHandler);
app.use("/api/v1/user", userRouter);
app.use("/api/v1/mess", messListingRoute)



export default app;