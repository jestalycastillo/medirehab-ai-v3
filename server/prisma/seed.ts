import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../src/utils/password";

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = "admin@test.test";
const DEFAULT_ADMIN_PASSWORD = "Admin123!";
const SIDE_ARMS_RAISE = {
    name: "Side Arms Raise",
    description:
        "Stand upright with your arms at your sides. Keeping your elbows straight, raise both arms out to shoulder height, then lower them slowly and with control.",
    analysisModelKey: "side_arms_raise_v1",
    image: {
        imageName: "Side Arms Raise",
        filepath: "/exercises/arms_raise.jpg"
    }
};

const seedAdmin = async (): Promise<void> => {
    const email = process.env.SEED_ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD;
    const hashedPassword = await hashPassword(password);
    const passwordChangedAt = new Date();

    await prisma.user.upsert({
        where: { email },
        update: {
            password: hashedPassword,
            role: Role.ADMIN,
            isActive: true,
            archivedAt: null,
            mustChangePassword: false,
            passwordChangedAt
        },
        create: {
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

const seedExerciseCatalog = async (): Promise<void> => {
    const exercise = await prisma.exercise.upsert({
        where: { name: SIDE_ARMS_RAISE.name },
        update: {
            description: SIDE_ARMS_RAISE.description,
            analysisModelKey: SIDE_ARMS_RAISE.analysisModelKey,
            isActive: true,
            archivedAt: null,
            images: {
                deleteMany: {},
                create: SIDE_ARMS_RAISE.image
            }
        },
        create: {
            name: SIDE_ARMS_RAISE.name,
            description: SIDE_ARMS_RAISE.description,
            analysisModelKey: SIDE_ARMS_RAISE.analysisModelKey,
            images: {
                create: SIDE_ARMS_RAISE.image
            }
        },
        select: {
            name: true,
            analysisModelKey: true
        }
    });

    console.log(
        `Seeded exercise: ${exercise.name} (${exercise.analysisModelKey})`
    );
};

const main = async (): Promise<void> => {
    await seedAdmin();
    await seedExerciseCatalog();
};

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
