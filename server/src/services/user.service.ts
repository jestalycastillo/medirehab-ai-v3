import { Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../utils/httpError";
import { comparePassword, hashPassword } from "../utils/password";
import { generateTemporaryPassword } from "../utils/temporaryPassword";
import {
    ValidatedAccountStatusInput,
    ValidatedAssignDoctorInput,
    ValidatedChangePasswordInput,
    ValidatedCreateDoctorInput,
    ValidatedCreatePatientInput,
    ValidatedResetPasswordInput,
    ValidatedUpdateDoctorInput,
    ValidatedUpdatePatientInput
} from "../utils/userValidation";

const baseUserSelect = {
    id: true,
    email: true,
    role: true,
    isActive: true,
    archivedAt: true,
    mustChangePassword: true,
    passwordChangedAt: true,
    lastLoginAt: true,
    lastSeenAt: true,
    createdAt: true,
    updatedAt: true
} satisfies Prisma.UserSelect;

const doctorUserSelect = {
    ...baseUserSelect,
    doctorProfile: true
} satisfies Prisma.UserSelect;

const patientUserSelect = {
    ...baseUserSelect,
    patientProfile: true
} satisfies Prisma.UserSelect;

const adminPatientUserSelect = {
    ...baseUserSelect,
    patientProfile: {
        include: {
            assignedDoctor: {
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            isActive: true,
                            archivedAt: true
                        }
                    }
                }
            }
        }
    }
} satisfies Prisma.UserSelect;

const ensureEmailAvailable = async (email: string): Promise<void> => {
    const existingUser = await prisma.user.findUnique({
        where: { email }
    });

    if (existingUser) {
        throw new HttpError(409, "Email is already in use.");
    }
};

const parseBirthDate = (birthDate?: string): Date | null => {
    if (!birthDate) {
        return null;
    }

    const parsedDate = new Date(birthDate);

    if (Number.isNaN(parsedDate.getTime())) {
        throw new HttpError(400, "Birth date is invalid.");
    }

    return parsedDate;
};

const getDoctorProfileIdForUser = async (doctorUserId: string): Promise<string> => {
    const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId: doctorUserId },
        select: { id: true }
    });

    if (!doctorProfile) {
        throw new HttpError(403, "Only doctors with a profile can access patients.");
    }

    return doctorProfile.id;
};

const ensureAssignedPatientForDoctor = async (
    patientUserId: string,
    doctorUserId: string
): Promise<void> => {
    const doctorProfileId = await getDoctorProfileIdForUser(doctorUserId);

    const patient = await prisma.user.findFirst({
        where: {
            id: patientUserId,
            role: Role.PATIENT,
            patientProfile: {
                assignedDoctorId: doctorProfileId
            }
        },
        select: { id: true }
    });

    if (!patient) {
        throw new HttpError(404, "Patient not found.");
    }
};

const ensureRoleUser = async (
    userId: string,
    role: Role,
    notFoundMessage: string
): Promise<void> => {
    const user = await prisma.user.findFirst({
        where: { id: userId, role },
        select: { id: true }
    });

    if (!user) {
        throw new HttpError(404, notFoundMessage);
    }
};

const ensureArchivedRoleUser = async (
    userId: string,
    role: Role
): Promise<void> => {
    const user = await prisma.user.findFirst({
        where: { id: userId, role, archivedAt: { not: null } },
        select: { id: true }
    });

    if (!user) {
        throw new HttpError(409, `User must be archived before it can be deleted permanently.`);
    }
};

const getArchivedAtForStatus = (isActive: boolean): Date | null => {
    return isActive ? null : new Date();
};

const updateUserPassword = async (
    userId: string,
    password: string
): Promise<void> => {
    const hashedPassword = await hashPassword(password);

    await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
    });
};

const completePasswordChange = async (
    userId: string,
    password: string
): Promise<void> => {
    const hashedPassword = await hashPassword(password);

    await prisma.user.update({
        where: { id: userId },
        data: {
            password: hashedPassword,
            mustChangePassword: false,
            passwordChangedAt: new Date()
        }
    });
};

const buildDoctorProfileUpdateData = (
    input: ValidatedUpdateDoctorInput
): Prisma.DoctorProfileUpdateInput => {
    const data: Prisma.DoctorProfileUpdateInput = {};

    if (input.firstName !== undefined) data.firstName = input.firstName;
    if (input.lastName !== undefined) data.lastName = input.lastName;
    if (input.specialization !== undefined) data.specialization = input.specialization;
    if (input.licenseNumber !== undefined) data.licenseNumber = input.licenseNumber;
    if (input.contactNumber !== undefined) data.contactNumber = input.contactNumber;
    if (input.clinicSchedule !== undefined) data.clinicSchedule = input.clinicSchedule;

    return data;
};

