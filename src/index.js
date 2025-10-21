import dotenv from 'dotenv';
import { connectDB } from './db/index.js';
import app from './app.js';

// Load environment based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' 
    ? '.env.production' 
    : '.env.local';

dotenv.config({
    path: envFile,
});

console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
console.log(`📁 Loading from: ${envFile}`);

const PORT = process.env.PORT || 8000;

const startServer = async () => {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`✅ Server is running on port ${PORT}`);
            console.log(`🚀 Mode: ${process.env.NODE_ENV}`);
        });
    } catch (error) {
        console.log("❌ Failed to start server", error);
        process.exit(1);
    }
};

startServer();

export default app;