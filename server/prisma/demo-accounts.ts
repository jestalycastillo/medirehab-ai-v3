import { Role, type Prisma } from "@prisma/client";

export const DEMO_ACCOUNTS = [
    { email: "admin@example.com", role: Role.ADMIN, firstName: "Demo", lastName: "Admin" },
    { email: "doctor@example.com", role: Role.DOCTOR, firstName: "Alex", lastName: "Santos" },
    { email: "jamie.reyes@example.com", role: Role.DOCTOR, firstName: "Jamie", lastName: "Reyes" },
    { email: "morgan.cruz@example.com", role: Role.DOCTOR, firstName: "Morgan", lastName: "Cruz" },
    { email: "patient@example.com", role: Role.PATIENT, firstName: "Sam", lastName: "Garcia", doctorEmail: "doctor@example.com" },
    { email: "taylor.ramos@example.com", role: Role.PATIENT, firstName: "Taylor", lastName: "Ramos", doctorEmail: "doctor@example.com" },
    { email: "jordan.flores@example.com", role: Role.PATIENT, firstName: "Jordan", lastName: "Flores", doctorEmail: "jamie.reyes@example.com" },
    { email: "casey.torres@example.com", role: Role.PATIENT, firstName: "Casey", lastName: "Torres", doctorEmail: "jamie.reyes@example.com" },
    { email: "riley.rivera@example.com", role: Role.PATIENT, firstName: "Riley", lastName: "Rivera", doctorEmail: "morgan.cruz@example.com" },
    { email: "avery.mendoza@example.com", role: Role.PATIENT, firstName: "Avery", lastName: "Mendoza", doctorEmail: "morgan.cruz@example.com" },
] as const;

const SIMPLE_DEMO_LOGINS = new Set<string>([
    "admin@example.com",
    "doctor@example.com",
    "patient@example.com",
]);

export async function planDemoAccounts(database: Prisma.TransactionClient) {
    const exercises = await database.exercise.findMany({
        where: {
            isActive: true,
            archivedAt: null,
            analysisModelKey: { not: null },
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
    });

    if (!exercises.length) {
        throw new Error(
            "No active model-backed exercises exist. Review the exercise catalog separately; no accounts were changed.",
        );
    }

    const existing = await database.user.findMany({
        where: {
            email: { in: DEMO_ACCOUNTS.map((account) => account.email) },
        },
        include: { doctorProfile: true, patientProfile: true },
    });

    const accounts = DEMO_ACCOUNTS.map((account) => {
        const user = existing.find((item) => item.email === account.email);

        if (user && user.role !== account.role) {
            throw new Error(
                `Role conflict for ${account.email}; no accounts were changed.`,
            );
        }

        if (
            user &&
            account.role === Role.DOCTOR &&
            (!user.doctorProfile || !user.isActive || user.archivedAt)
        ) {
            throw new Error(
                `Existing doctor ${account.email} is inactive or missing a profile; review it manually.`,
            );
        }

        return {
            ...account,
            action: user ? ("preserve" as const) : ("create" as const),
        };
    });

    return { accounts, exercises, existing };
}

// Caller supplies a transaction. Existing accounts, assignments, exercises,
// passwords, consent and patient history are never updated or deleted.
export async function createDemoAccounts(
    database: Prisma.TransactionClient,
    passwordHash: string,
) {
    const plan = await planDemoAccounts(database);

    const doctorIds = new Map(
        plan.existing.flatMap((user) =>
            user.doctorProfile
                ? [[user.email, user.doctorProfile.id] as const]
                : [],
        ),
    );

    let createdAccounts = 0;
    let createdAssignments = 0;

    for (const account of plan.accounts) {
        if (account.action === "preserve") continue;

        const assignedDoctorId =
            "doctorEmail" in account
                ? doctorIds.get(account.doctorEmail)
                : undefined;

        if (account.role === Role.PATIENT && !assignedDoctorId) {
            throw new Error(`Missing doctor for ${account.email}.`);
        }

        const user = await database.user.create({
            data: {
                email: account.email,
                password: passwordHash,
                role: account.role,
                isActive: true,
                mustChangePassword: !SIMPLE_DEMO_LOGINS.has(account.email),
                ...(account.role === Role.DOCTOR
                    ? {
                          doctorProfile: {
                              create: {
                                  firstName: account.firstName,
                                  lastName: account.lastName,
                                  specialization: "Physiotherapy",
                              },
                          },
                      }
                    : {}),
                ...(account.role === Role.PATIENT
                    ? {
                          patientProfile: {
                              create: {
                                  firstName: account.firstName,
                                  lastName: account.lastName,
                                  assignedDoctor: {
                                      connect: { id: assignedDoctorId! },
                                  },
                              },
                          },
                      }
                    : {}),
            },
            include: { doctorProfile: true, patientProfile: true },
        });

        createdAccounts++;

        if (user.doctorProfile) {
            doctorIds.set(account.email, user.doctorProfile.id);
        }

        if (user.patientProfile && assignedDoctorId) {
            const result = await database.exerciseAssignment.createMany({
                data: plan.exercises.map((exercise) => ({
                    exerciseId: exercise.id,
                    patientProfileId: user.patientProfile!.id,
                    assignedByDoctorId: assignedDoctorId,
                    targetSessionsPerWeek: 3,
                    targetDurationSeconds: 20,
                    doctorInstructions:
                        "Demo assignment. Follow your clinician’s prescribed movement and limits.",
                })),
            });

            createdAssignments += result.count;
        }
    }

    return {
        createdAccounts,
        createdAssignments,
        preservedAccounts: plan.accounts.length - createdAccounts,
    };
}
