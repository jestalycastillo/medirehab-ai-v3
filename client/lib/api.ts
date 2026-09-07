const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  [key: string]: T | boolean | string | undefined;
}

export interface ApiUser {
  id: string;
  email: string;
  role: "ADMIN" | "DOCTOR" | "PATIENT";
  isActive: boolean;
  archivedAt: string | null;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
}

export interface DoctorProfile {
  firstName: string;
  lastName: string;
  specialization: string;
  licenseNumber: string;
  contactNumber: string;
  clinicSchedule: string;
}

export interface PatientProfile {
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: string;
  contactNumber: string;
  address: string;
  medicalCondition: string;
  assignedDoctorId?: string | null;
  assignedDoctor?: (DoctorProfile & {
    user?: Pick<ApiUser, "id" | "email" | "isActive" | "archivedAt">;
  }) | null;
}

export interface ApiDoctor extends ApiUser {
  profile?: DoctorProfile;
  doctorProfile?: DoctorProfile;
}

export interface ApiPatient extends ApiUser {
  profile?: PatientProfile;
  patientProfile?: PatientProfile;
}

export interface ExerciseImage {
  imageName: string;
  filepath: string;
}

export interface ApiExercise {
  id: string;
  name: string;
  description: string;
  archivedAt: string | null;
  images: ExerciseImage[];
}

export interface ExerciseResult {
  id: string;
  score: number;
}

export interface SessionAuthor {
  id: string;
  email: string;
  role: "ADMIN" | "DOCTOR" | "PATIENT";
  displayName: string;
}

export interface SessionComment {
  id: string;
  body: string;
  isVisibleToPatient: boolean;
  createdAt: string;
  updatedAt: string;
  author: SessionAuthor;
}

export interface CareSession {
  id: string;
  score: number | null;
  aiFeedback: string[];
  painLevel: number | null;
  difficultyLevel: number | null;
  confidenceLevel: number | null;
  patientNote: string | null;
  performedAt: string;
  createdAt: string;
  updatedAt: string;
  assignment: {
    id: string;
    assignedAt: string;
    archivedAt: string | null;
    exercise: ApiExercise;
    result?: ExerciseResult;
  };
  comments: SessionComment[];
}

export interface CareNotification {
  id: string;
  type: "SESSION_RESULT" | "SESSION_CHECKIN" | "DOCTOR_COMMENT" | "REMINDER";
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseAssignment {
  id: string;
  assignedAt: string;
  archivedAt: string | null;
  exercise: ApiExercise;
  result?: ExerciseResult;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  mustChangePassword: boolean;
  user: ApiUser;
}

export interface MeResponse {
  success: boolean;
  user: ApiUser & { profile?: DoctorProfile | PatientProfile };
}

export class ApiError extends Error {
  status: number;
  data: { success: boolean; message: string };

  constructor(status: number, data: { success: boolean; message: string }) {
    super(data.message || "An unexpected error occurred.");
    this.status = status;
    this.data = data;
    this.name = "ApiError";
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new ApiError(res.status, data);
  }

