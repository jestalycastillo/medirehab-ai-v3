import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { seedExerciseCatalog } from "./seed-exercise-catalog";

const prisma = new PrismaClient();

seedExerciseCatalog(prisma)
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
