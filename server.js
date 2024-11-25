const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const connectDB = require('./config/db');
const { authMiddleware } = require('./middleware/authMiddleware');
const { initializeTestUser } = require('./controllers/authController');
const User = require('./models/User');

require('dotenv').config();

const app = express();

// Flexible CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        // Log the incoming origin to help debug
        console.log('Request Origin:', origin);

        // Allowed origins including local and production environments
        const allowedOrigins = [
            'http://localhost:3000',  // Local development
            'https://mlm-frontend-srrr.vercel.app', // Production frontend URL
            process.env.FRONTEND_URL  // Environment variable for frontend URL
        ];

        // If no origin (like mobile or curl), or it's an allowed origin, proceed
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.error('CORS error: Not allowed by CORS', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Methods allowed
    allowedHeaders: ['Content-Type', 'Authorization'],   // Allowed headers
    credentials: true // Allow cookies to be sent
};

app.use(cors(corsOptions));  // Use the CORS configuration
app.use(express.json());  // Parse incoming JSON requests

// Connect to MongoDB
connectDB().then(() => {
    // Initialize test user after database connection
    initializeTestUser();
});

// Routes
const authRoutes = require('./routes/authRoutes');
const transactionRoutes = require('./routes/transactionRoutes');

// Route Middleware
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);

// Basic route
app.get('/', (req, res) => {
    res.send('MERN Stack Backend is running');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'production' ? {} : err.stack
    });
});

// Set port from environment or default to 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app; // Export for deployment (e.g., Vercel)
