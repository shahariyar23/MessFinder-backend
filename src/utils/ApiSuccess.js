class ApiSuccess {
    constructor(message="Success", data, statusCode=200) {
        this.success = true;
        this.message = message;
        this.data = data;
        this.errors = [];
        this.statusCode = statusCode < 400;
    }
}

export default ApiSuccess;