  return data as T;
}

function normalizeDoctor(doctor: ApiDoctor): ApiDoctor {
  return {
    ...doctor,
    profile: doctor.profile ?? doctor.doctorProfile,
  };
}

function normalizePatient(patient: ApiPatient): ApiPatient {
  return {
    ...patient,
    profile: patient.profile ?? patient.patientProfile,
  };
}

export const api = {
  // --- Auth & Session ---
  login(email: string, password: string) {
    return request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  logout() {
    return request<ApiResponse>("/auth/logout", {
      method: "POST",
    });
  },

  me() {
    return request<MeResponse>("/auth/me");
  },

  changePassword(currentPassword: string, newPassword: string) {
    return request<ApiResponse>("/users/me/password", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  // --- Admin: Doctors ---
  getDoctors() {
    return request<{ success: boolean; doctors: ApiDoctor[] }>("/users/doctors").then((res) => ({
      ...res,
      doctors: res.doctors.map(normalizeDoctor),
    }));
  },

  getDoctor(userId: string) {
    return request<{ success: boolean; doctor: ApiDoctor }>(`/users/doctors/${userId}`).then((res) => ({
      ...res,
      doctor: normalizeDoctor(res.doctor),
    }));
  },

  createDoctor(data: Partial<ApiDoctor & DoctorProfile>) {
    return request<{ success: boolean; doctor: ApiDoctor; temporaryPassword?: string }>("/users/doctors", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((res) => ({ ...res, doctor: normalizeDoctor(res.doctor) }));
  },

  updateDoctor(userId: string, data: Partial<DoctorProfile>) {
    return request<{ success: boolean; doctor: ApiDoctor }>(`/users/doctors/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }).then((res) => ({ ...res, doctor: normalizeDoctor(res.doctor) }));
  },

  updateDoctorStatus(userId: string, isActive: boolean) {
    return request<{ success: boolean; doctor: ApiDoctor }>(`/users/doctors/${userId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    }).then((res) => ({ ...res, doctor: normalizeDoctor(res.doctor) }));
  },

  resetDoctorPassword(userId: string, newPassword: string) {
    return request<ApiResponse>(`/users/doctors/${userId}/password`, {
      method: "PATCH",
      body: JSON.stringify({ newPassword }),
    });
  },

  deleteDoctor(userId: string) {
    return request<ApiResponse>(`/users/doctors/${userId}`, {
      method: "DELETE",
    });
  },

  permanentlyDeleteDoctor(userId: string) {
    return request<ApiResponse>(`/users/doctors/${userId}/trash`, {
      method: "DELETE",
    });
  },

  // --- Admin: Patients ---
  getAdminPatients() {
    return request<{ success: boolean; patients: ApiPatient[] }>("/users/admin/patients").then((res) => ({
      ...res,
      patients: res.patients.map(normalizePatient),
    }));
  },

  assignPatientToDoctor(patientUserId: string, doctorUserId: string) {
    return request<{ success: boolean; patient: ApiPatient }>(`/users/patients/${patientUserId}/assign-doctor`, {
      method: "PATCH",
      body: JSON.stringify({ doctorUserId }),
    }).then((res) => ({ ...res, patient: normalizePatient(res.patient) }));
  },

  // --- Admin: Exercises ---
  getExercises() {
    return request<{ success: boolean; exercises: ApiExercise[] }>("/exercises");
  },

  createExercise(data: { name?: string; exercise?: string; description: string; images: ExerciseImage[] }) {
    return request<{ success: boolean; exercise: ApiExercise }>("/exercises", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateExercise(exerciseId: string, data: Partial<{ name: string; exercise: string; description: string; images: ExerciseImage[] }>) {
    return request<{ success: boolean; exercise: ApiExercise }>(`/exercises/${exerciseId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  deleteExercise(exerciseId: string) {
    return request<ApiResponse>(`/exercises/${exerciseId}`, {
      method: "DELETE",
    });
  },

  restoreExercise(exerciseId: string) {
    return request<{ success: boolean; exercise: ApiExercise }>(`/exercises/${exerciseId}/restore`, {
      method: "PATCH",
    });
  },

  permanentlyDeleteExercise(exerciseId: string) {
    return request<ApiResponse>(`/exercises/${exerciseId}/trash`, {
      method: "DELETE",
    });
  },

  // --- Profile ---
  getProfile() {
    return request<{ success: boolean; user: ApiUser & { profile?: DoctorProfile | PatientProfile } }>("/users/me/profile");
  },

  updateProfile(data: Partial<DoctorProfile | PatientProfile>) {
    return request<{ success: boolean; user: ApiUser & { profile?: DoctorProfile | PatientProfile } }>("/users/me/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  // --- Doctor: Patients ---
  getPatients() {
    return request<{ success: boolean; patients: ApiPatient[] }>("/users/patients").then((res) => ({
      ...res,
      patients: res.patients.map(normalizePatient),
    }));
  },

  getAdminCareSessions() {
    return request<{ success: boolean; sessions: CareSession[] }>("/care/admin/sessions");
  },

  getPatient(userId: string) {
    return request<{ success: boolean; patient: ApiPatient }>(`/users/patients/${userId}`).then((res) => ({
      ...res,
      patient: normalizePatient(res.patient),
    }));
  },

  createPatient(data: Partial<ApiPatient & PatientProfile>) {
    return request<{ success: boolean; patient: ApiPatient; temporaryPassword?: string }>("/users/patients", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((res) => ({ ...res, patient: normalizePatient(res.patient) }));
  },

  updatePatient(userId: string, data: Partial<PatientProfile>) {
    return request<{ success: boolean; patient: ApiPatient }>(`/users/patients/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }).then((res) => ({ ...res, patient: normalizePatient(res.patient) }));
  },

  updatePatientStatus(userId: string, isActive: boolean) {
    return request<{ success: boolean; patient: ApiPatient }>(`/users/patients/${userId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    }).then((res) => ({ ...res, patient: normalizePatient(res.patient) }));
  },

  resetPatientPassword(userId: string, newPassword: string) {
    return request<ApiResponse>(`/users/patients/${userId}/password`, {
      method: "PATCH",
      body: JSON.stringify({ newPassword }),
    });
  },

  deletePatient(userId: string) {
    return request<ApiResponse>(`/users/patients/${userId}`, {
      method: "DELETE",
    });
  },

  permanentlyDeletePatient(userId: string) {
    return request<ApiResponse>(`/users/patients/${userId}/trash`, {
      method: "DELETE",
    });
  },

  // --- Doctor: Exercise Assignments ---
  getAvailableExercises(patientId: string) {
    return request<{ success: boolean; exercises: ApiExercise[] }>(`/exercises/patients/${patientId}/available`);
  },

  getAssignedExercises(patientId: string) {
    return request<{ success: boolean; assignments: ExerciseAssignment[] }>(`/exercises/patients/${patientId}/assigned`);
  },

  assignExercise(patientId: string, exerciseId: string) {
    return request<{ success: boolean; assignment: ExerciseAssignment }>(`/exercises/patients/${patientId}/assignments`, {
      method: "POST",
      body: JSON.stringify({ exerciseId }),
    });
  },

  removeAssignedExercise(patientId: string, assignmentId: string) {
    return request<ApiResponse>(`/exercises/patients/${patientId}/assignments/${assignmentId}`, {
      method: "DELETE",
    });
  },

  // --- Patient: Assigned Exercises ---
  getMyAssignedExercises() {
    return request<{ success: boolean; assignments: ExerciseAssignment[], patientUserId: string }>("/exercises/me/assigned");
  },

  evaluateExercise(exerciseId: string, assignmentId: string, videoBlob: Blob) {
    return request<{ success: boolean; score: number; feedback?: string[]; sessionId: string; message?: string }>(`/exercises/patients/exercises/${exerciseId}/assignments/${assignmentId}/evaluate`, {
      method: "POST",
      headers: {
        "Content-Type": videoBlob.type || "video/webm",
      },
      body: videoBlob,
    });
  },

  requestLiveCoaching(
    exerciseId: string,
    assignmentId: string,
    event: "issue_resolved" | "repetition_completed",
  ) {
    return request<{
      success: boolean;
      message: string;
      source: "ollama" | "fallback";
    }>(`/exercises/patients/exercises/${exerciseId}/assignments/${assignmentId}/live-coaching`, {
      method: "POST",
      body: JSON.stringify({ event }),
    });
  },

  // --- Care Timeline & Notifications ---
  getMySessions() {
    return request<{ success: boolean; sessions: CareSession[] }>("/care/me/sessions");
  },

  getPatientSessions(patientUserId: string) {
    return request<{ success: boolean; sessions: CareSession[] }>(`/care/patients/${patientUserId}/sessions`);
  },

  updateSessionFeedback(sessionId: string, aiFeedback: string[]) {
    return request<{ success: boolean; session: CareSession }>(`/care/sessions/${sessionId}/feedback`, {
      method: "PATCH",
      body: JSON.stringify({ aiFeedback }),
    });
  },

  submitCheckIn(sessionId: string, data: { painLevel: number; difficultyLevel: number; confidenceLevel: number; note?: string }) {
    return request<{ success: boolean; session: CareSession }>(`/care/sessions/${sessionId}/check-in`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  addDoctorComment(sessionId: string, body: string) {
    return request<{ success: boolean; comment: SessionComment }>(`/care/sessions/${sessionId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  },

  getMyNotifications() {
    return request<{ success: boolean; notifications: CareNotification[] }>("/care/notifications");
  },

  markNotificationRead(notificationId: string) {
    return request<{ success: boolean; notification: CareNotification }>(`/care/notifications/${notificationId}/read`, {
      method: "PATCH",
    });
  },
};