const buildPatientProfileUpdateData = (
    input: ValidatedUpdatePatientInput
): Prisma.PatientProfileUpdateInput => {
    const data: Prisma.PatientProfileUpdateInput = {};

    if (input.firstName !== undefined) data.firstName = input.firstName;
    if (input.lastName !== undefined) data.lastName = input.lastName;
    if (input.birthDate !== undefined) data.birthDate = parseBirthDate(input.birthDate);
    if (input.gender !== undefined) data.gender = input.gender;
    if (input.contactNumber !== undefined) data.contactNumber = input.contactNumber;
    if (input.address !== undefined) data.address = input.address;
    if (input.medicalCondition !== undefined) data.medicalCondition = input.medicalCondition;

    return data;
};

export const createDoctorUser = async (input: ValidatedCreateDoctorInput) => {
    await ensureEmailAvailable(input.email);

    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await hashPassword(temporaryPassword);

    const doctor = await prisma.user.create({
        data: {
            email: input.email,
            password: hashedPassword,
            role: Role.DOCTOR,
            mustChangePassword: true,
            doctorProfile: {
                create: {
                    firstName: input.firstName ?? null,
                    lastName: input.lastName ?? null,
                    specialization: input.specialization ?? null,
                    licenseNumber: input.licenseNumber ?? null,
                    contactNumber: input.contactNumber ?? null,
                    clinicSchedule: input.clinicSchedule ?? null
                }
            }
        },
        select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            archivedAt: true,
            mustChangePassword: true,
            passwordChangedAt: true,
            doctorProfile: true
        }
    });

    return {
        doctor,
        temporaryPassword
    };
};

export const createPatientUser = async (
    input: ValidatedCreatePatientInput
) => {
    await ensureEmailAvailable(input.email);

    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await hashPassword(temporaryPassword);

    const patient = await prisma.user.create({
        data: {
            email: input.email,
            password: hashedPassword,
            role: Role.PATIENT,
            mustChangePassword: true,
            patientProfile: {
                create: {
                    firstName: input.firstName ?? null,
                    lastName: input.lastName ?? null,
                    birthDate: parseBirthDate(input.birthDate),
                    gender: input.gender ?? null,
                    contactNumber: input.contactNumber ?? null,
                    address: input.address ?? null,
                    medicalCondition: input.medicalCondition ?? null,
                    assignedDoctorId: null
                }
            }
        },
        select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            archivedAt: true,
            mustChangePassword: true,
            passwordChangedAt: true,
            patientProfile: true
        }
    });

    return {
        patient,
        temporaryPassword
    };
};

export const getMyProfile = async (userId: string) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            archivedAt: true,
            mustChangePassword: true,
            passwordChangedAt: true,
            patientProfile: true,
            doctorProfile: true
        }
    });

    if (!user) {
        throw new HttpError(404, "User not found.");
    }

    if (user.role === Role.PATIENT) {
        return {
            id: user.id,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            archivedAt: user.archivedAt,
            mustChangePassword: user.mustChangePassword,
            passwordChangedAt: user.passwordChangedAt,
            profile: user.patientProfile
        };
    }

    if (user.role === Role.DOCTOR) {
        return {
            id: user.id,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            archivedAt: user.archivedAt,
            mustChangePassword: user.mustChangePassword,
            passwordChangedAt: user.passwordChangedAt,
            profile: user.doctorProfile
        };
    }

    return {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        archivedAt: user.archivedAt,
        mustChangePassword: user.mustChangePassword,
        passwordChangedAt: user.passwordChangedAt,
        profile: null
    };
};

export const getUserConsent = async (userId: string) => prisma.user.findUnique({
    where: { id: userId },
    select: { privacyConsentAt: true, recordingConsentAt: true }
});

export const updateUserConsent = async (userId: string, privacyConsent: boolean, recordingConsent: boolean) => {
    if (recordingConsent && !privacyConsent) {
        throw new HttpError(400, "Privacy consent is required before recording consent.");
    }
    const now = new Date();
    return prisma.user.update({
        where: { id: userId },
        data: {
            privacyConsentAt: privacyConsent ? now : null,
            recordingConsentAt: privacyConsent && recordingConsent ? now : null
        },
        select: { privacyConsentAt: true, recordingConsentAt: true }
    });
};

