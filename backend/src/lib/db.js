import mongoose from 'mongoose';
import logger from './logger.js';

export const connectDB=async()=>{
    try{
       const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_URL;
       if (!mongoUri) {
         throw new Error("MongoDB URI is missing. Set MONGODB_URI in backend/.local.env");
       }

       const conn = await mongoose.connect(mongoUri)
       logger.info("MongoDB connected", {
         context: "db.connect",
         host: conn.connection.host,
       });

       // Cleanup stale index left from older schema versions.
       // It blocks signups with: duplicate key error index userId_1.
       const userCollection = mongoose.connection.db.collection("users");
       const indexes = await userCollection.indexes();
       const hasDeprecatedUserIdIndex = indexes.some((index) => index.name === "userId_1");

       if (hasDeprecatedUserIdIndex) {
         await userCollection.dropIndex("userId_1");
         logger.info("Dropped deprecated users index", {
           context: "db.connect",
           index: "userId_1",
         });
       }
    }
    catch(err){
        logger.error("MongoDB connection error", {
          context: "db.connect",
          error: err.message,
          stack: err.stack,
        });
    }
}
