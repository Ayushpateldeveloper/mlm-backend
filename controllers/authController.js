const User = require('../models/User');
const { generateToken } = require('../middleware/authMiddleware');
const bcrypt = require('bcryptjs');

// Utility function to create a test user if not exists
const ensureTestUser = async () => {
    try {
        const existingUser = await User.findOne({ email: 'test@gmail.com' });
        
        if (!existingUser) {
            console.log('Creating test user...');
            const testUser = new User({
                username: 'testuser',
                email: 'test@gmail.com',
                password: 'TestPassword123!' // Use a strong, predefined password
            });

            await testUser.save();
            console.log('Test user created successfully');
        } else {
            console.log('Test user already exists');
        }
    } catch (error) {
        console.error('Error creating test user:', error);
    }
};

// Call this function during server startup or in a separate initialization script
module.exports.initializeTestUser = ensureTestUser;

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validate input
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Please provide username, email, and password' });
        }

        // Create new user
        const user = new User({
            username,
            email,
            password,
            referralCode: Math.random().toString(36).substring(2, 8).toUpperCase() // Generate a unique referral code
        });

        // Save user to database
        try {
            await user.save();
        } catch (error) {
            // Handle specific validation errors
            if (error.name === 'DuplicateUsernameError') {
                return res.status(409).json({ message: 'Username already exists' });
            }
            if (error.name === 'DuplicateEmailError') {
                return res.status(409).json({ message: 'Email already exists' });
            }
            if (error.name === 'ValidationError') {
                return res.status(400).json({ 
                    message: 'Validation failed',
                    errors: Object.values(error.errors).map(err => err.message)
                });
            }

            // Log unexpected errors
            console.error('Unexpected registration error:', error);
            return res.status(500).json({ 
                message: 'Server error during registration',
                error: error.message 
            });
        }

        // Generate JWT token
        const token = generateToken(user);

        // Respond with user info and token
        res.status(201).json({ 
            token, 
            user: { 
                id: user._id, 
                username: user.username, 
                email: user.email 
            } 
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            message: 'Server error during registration',
            error: error.message 
        });
    }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res) => {
    const { email, password } = req.body;

    console.log('Login attempt:', { email, passwordLength: password ? password.length : 'N/A' });

    // Validate input
    if (!email || !password) {
        console.log('Missing email or password');
        return res.status(400).json({ message: 'Please provide email and password', error: 'Incomplete credentials' });
    }

    try {
        // Find user by email and explicitly select password field
        const user = await User.findOne({ email }).select('+password');

        // Check if user exists
        if (!user) {
            console.log(`No user found with email: ${email}`);
            return res.status(400).json({ message: 'Invalid credentials', error: 'User not found' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            console.log(`Password mismatch for email: ${email}`);
            return res.status(400).json({ message: 'Invalid credentials', error: 'Incorrect password' });
        }

        // Generate JWT token
        const token = generateToken(user);

        // Respond with token and user info
        res.json({
            token,
            user: { id: user._id, username: user.username, email: user.email }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            message: 'Server error during login',
            error: error.message
        });
    }
};
// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
exports.getUserProfile = async (req, res) => {
    try {
        // Find user by ID from the token (added by authMiddleware)
        const user = await User.findById(req.user.id).select('-password');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ 
            message: 'Server error fetching user profile',
            error: error.message 
        });
    }
};
