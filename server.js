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
        // Allow requests with no origin (like mobile apps or curl requests)
        const allowedOrigins = [
            'http://localhost:3000', 
            'https://mlm-frontend.vercel.app', 
            process.env.FRONTEND_URL
        ];
        
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app; // Export for Vercel
