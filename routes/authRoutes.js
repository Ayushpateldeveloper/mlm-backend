const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Transaction = require('../models/Transaction'); // Added Transaction model
const { 
    registerUser, 
    getUserProfile, 
    authMiddleware, 
    generateToken 
} = require('../middleware/authMiddleware');

// @route   POST /api/auth/register
// @desc    Register a user
router.post('/register', registerUser);

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (!isProduction) {
        console.log('Login attempt received', { 
            email: req.body.email?.replace(/(.{2}).*@/, "$1***@") 
        });
    }

    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ 
                message: 'Email and password are required' 
            });
        }

        // Find user by email
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(400).json({ 
                message: 'Invalid credentials',
                details: 'User not found'
            });
        }

        // Compare passwords
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            return res.status(400).json({ 
                message: 'Invalid credentials',
                details: 'Password does not match'
            });
        }

        // Check user account status
        if (!user.isActive) {
            return res.status(403).json({ 
                message: 'Account is not active',
                details: 'Your account has been deactivated'
            });
        }

        // Generate JWT token
        const token = generateToken(user);

        // Respond with token and user info
        res.status(200).json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role || 'USER',
                walletBalance: user.walletBalance
            }
        });
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({ 
            message: 'Server error during login', 
            error: 'An unexpected error occurred' 
        });
    }
});

// @route   GET /api/auth/profile
// @desc    Get user profile
router.get('/profile', authMiddleware, getUserProfile);

// @route   GET /api/auth/user/:id
// @desc    Get user data by ID
router.get('/user/:id', authMiddleware, async (req, res) => {
    const isProduction = process.env.NODE_ENV === 'production';
    
    try {
        const user = await User.findById(req.params.id)
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
        console.error('Get profile error:', error.message);
        res.status(500).json({ 
            message: 'Server error fetching profile', 
            error: 'An unexpected error occurred' 
        });
    }
});

// Token verification route
router.get('/verify-token', authMiddleware, async (req, res) => {
    try {
        // If authMiddleware passes, the user is already authenticated
        // req.user is set by the authMiddleware
        const user = await User.findById(req.user.id).select('-password');
        
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        res.json({ 
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            } 
        });
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ message: 'Invalid token' });
    }
});

module.exports = router;
