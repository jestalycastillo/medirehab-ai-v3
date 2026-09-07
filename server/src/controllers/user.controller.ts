import { Request, Response } from "express";
import { Role } from "@prisma/client";
import {
    assignPatientToDoctor,
    changeOwnPassword,
    deleteDoctorUserPermanently,
    deletePatientUserPermanently,
    createDoctorUser,
    createPatientUser,
    getDoctorByUserId,
    getMyProfile,
    listPatientsForAdmin,
    getPatientForDoctor,
    listDoctors,
    listPatientsForDoctor,
    resetDoctorPassword,
    resetPatientPasswordForDoctor,
    resetPatientPassword,
    updateDoctorAccountStatus,
    updateDoctorProfile,
    updateOwnPatientProfile,
    updatePatientAccountStatusForDoctor,
    updatePatientProfileForDoctor,
    updatePatientAccountStatus,
    updatePatientProfile
} from "../services/user.service";
import { HttpError } from "../utils/httpError";
import {
    validateAccountStatusInput,
    validateAssignDoctorInput,
    validateChangePasswordInput,
    validateCreateDoctorInput,
    validateCreatePatientInput,
    validateResetPasswordInput,
    validateUpdateDoctorInput,
    validateUpdatePatientInput,
    validateUserIdParam
} from "../utils/userValidation";

const getAuthenticatedUser = (req: Request): { userId: string; role: string } => {
    if (!req.user) {
        throw new HttpError(401, "Unauthorized.");
    }

    return req.user;
};

const handleUserError = (
    error: unknown,
    res: Response,
    fallbackMessage: string
): void => {
    if (error instanceof HttpError) {
        res.status(error.statusCode).json({
            success: false,
            message: error.message
        });
        return;
    }

    res.status(500).json({
        success: false,
        message: fallbackMessage
    });
};

export const createDoctor = async (req: Request, res: Response): Promise<void> => {
    try {
        const input = validateCreateDoctorInput(req.body);
        const { doctor, temporaryPassword } = await createDoctorUser(input);

        res.status(201).json({
            success: true,
            message: "Doctor created successfully.",
            doctor,
            temporaryPassword
        });
    } catch (error) {
        handleUserError(error, res, "Unable to create doctor.");
    }
};

export const createPatient = async (req: Request, res: Response): Promise<void> => {
    try {
        const input = validateCreatePatientInput(req.body);
        const { patient, temporaryPassword } = await createPatientUser(input);

        res.status(201).json({
            success: true,
            message: "Patient created successfully.",
            patient,
            temporaryPassword
        });
    } catch (error) {
        handleUserError(error, res, "Unable to create patient.");
    }
};

export const meProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const authUser = getAuthenticatedUser(req);
        const user = await getMyProfile(authUser.userId);

        res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        handleUserError(error, res, "Unable to load profile.");
    }
};

export const getDoctors = async (_req: Request, res: Response): Promise<void> => {
    try {
        const doctors = await listDoctors();

        res.status(200).json({
            success: true,
            doctors
        });
    } catch (error) {
        handleUserError(error, res, "Unable to load doctors.");
    }
};

export const getPatients = async (req: Request, res: Response): Promise<void> => {
    try {
        const authUser = getAuthenticatedUser(req);
        const patients = await listPatientsForDoctor(authUser.userId);

        res.status(200).json({
            success: true,
            patients
        });
    } catch (error) {
        handleUserError(error, res, "Unable to load patients.");
    }
};

export const getAdminPatients = async (_req: Request, res: Response): Promise<void> => {
    try {
        const patients = await listPatientsForAdmin();

        res.status(200).json({
            success: true,
            patients
        });
    } catch (error) {
        handleUserError(error, res, "Unable to load patients.");
    }
};

export const getDoctor = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = validateUserIdParam(req.params.userId);
        const doctor = await getDoctorByUserId(userId);

        res.status(200).json({
            success: true,
            doctor
        });
    } catch (error) {
        handleUserError(error, res, "Unable to load doctor.");
    }
};

export const getPatient = async (req: Request, res: Response): Promise<void> => {
    try {
        const authUser = getAuthenticatedUser(req);
        const userId = validateUserIdParam(req.params.userId);
        const patient = await getPatientForDoctor(userId, authUser.userId);

        res.status(200).json({
            success: true,
            patient
        });
    } catch (error) {
        handleUserError(error, res, "Unable to load patient.");
    }
};

export const updateDoctor = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = validateUserIdParam(req.params.userId);
        const input = validateUpdateDoctorInput(req.body);
        const doctor = await updateDoctorProfile(userId, input);

        res.status(200).json({
            success: true,
            message: "Doctor updated successfully.",
            doctor
        });
    } catch (error) {
        handleUserError(error, res, "Unable to update doctor.");
    }
};

export const updatePatient = async (req: Request, res: Response): Promise<void> => {
    try {
        const authUser = getAuthenticatedUser(req);
        const userId = validateUserIdParam(req.params.userId);
        const input = validateUpdatePatientInput(req.body);

        const patient = authUser.role === Role.ADMIN
            ? await updatePatientProfile(userId, input)
            : await updatePatientProfileForDoctor(userId, authUser.userId, input);

        res.status(200).json({
            success: true,
            message: "Patient updated successfully.",
            patient
        });
    } catch (error) {
        handleUserError(error, res, "Unable to update patient.");
    }
};

