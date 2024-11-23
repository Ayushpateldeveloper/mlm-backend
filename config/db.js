const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');

const connectDB = async () => {
    try {
        // Parse the MongoDB URI
        const uri = process.env.MONGODB_URI;
        
        // Connect using Mongoose
        const conn = await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            dbName: 'mern_sample_db'
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);
        console.log(`Database Name: ${conn.connection.db.databaseName}`);
        
        // Separate MongoDB client connection for admin operations
        const client = new MongoClient(uri);
        
        try {
            await client.connect();
            
            // Get the database names
            const adminDb = client.db().admin();
            const databases = await adminDb.listDatabases();
            
            console.log('Available Databases:', databases.databases.map(db => db.name));
            
            // Check if collections exist
            const db = client.db('mern_sample_db');
            const collections = await db.listCollections().toArray();
            
            console.log('Collections in mern_sample_db:', collections.map(col => col.name));
            
            // Optional: Migrate users collection if needed
            if (collections.some(col => col.name === 'users')) {
                console.log('Users collection already exists in mern_sample_db');
            } else {
                console.log('No users collection found. Checking test database.');
                
                const testDb = client.db('test');
                const testCollections = await testDb.listCollections().toArray();
                
                if (testCollections.some(col => col.name === 'users')) {
                    console.log('Users collection found in test database. Attempting migration...');
                    // Migration logic would go here
                }
            }
        } catch (connectionError) {
            console.error('MongoDB Client Connection Error:', connectionError);
        } finally {
            // Always close the client connection
            await client.close();
        }

        return conn;
    } catch (error) {
        console.error(`MongoDB Connection Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
