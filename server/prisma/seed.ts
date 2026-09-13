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

const SHOULDER_FLEXION = {
    name: "Shoulder Flexion",
    description:
        "Stand upright with your arms at your sides. Select your target arm (left or right). Keeping your elbow straight, raise your arm forward and upward to shoulder height, then lower it slowly with control.",
    analysisModelKey: "shoulder_flexion",
    image: {
        imageName: "Shoulder Flexion",
        filepath: "/exercises/left_flexion.jpg"
    }
};

const SHOULDER_ABDUCTION = {
    name: "Shoulder Abduction",
    description:
        "Stand upright with your arms at your sides. Select your target arm (left or right). Keeping your elbow straight, raise your arm outward to the side up to shoulder height, then lower it slowly with control.",
    analysisModelKey: "shoulder_abduction",
    image: {
        imageName: "Shoulder Abduction",
        filepath: "/exercises/arms_raise.jpg"
    }
};

const SEED_EXERCISES = [SIDE_ARMS_RAISE, SHOULDER_FLEXION, SHOULDER_ABDUCTION];

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
    const legacyExercise = await prisma.exercise.findFirst({
        where: { name: "Arms Raise" }
    });

    if (legacyExercise) {
        await prisma.exercise.update({
            where: { id: legacyExercise.id },
            data: { name: SIDE_ARMS_RAISE.name }
        });
    }

    // Clean up obsolete separate left/right flexion exercises if present
    const obsoleteExercises = await prisma.exercise.findMany({
        where: {
            name: { in: ["Left Shoulder Flexion", "Right Shoulder Flexion"] }
        },
        include: { assignments: true }
    });
    for (const obs of obsoleteExercises) {
        if (obs.assignments.length === 0) {
            await prisma.exerciseImage.deleteMany({ where: { exerciseId: obs.id } });
            await prisma.exercise.delete({ where: { id: obs.id } });
            console.log(`Cleaned up obsolete separate exercise: ${obs.name}`);
        } else {
            await prisma.exercise.update({
                where: { id: obs.id },
                data: { isActive: false, archivedAt: new Date() }
            });
            console.log(`Archived obsolete separate exercise: ${obs.name}`);
        }
    }

    for (const item of SEED_EXERCISES) {
        const exercise = await prisma.exercise.upsert({
            where: { name: item.name },
            update: {
                description: item.description,
                analysisModelKey: item.analysisModelKey,
                isActive: true,
                archivedAt: null,
                images: {
                    deleteMany: {},
                    create: item.image
                }
            },
            create: {
                name: item.name,
                description: item.description,
                analysisModelKey: item.analysisModelKey,
                images: {
                    create: item.image
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
    }
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
