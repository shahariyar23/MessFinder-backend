class ApiSuccess {
    constructor(message, data = null, statusCode = 200) {
        this.success = true;
        this.message = message;
        this.data = data;
        this.statusCode = statusCode;
    }

    // Optional: Add toJSON for consistent serialization
    toJSON() {
        return {
            success: this.success,
            message: this.message,
            data: this.data,
            statusCode: this.statusCode
        };
    }
}

export default ApiSuccess;