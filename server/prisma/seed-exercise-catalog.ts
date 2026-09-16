import type { PrismaClient } from "@prisma/client";

const CATALOG = [
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

        // Replace catalog's old default images; preserve clinician-supplied images.
        const oldDefaultPaths = item.analysisModelKey === "shoulder_flexion"
            ? ["/exercises/shoulder_flexion.svg", "/exercises/left_flexion.jpg", "/exercises/right_flexion.jpg"]
            : item.analysisModelKey === "shoulder_abduction"
                ? ["/exercises/arms_raise.jpg"]
                : [];
        if (oldDefaultPaths.length > 0) {
            await prisma.exerciseImage.updateMany({
                where: {
                    exerciseId: existing.id,
                    filepath: { in: oldDefaultPaths }
                },
                data: {
                    imageName: item.image.imageName,
                    filepath: item.image.filepath
                }
            });
        }
        console.log(`Exercise ready: ${item.name} (${item.analysisModelKey})`);
    }
}
