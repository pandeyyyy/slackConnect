import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const config = {
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/slackconnect2025',
};

export const connectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

export default config;
