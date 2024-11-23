const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true,
        minlength: 3
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    walletBalance: {
        type: Number,
        default: 0,
        min: 0
    },
    referralCode: {
        type: String,
        unique: true,
        sparse: true
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    role: {
        type: String,
        enum: ['USER', 'ADMIN'],
        default: 'USER'
    },
    transactions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    }],
    referralCount: {
        type: Number,
        default: 0
    },
    totalEarnings: {
        type: Number,
        default: 0
    },
    totalDeposits: {
        type: Number,
        default: 0,
        min: 0
    }
}, { 
    timestamps: true 
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        console.log('Comparing passwords:', {
            storedPasswordHash: this.password ? this.password.substring(0, 10) + '...' : 'No stored password',
            candidatePasswordLength: candidatePassword ? candidatePassword.length : 'N/A'
        });

        if (!this.password) {
            console.log('No password stored for this user');
            return false;
        }

        const isMatch = await bcrypt.compare(candidatePassword, this.password);
        
        console.log('Password comparison result:', isMatch);
        return isMatch;
    } catch (error) {
        console.error('Password comparison error:', error);
        return false;
    }
};

// Pre-save hook to hash password
UserSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) return next();

    try {
        // Generate a salt
        const salt = await bcrypt.genSalt(10);
        
        // Hash the password along with the salt
        this.password = await bcrypt.hash(this.password, salt);
        
        next();
    } catch (error) {
        next(error);
    }
});

// Modify unique index to be sparse and handle duplicates
UserSchema.index({ username: 1 }, { unique: true, sparse: true });
UserSchema.index({ email: 1 }, { unique: true, sparse: true });

// Pre-save middleware to handle potential duplicates
UserSchema.pre('save', async function(next) {
    // Only run this middleware for new or modified documents
    if (!this.isNew && !this.isModified('username') && !this.isModified('email')) {
        return next();
    }

    try {
        // Check for existing user with same username or email
        const existingUser = await this.constructor.findOne({
            $or: [
                { username: this.username },
                { email: this.email }
            ],
            _id: { $ne: this._id } // Exclude current document
        });

        if (existingUser) {
            if (existingUser.username === this.username) {
                const error = new Error('Username already exists');
                error.name = 'DuplicateUsernameError';
                return next(error);
            }
            if (existingUser.email === this.email) {
                const error = new Error('Email already exists');
                error.name = 'DuplicateEmailError';
                return next(error);
            }
        }

        next();
    } catch (error) {
        next(error);
    }
});

module.exports = mongoose.model('User', UserSchema);
