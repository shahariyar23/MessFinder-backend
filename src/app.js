import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

/* ES module __dirname fix */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* Routes */
import userRouter from "./routes/user.route.js";
import errorHandler from "./middleware/errorHandler.js";
import messListingRoute from "./routes/messlisting.route.js";
import bookingRoute from "./routes/booking.route.js";
import reviewRoute from "./routes/review.route.js";
import adminRoute from "./routes/admin.route.js";
import ownerRoute from "./routes/owner.route.js";
import requestRoute from "./routes/requestMessView.route.js";
import saveRouter from "./routes/saveMess.route.js";
import paymentRoute from "./routes/payment.route.js";

const app = express();

/* ===================== 🔐 CORS ===================== */
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      "http://localhost:5173",
      process.env.FRONTEND_URL,
    ].filter(Boolean);

    /* ✅ Allow server-to-server calls (SSLCommerz, IPN, Postman) */
    if (!origin) return callback(null, true);

    /* Exact match */
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    /* Allow all Vercel preview domains */
    if (/\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }

    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Cache-Control",
    "Pragma",
    "X-Requested-With",
  ],
  exposedHeaders: ["Set-Cookie"],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

/* ⚠️ CORS must come BEFORE routes */
app.use(cors(corsOptions));

/* ===================== BODY & COOKIE ===================== */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

/* ===================== STATIC ===================== */
app.use(express.static("public"));

/* ===================== API ROUTES ===================== */
app.use("/api/v1/user", userRouter);
app.use("/api/v1/mess", messListingRoute);
app.use("/api/v1/mess/save", saveRouter);
app.use("/api/v1/booking", bookingRoute);
app.use("/api/v1/review", reviewRoute);
app.use("/api/v1/admin", adminRoute);
app.use("/api/v1/owner", ownerRoute);
app.use("/api/v1/request", requestRoute);
app.use("/api/v1/payment", paymentRoute);

/* ===================== HEALTH ===================== */
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    env: process.env.NODE_ENV,
    frontend: process.env.FRONTEND_URL,
    time: new Date().toISOString(),
  });
});

/* ===================== 404 HANDLER FOR API ROUTES ===================== */
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      success: false,
      message: `API route ${req.method} ${req.path} not found`
    });
  }
  
  // For non-API routes
  res.status(404).send("Not Found");
});

/* ===================== ERROR HANDLER ===================== */
app.use(errorHandler);

export default app;