export const listDoctors = async () => {
    return prisma.user.findMany({
        where: { role: Role.DOCTOR },
        select: {
            ...doctorUserSelect
        },
        orderBy: { createdAt: "desc" }
    });
};

export const listPatientsForDoctor = async (doctorUserId: string) => {
    const doctorProfileId = await getDoctorProfileIdForUser(doctorUserId);

    return prisma.user.findMany({
        where: {
            role: Role.PATIENT,
            patientProfile: {
                assignedDoctorId: doctorProfileId
            }
        },
        select: {
            ...patientUserSelect
        },
        orderBy: { createdAt: "desc" }
    });
};

export const listPatientsForAdmin = async () => {
    return prisma.user.findMany({
        where: { role: Role.PATIENT },
        select: {
            ...adminPatientUserSelect
        },
        orderBy: { createdAt: "desc" }
    });
};

export const getDoctorByUserId = async (doctorUserId: string) => {
    const doctor = await prisma.user.findFirst({
        where: {
            id: doctorUserId,
            role: Role.DOCTOR
        },
        select: {
            ...doctorUserSelect
        }
    });

    if (!doctor) {
        throw new HttpError(404, "Doctor not found.");
    }

    return doctor;
};

export const getPatientForDoctor = async (
    patientUserId: string,
    doctorUserId: string
) => {
    const doctorProfileId = await getDoctorProfileIdForUser(doctorUserId);

    const patient = await prisma.user.findFirst({
        where: {
            id: patientUserId,
            role: Role.PATIENT,
            patientProfile: {
                assignedDoctorId: doctorProfileId
            }
        },
        select: {
            ...patientUserSelect
        }
    });

    if (!patient) {
        throw new HttpError(404, "Patient not found.");
    }

    return patient;
};

export const updateDoctorProfile = async (
    doctorUserId: string,
    input: ValidatedUpdateDoctorInput
) => {
    const doctor = await prisma.user.findFirst({
        where: {
            id: doctorUserId,
            role: Role.DOCTOR
        },
        select: { id: true }
    });

    if (!doctor) {
        throw new HttpError(404, "Doctor not found.");
    }

    await prisma.doctorProfile.update({
        where: { userId: doctorUserId },
        data: buildDoctorProfileUpdateData(input)
    });

    return prisma.user.findUnique({
        where: { id: doctorUserId },
        select: {
            ...doctorUserSelect
        }
    });
};

export const updateOwnPatientProfile = async (
    patientUserId: string,
    input: ValidatedUpdatePatientInput
) => {
    await ensureRoleUser(patientUserId, Role.PATIENT, "Patient not found.");

    await prisma.patientProfile.update({
        where: { userId: patientUserId },
        data: buildPatientProfileUpdateData(input)
    });

    return prisma.user.findUnique({
        where: { id: patientUserId },
        select: {
            ...patientUserSelect
        }
    });
};

export const updatePatientProfileForDoctor = async (
    patientUserId: string,
    doctorUserId: string,
    input: ValidatedUpdatePatientInput
) => {
    await ensureAssignedPatientForDoctor(patientUserId, doctorUserId);

    await prisma.patientProfile.update({
        where: { userId: patientUserId },
        data: buildPatientProfileUpdateData(input)
    });

    return prisma.user.findUnique({
        where: { id: patientUserId },
        select: {
            ...patientUserSelect
        }
    });
};

export const changeOwnPassword = async (
    userId: string,
    input: ValidatedChangePasswordInput
) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            password: true
        }
    });

    if (!user) {
        throw new HttpError(404, "User not found.");
    }

    const isPasswordValid = await comparePassword(
        input.currentPassword,
        user.password
    );

    if (!isPasswordValid) {
        throw new HttpError(401, "Current password is incorrect.");
    }

    if (input.currentPassword === input.newPassword) {
        throw new HttpError(
            400,
            "New password must be different from your current password."
        );
    }

    await completePasswordChange(user.id, input.newPassword);
};

export const resetDoctorPassword = async (
    doctorUserId: string,
    input: ValidatedResetPasswordInput
) => {
    await ensureRoleUser(doctorUserId, Role.DOCTOR, "Doctor not found.");
    await updateUserPassword(doctorUserId, input.password);
};

