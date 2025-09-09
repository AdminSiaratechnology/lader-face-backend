const mongoose = require('mongoose');


const connectDB = async () => {
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI missing');
await mongoose.connect(uri, {
autoIndex: true,
serverSelectionTimeoutMS: 15000
});
console.log('✅ MongoDB connected');
};


module.exports = connectDB;