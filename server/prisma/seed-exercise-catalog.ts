import type { PrismaClient } from "@prisma/client";

const CATALOG = [
    {
        name: "Side Arms Raise",
        description: "Stand upright with your arms at your sides. Keeping your elbows straight, raise both arms out to shoulder height, then lower them slowly and with control.",
        analysisModelKey: "side_arms_raise_v1",
        image: { imageName: "Side Arms Raise", filepath: "/exercises/arms_raise.jpg" }
    },
    {
        name: "Shoulder Flexion",
        description: "Stand upright with your arms at your sides. Select your target arm (left or right). Keeping your elbow straight, raise your arm forward and upward to shoulder height, then lower it slowly with control.",
        analysisModelKey: "shoulder_flexion",
        image: { imageName: "Shoulder Flexion illustration", filepath: "/exercises/shoulder_flexion.png" }
    },
    {
        name: "Shoulder Abduction",
        description: "Stand upright with your arms at your sides. Select your target arm (left or right). Keeping your elbow straight, raise your arm outward to the side up to shoulder height, then lower it slowly with control.",
        analysisModelKey: "shoulder_abduction",
        image: { imageName: "Shoulder Abduction", filepath: "/exercises/shoulder_abduction.png" }
    }
] as const;

export async function seedExerciseCatalog(prisma: PrismaClient): Promise<void> {
    const canonicalSideArms = await prisma.exercise.findUnique({ where: { name: "Side Arms Raise" } });
    if (!canonicalSideArms) {
        const legacy = await prisma.exercise.findUnique({ where: { name: "Arms Raise" } });
        if (legacy && (!legacy.analysisModelKey || legacy.analysisModelKey === "side_arms_raise_v1")) {
            await prisma.exercise.update({
                where: { id: legacy.id },
                data: { name: "Side Arms Raise", analysisModelKey: "side_arms_raise_v1" }
            });
        }
    }

    for (const item of CATALOG) {
        const existing = await prisma.exercise.findUnique({
            where: { name: item.name },
            include: { images: { select: { id: true }, take: 1 } }
        });

        if (!existing) {
            await prisma.exercise.create({
                data: {
                    name: item.name,
                    description: item.description,
                    analysisModelKey: item.analysisModelKey,
                    images: { create: item.image }
                }
            });
            console.log(`Added exercise: ${item.name} (${item.analysisModelKey})`);
            continue;
        }

        if (existing.analysisModelKey && existing.analysisModelKey !== item.analysisModelKey) {
            throw new Error(`${item.name} is linked to ${existing.analysisModelKey}; expected ${item.analysisModelKey}. Resolve the model mapping before startup.`);
        }

        if (!existing.analysisModelKey || existing.images.length === 0) {
            await prisma.exercise.update({
                where: { id: existing.id },
                data: {
                    ...(!existing.analysisModelKey ? { analysisModelKey: item.analysisModelKey } : {}),
                    ...(existing.images.length === 0 ? { images: { create: item.image } } : {})
                }
            });
        }

        // Replace only the catalog's old default images; preserve clinician-supplied images.
        const oldDefaultPath = item.analysisModelKey === "shoulder_flexion"
            ? "/exercises/shoulder_flexion.svg"
            : item.analysisModelKey === "shoulder_abduction"
                ? "/exercises/arms_raise.jpg"
                : null;
        if (oldDefaultPath) {
            await prisma.exerciseImage.updateMany({
                where: {
                    exerciseId: existing.id,
                    imageName: item.image.imageName,
                    filepath: oldDefaultPath
                },
                data: { filepath: item.image.filepath }
            });
        }
        console.log(`Exercise ready: ${item.name} (${item.analysisModelKey})`);
    }
}
