import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../src/utils/password";
import { seedExerciseCatalog } from "./seed-exercise-catalog";

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = "admin@test.test";
const DEFAULT_ADMIN_PASSWORD = "Admin123!";
const seedAdmin = async (): Promise<void> => {
    const email = process.env.SEED_ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL;
    const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } });
    if (existing) {
        if (existing.role !== Role.ADMIN) {
            throw new Error(`Seed admin email ${email} belongs to a non-admin account.`);
        }
        console.log(`Admin account already exists: ${email}`);
        return;
    }
    const password = process.env.SEED_ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD;
    const hashedPassword = await hashPassword(password);
    const passwordChangedAt = new Date();

    await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            role: Role.ADMIN,
            isActive: true,
            mustChangePassword: false,
            passwordChangedAt
        }
    });

    console.log(`Seeded admin account: ${email}`);

    if (!process.env.SEED_ADMIN_PASSWORD) {
        console.log(`Default admin password: ${DEFAULT_ADMIN_PASSWORD}`);
    }
};

const main = async (): Promise<void> => {
    await seedAdmin();
    await seedExerciseCatalog(prisma);
};

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