export const updateMeProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const authUser = getAuthenticatedUser(req);

        if (authUser.role === Role.DOCTOR) {
            const input = validateUpdateDoctorInput(req.body);
            const user = await updateDoctorProfile(authUser.userId, input);

            res.status(200).json({
                success: true,
                message: "Profile updated successfully.",
                user
            });
            return;
        }

        if (authUser.role === Role.PATIENT) {
            const input = validateUpdatePatientInput(req.body);
            const user = await updateOwnPatientProfile(authUser.userId, input);

            res.status(200).json({
                success: true,
                message: "Profile updated successfully.",
                user
            });
            return;
        }

        throw new HttpError(400, "Admin profile updates are not supported.");
    } catch (error) {
        handleUserError(error, res, "Unable to update profile.");
    }
};

export const updateMyPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const authUser = getAuthenticatedUser(req);
        const input = validateChangePasswordInput(req.body);
        await changeOwnPassword(authUser.userId, input);

        res.status(200).json({
            success: true,
            message: "Password updated successfully."
        });
    } catch (error) {
        handleUserError(error, res, "Unable to update password.");
    }
};

export const resetDoctorAccountPassword = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const userId = validateUserIdParam(req.params.userId);
        const input = validateResetPasswordInput(req.body);
        await resetDoctorPassword(userId, input);

        res.status(200).json({
            success: true,
            message: "Doctor password reset successfully."
        });
    } catch (error) {
        handleUserError(error, res, "Unable to reset doctor password.");
    }
};

export const resetPatientAccountPassword = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const authUser = getAuthenticatedUser(req);
        const userId = validateUserIdParam(req.params.userId);
        const input = validateResetPasswordInput(req.body);

        if (authUser.role === Role.ADMIN) {
            await resetPatientPassword(userId, input);
        } else {
            await resetPatientPasswordForDoctor(userId, authUser.userId, input);
        }

        res.status(200).json({
            success: true,
            message: "Patient password reset successfully."
        });
    } catch (error) {
        handleUserError(error, res, "Unable to reset patient password.");
    }
};

export const updateDoctorStatus = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const userId = validateUserIdParam(req.params.userId);
        const input = validateAccountStatusInput(req.body);
        const doctor = await updateDoctorAccountStatus(userId, input);

        res.status(200).json({
            success: true,
            message: "Doctor status updated successfully.",
            doctor
        });
    } catch (error) {
        handleUserError(error, res, "Unable to update doctor status.");
    }
};

export const updatePatientStatus = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const authUser = getAuthenticatedUser(req);
        const userId = validateUserIdParam(req.params.userId);
        const input = validateAccountStatusInput(req.body);

        const patient = authUser.role === Role.ADMIN
            ? await updatePatientAccountStatus(userId, input)
            : await updatePatientAccountStatusForDoctor(userId, authUser.userId, input);

        res.status(200).json({
            success: true,
            message: "Patient status updated successfully.",
            patient
        });
    } catch (error) {
        handleUserError(error, res, "Unable to update patient status.");
    }
};

export const archiveDoctor = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = validateUserIdParam(req.params.userId);
        const doctor = await updateDoctorAccountStatus(userId, { isActive: false });

        res.status(200).json({
            success: true,
            message: "Doctor archived successfully.",
            doctor
        });
    } catch (error) {
        handleUserError(error, res, "Unable to archive doctor.");
    }
};

export const archivePatient = async (req: Request, res: Response): Promise<void> => {
    try {
        const authUser = getAuthenticatedUser(req);
        const userId = validateUserIdParam(req.params.userId);

        const patient = authUser.role === Role.ADMIN
            ? await updatePatientAccountStatus(userId, { isActive: false })
            : await updatePatientAccountStatusForDoctor(userId, authUser.userId, { isActive: false });

        res.status(200).json({
            success: true,
            message: "Patient archived successfully.",
            patient
        });
    } catch (error) {
        handleUserError(error, res, "Unable to archive patient.");
    }
};

export const deleteDoctorPermanently = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = validateUserIdParam(req.params.userId);
        await deleteDoctorUserPermanently(userId);

        res.status(200).json({
            success: true,
            message: "Doctor permanently deleted successfully."
        });
    } catch (error) {
        handleUserError(error, res, "Unable to permanently delete doctor.");
    }
};

export const deletePatientPermanently = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = validateUserIdParam(req.params.userId);
        await deletePatientUserPermanently(userId);

        res.status(200).json({
            success: true,
            message: "Patient permanently deleted successfully."
        });
    } catch (error) {
        handleUserError(error, res, "Unable to permanently delete patient.");
    }
};

export const assignDoctorToPatient = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const userId = validateUserIdParam(req.params.userId);
        const input = validateAssignDoctorInput(req.body);
        const patient = await assignPatientToDoctor(userId, input);

        res.status(200).json({
            success: true,
            message: "Patient assigned to doctor successfully.",
            patient
        });
    } catch (error) {
        handleUserError(error, res, "Unable to assign patient to doctor.");
    }
};
