// middlewares/authUser.js
import jwt from 'jsonwebtoken';

const authUser = (req, res, next) => {
    const { token } = req.cookies;

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized: No token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.id) {
            req.userId = decoded.id; // ✅ attach user ID to req
            next();
        } else {
            return res.status(401).json({ success: false, message: 'Not authorized: Invalid token' });
        }
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
};

export default authUser;
