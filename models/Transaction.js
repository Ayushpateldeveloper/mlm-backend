const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['DEPOSIT', 'WITHDRAWAL', 'REFERRAL_BONUS', 'COMMISSION'],
        default: 'DEPOSIT'
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ['PENDING', 'COMPLETED', 'FAILED'],
        default: 'COMPLETED'
    },
    paymentMethod: {
        type: String,
        enum: ['RAZORPAY', 'BANK_TRANSFER', 'WALLET'],
        default: 'RAZORPAY'
    },
    razorpayPaymentId: {
        type: String,
        trim: true,
        unique: true,
        sparse: true,
        index: true
    },
    description: {
        type: String,
        default: 'Wallet Funds Deposit',
        trim: true
    },
    notes: {
        type: String,
        trim: true,
        maxlength: 500,
        default: ''
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true,  // Automatically adds createdAt and updatedAt fields
    toJSON: { 
        virtuals: true,
        transform: (doc, ret) => {
            ret.createdAt = ret.createdAt ? new Date(ret.createdAt).toISOString() : null;
            ret.updatedAt = ret.updatedAt ? new Date(ret.updatedAt).toISOString() : null;
            return ret;
        }
    }
});

// Validation middleware to prevent duplicate transactions
TransactionSchema.pre('save', async function(next) {
    // Only check for duplicates if razorpayPaymentId is present
    if (this.razorpayPaymentId) {
        try {
            const existingTransaction = await this.constructor.findOne({
                user: this.user,
                razorpayPaymentId: this.razorpayPaymentId
            });

            if (existingTransaction) {
                const error = new Error('Transaction with this Razorpay Payment ID already exists');
                error.name = 'DuplicateTransactionError';
                return next(error);
            }
            next();
        } catch (error) {
            next(error);
        }
    } else {
        next();
    }
});

// Safely create indexes without throwing errors if they already exist
const safeCreateIndexes = async (model) => {
    try {
        await model.createIndexes();
        console.log(`Indexes created successfully for ${model.modelName}`);
    } catch (error) {
        if (error.code === 85) {
            console.log(`Indexes already exist for ${model.modelName}`);
        } else {
            console.error(`Error creating indexes for ${model.modelName}:`, error);
        }
    }
};

// Compile the model
const Transaction = mongoose.model('Transaction', TransactionSchema, 'transactions');

// Ensure indexes are created safely after model compilation
mongoose.connection.once('open', () => {
    safeCreateIndexes(Transaction);
});

module.exports = Transaction;
