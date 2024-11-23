const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/authMiddleware');
const crypto = require('crypto');

// Add new transaction
router.post('/add', authMiddleware, async (req, res) => {
    console.log('Received add transaction request:', {
        userId: req.user.id,
        body: req.body
    });

    try {
        const { 
            amount, 
            type = 'DEPOSIT', 
            walletType = 'fund', 
            description, 
            notes 
        } = req.body;

        // Validate amount
        if (!amount || amount <= 0) {
            return res.status(400).json({ 
                error: 'Invalid transaction amount' 
            });
        }

        // Find user before transaction
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ 
                error: 'User not found' 
            });
        }

        console.log('Pre-Transaction User State:', {
            userId: user._id,
            username: user.username,
            currentWalletBalance: user.walletBalance,
            currentTotalDeposits: user.totalDeposits
        });

        // Create new transaction
        const newTransaction = new Transaction({
            user: req.user.id,
            type,
            amount,
            walletType,
            description: description || 'Fund Wallet Deposit',
            notes,
            status: 'COMPLETED',
            orderId: req.body.orderId,
            signature: req.body.signature,
            razorpayPaymentId: req.body.razorpayPaymentId
        });

        // Save transaction
        console.log('Saving transaction to database...');
        await newTransaction.save();
        console.log('Transaction saved successfully:', newTransaction._id);

        // Update user wallet balance
        console.log('Updating user wallet balance...');
        const previousBalance = user.walletBalance || 0;
        const previousDeposits = user.totalDeposits || 0;
        
        // Recalculate total deposits from all completed deposit transactions
        const totalDeposits = await Transaction.aggregate([
            { 
                $match: { 
                    user: user._id, 
                    type: 'DEPOSIT', 
                    status: 'COMPLETED' 
                } 
            },
            { 
                $group: { 
                    _id: null, 
                    total: { $sum: '$amount' } 
                } 
            }
        ]);

        const calculatedTotalDeposits = totalDeposits[0]?.total || 0;
        
        user.walletBalance = calculatedTotalDeposits;
        user.totalDeposits = calculatedTotalDeposits;
        
        console.log('Wallet update details:', {
            userId: user._id,
            previousBalance,
            newBalance: user.walletBalance,
            previousDeposits,
            newTotalDeposits: user.totalDeposits,
            calculatedTotalDeposits
        });

        await user.save();
        console.log('User wallet updated successfully');

        console.log('Transaction added successfully:', {
            transactionId: newTransaction._id,
            amount: amount,
            userId: req.user.id
        });

        res.status(201).json({
            message: 'Transaction added successfully',
            transaction: newTransaction,
            updatedBalance: user.walletBalance,
            totalDeposits: user.totalDeposits
        });
    } catch (error) {
        console.error('Comprehensive Transaction Error:', {
            message: error.message,
            name: error.name,
            stack: error.stack,
            requestBody: req.body
        });
        
        res.status(500).json({
            error: 'Failed to process transaction',
            details: error.message
        });
    }
});

// Get user transactions
router.get('/history', authMiddleware, async (req, res) => {
    console.log('Fetching transaction history for user:', req.user.id);
    
    try {
        // Use findOne instead of findById to avoid pre-save hooks
        const user = await User.findOne({ _id: req.user.id }).lean();
        
        if (!user) {
            return res.status(404).json({ 
                error: 'User not found' 
            });
        }

        console.log('User Details:', {
            _id: user._id,
            username: user.username,
            walletBalance: user.walletBalance,
            totalDeposits: user.totalDeposits,
            transactions: user.transactions
        });

        // Find transactions
        const transactions = await Transaction.find({ 
            user: req.user.id,
            type: 'DEPOSIT',
            status: 'COMPLETED'
        })
        .sort({ createdAt: -1 })
        .lean();

        console.log('Transaction Query Details:', {
            userIdUsed: req.user.id,
            transactionsFound: transactions.length,
            transactionDetails: transactions.map(t => ({
                id: t._id,
                type: t.type,
                amount: t.amount,
                createdAt: t.createdAt,
                status: t.status
            }))
        });

        // Calculate total deposits
        const totalDeposits = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);

        // Prepare formatted transactions
        const formattedTransactions = transactions.map(t => ({
            id: t._id,
            type: t.type,
            amount: t.amount,
            date: new Date(t.createdAt).toISOString().split('T')[0],
            status: t.status,
            notes: t.notes || '',
            description: t.description || ''
        }));

        res.status(200).json({
            transactions: formattedTransactions,
            walletBalance: totalDeposits,
            totalDeposits: totalDeposits
        });
    } catch (error) {
        console.error('Comprehensive Transaction History Error:', {
            message: error.message,
            name: error.name,
            stack: error.stack,
            userId: req.user.id
        });
        
        res.status(500).json({ 
            error: 'Failed to retrieve transaction history',
            details: error.message 
        });
    }
});

module.exports = router;
