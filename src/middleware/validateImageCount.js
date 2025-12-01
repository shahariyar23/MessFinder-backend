export const validateImageCount = (req, res, next) => {
    if (!req.files || req.files.length !== 3) {
        return res.status(400).json({
            success: false,
            message: "Exactly 3 images are required"
        });
    }
    next();
};