export const resetPatientPasswordForDoctor = async (
    patientUserId: string,
    doctorUserId: string,
    input: ValidatedResetPasswordInput
) => {
    await ensureAssignedPatientForDoctor(patientUserId, doctorUserId);
    await updateUserPassword(patientUserId, input.password);
};

export const updateDoctorAccountStatus = async (
    doctorUserId: string,
    input: ValidatedAccountStatusInput
) => {
    await ensureRoleUser(doctorUserId, Role.DOCTOR, "Doctor not found.");

    return prisma.user.update({
        where: { id: doctorUserId },
        data: {
            isActive: input.isActive,
            archivedAt: getArchivedAtForStatus(input.isActive)
        },
        select: {
            ...doctorUserSelect
        }
    });
};

export const updatePatientAccountStatusForDoctor = async (
    patientUserId: string,
    doctorUserId: string,
    input: ValidatedAccountStatusInput
) => {
    await ensureAssignedPatientForDoctor(patientUserId, doctorUserId);

    return prisma.user.update({
        where: { id: patientUserId },
        data: {
            isActive: input.isActive,
            archivedAt: getArchivedAtForStatus(input.isActive)
        },
        select: {
            ...patientUserSelect
        }
    });
};

export const assignPatientToDoctor = async (
    patientUserId: string,
    input: ValidatedAssignDoctorInput
) => {
    await ensureRoleUser(patientUserId, Role.PATIENT, "Patient not found.");

    const doctor = await prisma.user.findFirst({
        where: {
            id: input.doctorUserId,
            role: Role.DOCTOR,
            isActive: true,
            archivedAt: null
        },
        select: {
            doctorProfile: {
                select: { id: true }
            }
        }
    });

    if (!doctor?.doctorProfile) {
        throw new HttpError(404, "Active doctor not found.");
    }

    await prisma.patientProfile.update({
        where: { userId: patientUserId },
        data: {
            assignedDoctorId: doctor.doctorProfile.id
        }
    });

    return prisma.user.findUnique({
        where: { id: patientUserId },
        select: {
            ...patientUserSelect
        }
    });
};

export const resetPatientPassword = async (
    patientUserId: string,
    input: ValidatedResetPasswordInput
) => {
    await ensureRoleUser(patientUserId, Role.PATIENT, "Patient not found.");
    await updateUserPassword(patientUserId, input.password);
};

export const updatePatientAccountStatus = async (
    patientUserId: string,
    input: ValidatedAccountStatusInput
) => {
    await ensureRoleUser(patientUserId, Role.PATIENT, "Patient not found.");

    return prisma.user.update({
        where: { id: patientUserId },
        data: {
            isActive: input.isActive,
            archivedAt: getArchivedAtForStatus(input.isActive)
        },
        select: {
            ...patientUserSelect
        }
    });
};

export const updatePatientProfile = async (
    patientUserId: string,
    input: ValidatedUpdatePatientInput
) => {
    await ensureRoleUser(patientUserId, Role.PATIENT, "Patient not found.");

    await prisma.patientProfile.update({
        where: { userId: patientUserId },
        data: buildPatientProfileUpdateData(input)
    });

    return prisma.user.findUnique({
        where: { id: patientUserId },
        select: {
            ...patientUserSelect
        }
    });
};

export const deleteDoctorUserPermanently = async (doctorUserId: string) => {
    const doctor = await prisma.user.findFirst({
        where: {
            id: doctorUserId,
            role: Role.DOCTOR,
            archivedAt: { not: null }
        },
        select: {
            id: true,
            doctorProfile: {
                select: { id: true }
            }
        }
    });

    if (!doctor) {
        throw new HttpError(409, "Doctor must be archived before it can be deleted permanently.");
    }

    const doctorProfile = doctor.doctorProfile;

    if (!doctorProfile) {
        await prisma.user.delete({
            where: { id: doctorUserId }
        });
        return;
    }

    await prisma.$transaction(async (tx) => {
        await tx.patientProfile.updateMany({
            where: { assignedDoctorId: doctorProfile.id },
            data: { assignedDoctorId: null }
        });

        await tx.exerciseAssignment.deleteMany({
            where: { assignedByDoctorId: doctorProfile.id }
        });

        await tx.user.delete({
            where: { id: doctorUserId }
        });
    });
};

export const deletePatientUserPermanently = async (patientUserId: string) => {
    await ensureArchivedRoleUser(
        patientUserId,
        Role.PATIENT
    );

    await prisma.user.delete({
        where: { id: patientUserId }
    });
};
