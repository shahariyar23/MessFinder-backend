// utils/ApiError.js
class ApiError extends Error {
    constructor(statusCode, message, errors = [], stack = "") {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.errors = errors;
        this.success = false;
        this.data = null;
        
        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    
    // Add this method to ensure proper JSON serialization
    toJSON() {
        return {
            success: this.success,
            message: this.message,
            errors: this.errors,
            statusCode: this.statusCode,
            data: this.data
        };
    }
}

export default ApiError;