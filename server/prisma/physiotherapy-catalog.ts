import type { PrismaClient } from "@prisma/client";

export const PHYSIOTHERAPY_CATALOG = [
    { name: "Arm Circumduction", analysisModelKey: "arm_circumduction", description: "Select the exercising arm. Perform the circular arm movement prescribed by your clinician, keeping both shoulders, elbows, and wrists in view." },
    { name: "Cross-body Shoulder Stretch", analysisModelKey: "cross_body_shoulder_stretch", description: "Select the stretching arm. Follow your clinician’s prescribed cross-body stretch and hold duration, keeping the stretching and supporting arms visible." },
    { name: "External Rotation", analysisModelKey: "external_rotation", description: "Follow your clinician’s prescribed outward forearm rotation and arm position. Keep both shoulders, elbows, and wrists visible throughout the recording." },
    { name: "Internal Rotation", analysisModelKey: "internal_rotation", description: "Follow your clinician’s prescribed inward forearm rotation and arm position. Keep both shoulders, elbows, and wrists visible throughout the recording." },
] as const;

export async function planPhysiotherapyCatalog(prisma: PrismaClient) {
    const existing = await prisma.exercise.findMany({
        where: { OR: [
            { name: { in: PHYSIOTHERAPY_CATALOG.map((item) => item.name) } },
            { analysisModelKey: { in: PHYSIOTHERAPY_CATALOG.map((item) => item.analysisModelKey) } },
        ] },
        select: { name: true, analysisModelKey: true, isActive: true, archivedAt: true },
    });
    return PHYSIOTHERAPY_CATALOG.map((item) => {
        const match = existing.find((row) => row.name === item.name || row.analysisModelKey === item.analysisModelKey);
        if (match && (match.name !== item.name || match.analysisModelKey !== item.analysisModelKey || !match.isActive || match.archivedAt)) {
            throw new Error(`Catalog conflict for ${item.name}; no existing records will be changed.`);
        }
        return { action: match ? "keep" as const : "create" as const, ...item };
    });
}
