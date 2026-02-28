import mongoose from 'mongoose';

export const connectDB=async()=>{
    try{
       const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_URL;
       if (!mongoUri) {
         throw new Error("MongoDB URI is missing. Set MONGODB_URI in backend/.local.env");
       }

       const conn = await mongoose.connect(mongoUri)
       console.log(`MongoDB Connected: ${conn.connection.host}`)

       // Cleanup stale index left from older schema versions.
       // It blocks signups with: duplicate key error index userId_1.
       const userCollection = mongoose.connection.db.collection("users");
       const indexes = await userCollection.indexes();
       const hasDeprecatedUserIdIndex = indexes.some((index) => index.name === "userId_1");

       if (hasDeprecatedUserIdIndex) {
         await userCollection.dropIndex("userId_1");
         console.log("Dropped deprecated users index: userId_1");
       }
    }
    catch(err){
        console.log("mongoDB connection error",err);
    }
}
