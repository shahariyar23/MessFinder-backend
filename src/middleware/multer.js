// middleware/uploadMiddleware.js
import multer from 'multer';
import fs from 'fs/promises';

// Keep your existing disk storage
const storage = multer.diskStorage({
    destination: function(req, file, cb){
        cb(null, "./public/temp")
    },
    filename: function(req, file, cb){
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname);
    }
});

export const upload = multer({
    storage,
    limits: {
        files: 3,
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Cleanup utility function
export const cleanupUploadedFiles = async (files) => {
    if (!files || files.length === 0) return;
    
    const cleanupPromises = files.map(async (file) => {
        try {
            if (file.path) {
                await fs.unlink(file.path);
                console.log(`✅ Cleaned up local file: ${file.path}`);
            }
        } catch (error) {
            console.error(`❌ Failed to clean up local file: ${file.path}`, error);
        }
    });

    await Promise.all(cleanupPromises);
};