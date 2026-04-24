import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
});

const connectDB = async () => {
    try{
        await prisma.$connect();
        console.log("Connected to the database successfully via Prisma!");
    }catch(error){
        console.error("Error connecting to the database:", error);
        process.exit(1);
    }
};


const disconnectDB = async () => {
    await prisma.$disconnect();
};


export {
    connectDB,
    disconnectDB,
    prisma
};