// middleware/errorHandler.js
import ApiError from '../utils/ApiError.js';

const errorHandler = (err, req, res, next) => {
    let error = err;

    // If it's not an instance of ApiError, create one
    if (!(error instanceof ApiError)) {
        const statusCode = error.statusCode || 500;
        const message = error.message || 'Internal Server Error';
        error = new ApiError(statusCode, message, [], err.stack);
    }

    // Send JSON response
    res.status(error.statusCode).json({
        success: false,
        message: error.message,
        errors: error.errors,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
};

export default errorHandler;