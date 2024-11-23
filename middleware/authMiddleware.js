const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const registerUser = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ 
                message: 'User already exists',
                details: 'An account with this email already exists'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        user = new User({
            username,
            email,
            password: hashedPassword,
            isActive: true,
            role: 'USER',
            walletBalance: 0,
            referralCode: generateReferralCode(),
            referralCount: 0,
            totalEarnings: 0
        });

        // Save user
        await user.save();

        // Generate token
        const token = generateToken(user);

        res.status(201).json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Registration error:', {
            error: error.message,
            stack: error.stack
        });

        res.status(500).json({ 
            message: 'Server error during registration', 
            error: error.message 
        });
    }
};

const getUserProfile = async (req, res) => {
    try {
        // req.user is set by authMiddleware
        const user = await User.findById(req.user.id)
            .select('-password')
            .populate({
                path: 'transactions',
                options: { 
                    sort: { createdAt: -1 },
                    limit: 10
                }
            });

        if (!user) {
            return res.status(404).json({ 
                message: 'User not found' 
            });
        }

        res.json({
            id: user._id,
            username: user.username,
            email: user.email,
            walletBalance: user.walletBalance || 0,
            referralCode: user.referralCode,
            referralCount: user.referralCount || 0,
            totalEarnings: user.totalEarnings || 0,
            isActive: user.isActive,
            role: user.role || 'USER',
            transactions: user.transactions || []
        });
    } catch (error) {
        console.error('Get profile error:', {
            error: error.message,
            stack: error.stack
        });

        res.status(500).json({ 
            message: 'Server error fetching profile', 
            error: error.message 
        });
    }
};

const authMiddleware = async (req, res, next) => {
    // Get token from header
    const authHeader = req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    // Optional: Use environment-based logging
    const isProduction = process.env.NODE_ENV === 'production';
    if (!isProduction) {
        console.log('Authentication Middleware Triggered', {
            tokenPresent: !!token
        });
    }

    // Check if no token
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Extract user ID from different possible token structures
        const userId = decoded.id || 
                       decoded.user?.id || 
                       decoded._id || 
                       decoded.user?._id;
        
        if (!userId) {
            return res.status(401).json({ 
                message: 'Invalid token structure', 
                details: 'Unable to extract user ID' 
            });
        }

        // Find user to ensure they exist and are active
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        // Add user to request object
        req.user = {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role
        };

        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                message: 'Token expired', 
                error: 'Please log in again' 
            });
        }

        res.status(401).json({ 
            message: 'Token is not valid', 
            error: err.message 
        });
    }
};

// Function to generate JWT
const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role
        }, 
        process.env.JWT_SECRET, 
        { 
            expiresIn: '24h' 
        }
    );
};

// Utility function to generate referral code
const generateReferralCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
};

module.exports = {
    registerUser,
    getUserProfile,
    authMiddleware,
    generateToken
};
