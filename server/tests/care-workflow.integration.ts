import "dotenv/config";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";
import { recordExerciseSession } from "../src/services/care.service";
import { completeExerciseActivity } from "../src/services/presence.service";

type Json = Record<string, any>;

const listen = (): Promise<Server> => new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
});

const close = (server: Server): Promise<void> => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
});

async function main() {
    const server = await listen();
    const address = server.address();
    assert(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}/api`;
    const createdUserIds: string[] = [];

    const request = async (path: string, options: { method?: string; cookie?: string; body?: unknown; expected?: number } = {}) => {
        const response = await fetch(`${base}${path}`, {
            method: options.method ?? "GET",
            headers: {
                ...(options.cookie ? { Cookie: options.cookie } : {}),
                ...(options.body !== undefined ? { "Content-Type": "application/json" } : {})
            },
            ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {})
        });
        const payload = await response.json() as Json;
        assert.equal(response.status, options.expected ?? 200, `${options.method ?? "GET"} ${path}: ${JSON.stringify(payload)}`);
        return { payload, cookie: response.headers.get("set-cookie")?.split(";", 1)[0] };
    };

    const login = async (email: string, password: string) => {
        const result = await request("/auth/login", { method: "POST", body: { email, password } });
        assert(result.cookie);
        return result.cookie;
    };

    let adminCookie = "";
    try {
        adminCookie = await login(process.env.SEED_ADMIN_EMAIL ?? "admin@test.test", process.env.SEED_ADMIN_PASSWORD ?? "Admin123!");
        const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const createDoctor = async (label: string) => {
            const email = `integration-${label}-${suffix}@medirehab.test`;
            const result = await request("/users/doctors", { method: "POST", cookie: adminCookie, expected: 201, body: { email, firstName: label, lastName: "Doctor" } });
            createdUserIds.push(result.payload.doctor.id);
            let cookie = await login(email, result.payload.temporaryPassword);
            await request("/users/me/password", { method: "PATCH", cookie, body: { currentPassword: result.payload.temporaryPassword, newPassword: "Integration123!" } });
            cookie = await login(email, "Integration123!");
            return { id: result.payload.doctor.id as string, cookie };
        };

        const doctor = await createDoctor("Primary");
        const otherDoctor = await createDoctor("Other");
        const patientEmail = `integration-patient-${suffix}@medirehab.test`;
        const createdPatient = await request("/users/patients", { method: "POST", cookie: adminCookie, expected: 201, body: { email: patientEmail, firstName: "Test", lastName: "Patient" } });
        const patientId = createdPatient.payload.patient.id as string;
        createdUserIds.push(patientId);
        let patientCookie = await login(patientEmail, createdPatient.payload.temporaryPassword);
        await request("/users/me/password", { method: "PATCH", cookie: patientCookie, body: { currentPassword: createdPatient.payload.temporaryPassword, newPassword: "Integration123!" } });
        patientCookie = await login(patientEmail, "Integration123!");

        await request(`/users/patients/${patientId}/assign-doctor`, { method: "PATCH", cookie: adminCookie, body: { doctorUserId: doctor.id } });
        const available = await request(`/exercises/patients/${patientId}/available`, { cookie: doctor.cookie });
        const exercise = available.payload.exercises.find((item: Json) => item.name === "Side Arms Raise") ?? available.payload.exercises[0];
        assert(exercise, "Seeded exercise is required");
        const assigned = await request(`/exercises/patients/${patientId}/assignments`, { method: "POST", cookie: doctor.cookie, expected: 201, body: { exerciseId: exercise.id } });
        const assignmentId = assigned.payload.assignment.id as string;

        await request(`/exercises/patients/${patientId}/assignments/${assignmentId}/plan`, { method: "PATCH", cookie: doctor.cookie, body: { targetSessionsPerWeek: 4, doctorInstructions: "Move comfortably and stop if symptoms increase." } });
        await request("/users/me/consent", { method: "PATCH", cookie: patientCookie, body: { privacyConsent: true, recordingConsent: true } });
        await request("/presence/heartbeat", { method: "POST", cookie: patientCookie });
        await request("/presence/assignments/viewed", { method: "POST", cookie: patientCookie, body: { assignmentIds: [assignmentId] } });
        await request(`/presence/assignments/${assignmentId}/start`, { method: "POST", cookie: patientCookie });
        await request(`/presence/assignments/${assignmentId}/stop`, { method: "POST", cookie: patientCookie });

        await request("/chat/messages", { method: "POST", cookie: patientCookie, expected: 201, body: { body: "How should today feel?" } });
        const doctorChat = await request(`/chat/messages?patientUserId=${patientId}`, { cookie: doctor.cookie });
        assert.equal(doctorChat.payload.messages.length, 1);
        await request(`/chat/messages?patientUserId=${patientId}`, { cookie: otherDoctor.cookie, expected: 404 });

        const session = await recordExerciseSession(patientId, assignmentId, exercise.id, 88.126, ["Controlled movement"]);
        await completeExerciseActivity(patientId, assignmentId);
        assert.equal(session.score, 88.13);
        await request(`/care/sessions/${session.id}/check-in`, { method: "POST", cookie: patientCookie, body: { painLevel: 7, difficultyLevel: 5, confidenceLevel: 3, note: "Needed one pause." } });
        await request(`/care/sessions/${session.id}/comments`, { method: "POST", cookie: doctor.cookie, expected: 201, body: { body: "Thank you. Keep the next session comfortable." } });

        const doctorSessions = await request(`/care/patients/${patientId}/sessions`, { cookie: doctor.cookie });
        assert.equal(doctorSessions.payload.sessions[0].score, 88.13);
        assert.equal(doctorSessions.payload.sessions[0].patientNote, "Needed one pause.");
        const patientSessions = await request("/care/me/sessions", { cookie: patientCookie });
        assert.equal(patientSessions.payload.sessions[0].comments.length, 1);
        await request(`/care/patients/${patientId}/sessions`, { cookie: otherDoctor.cookie, expected: 404 });

        const help = await request("/care/help-requests", { method: "POST", cookie: patientCookie, expected: 201, body: { assignmentId, message: "Please review my pain score." } });
        const helpList = await request(`/care/patients/${patientId}/help-requests`, { cookie: doctor.cookie });
        assert.equal(helpList.payload.requests[0].resolvedAt, null);
        await request(`/care/help-requests/${help.payload.request.id}/resolve`, { method: "PATCH", cookie: doctor.cookie });
        await request(`/care/patients/${patientId}/help-requests`, { cookie: otherDoctor.cookie, expected: 404 });

        const notifications = await request("/care/notifications", { cookie: doctor.cookie });
        assert(notifications.payload.notifications.some((item: Json) => item.type === "SESSION_RESULT"));
        assert(notifications.payload.notifications.some((item: Json) => item.type === "PATIENT_HELP"));
        await new Promise((resolve) => setTimeout(resolve, 100));
        const audit = await request("/audit", { cookie: adminCookie });
        assert(audit.payload.logs.some((item: Json) => item.path.includes("/chat/messages")));

        console.log("Integration workflow passed: consent, presence, plan, chat, score, check-in, comment, help, notifications, audit, and authorization.");
    } finally {
        for (const id of createdUserIds.reverse()) {
            try {
                const role = await prisma.user.findUnique({ where: { id }, select: { role: true } });
                if (!role) continue;
                const segment = role.role === "DOCTOR" ? "doctors" : "patients";
                await request(`/users/${segment}/${id}`, { method: "DELETE", cookie: adminCookie });
                await request(`/users/${segment}/${id}/trash`, { method: "DELETE", cookie: adminCookie });
            } catch (error) {
                console.error(`Cleanup failed for ${id}:`, error);
            }
        }
        await close(server);
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
