import assert from "node:assert/strict";
import { EXERCISE_PRESETS, getExercisePreset, resolvePresetExercises } from "../src/utils/exercisePresets";
import { prisma } from "../src/lib/prisma";
import { assignExercisePresetToPatient } from "../src/services/exercise.service";

const preset = getExercisePreset("frozen-shoulder");
const catalog = preset.exerciseNames.map((name, index) => ({ id: String(index), name }));
assert.deepEqual(resolvePresetExercises(preset, [...catalog].reverse()).exercises, catalog);
assert.deepEqual(resolvePresetExercises(preset, catalog).missingExerciseNames, []);
assert.deepEqual(resolvePresetExercises(preset, catalog.slice(1)).missingExerciseNames, ["Shoulder Flexion"]);
assert.equal(resolvePresetExercises(preset, [...catalog, { id: "other", name: "Side Arms Raise" }]).exercises.length, 4);
for (const id of [undefined, null, {}, "invalid"]) assert.throws(() => getExercisePreset(id));
const existingExerciseNames = new Set([
    "Shoulder Flexion", "Shoulder Abduction", "Side Arms Raise", "Arm Circumduction",
    "Cross-body Shoulder Stretch", "External Rotation", "Internal Rotation"
]);
assert.equal(new Set(EXERCISE_PRESETS.map((item) => item.id)).size, EXERCISE_PRESETS.length);
for (const item of EXERCISE_PRESETS) {
    assert.equal(getExercisePreset(item.id), item);
    assert.ok(item.exerciseNames.length > 0);
    assert.equal(new Set(item.exerciseNames).size, item.exerciseNames.length);
    for (const name of item.exerciseNames) assert.ok(existingExerciseNames.has(name), `${item.name} must use existing exercises`);
    const members = item.exerciseNames.map((name, index) => ({ id: `${item.id}-${index}`, name }));
    assert.deepEqual(resolvePresetExercises(item, [...members].reverse()).exercises, members);
    assert.deepEqual(resolvePresetExercises(item, members.slice(1)).missingExerciseNames, [item.exerciseNames[0]]);
}
console.log("Exercise preset catalog resolution passed.");

async function testAssignment() {
    // Replace every database entry point used by this service before calling it.
    // No database connection or persisted changes are made by these tests.
    const originals = {
        doctor: prisma.doctorProfile.findUnique,
        patient: prisma.patientProfile.findFirst,
        transaction: prisma.$transaction
    };
    let patientAllowed = true;
    let currentCatalog = catalog;
    const creates: unknown[] = [];
    const updates: unknown[] = [];
    const transaction = {
        exercise: { findMany: async () => currentCatalog },
        exerciseAssignment: {
            findUnique: async ({ where }: { where: { exerciseId_patientProfileId: { exerciseId: string } } }) => {
                const id = where.exerciseId_patientProfileId.exerciseId;
                return id === "0" ? { id: "active", archivedAt: null } : id === "1" ? { id: "archived", archivedAt: new Date() } : null;
            },
            create: async (input: unknown) => { creates.push(input); },
            update: async (input: unknown) => { updates.push(input); }
        }
    };
    try {
        prisma.doctorProfile.findUnique = (async () => ({ id: "doctor" })) as typeof originals.doctor;
        prisma.patientProfile.findFirst = (async () => patientAllowed ? { id: "patient" } : null) as typeof originals.patient;
        prisma.$transaction = (async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)) as typeof originals.transaction;
        assert.deepEqual(await assignExercisePresetToPatient("patient-user", "doctor-user", preset.id), {
            presetName: "Frozen shoulder", assignedCount: 3, skippedCount: 1
        });
        assert.equal(creates.length, 2);
        assert.equal(updates.length, 1);
        assert.equal(JSON.stringify(updates).includes("active"), false, "existing active plans must not be updated");
        creates.length = 0;
        updates.length = 0;
        currentCatalog = catalog.slice(1);
        await assert.rejects(assignExercisePresetToPatient("patient-user", "doctor-user", preset.id), /unavailable/);
        assert.equal(creates.length + updates.length, 0, "missing members must block all writes");
        patientAllowed = false;
        await assert.rejects(assignExercisePresetToPatient("patient-user", "other-doctor", preset.id), /Patient not found/);
        assert.equal(creates.length + updates.length, 0, "unauthorized doctors must not assign presets");
        patientAllowed = true;
        for (const item of EXERCISE_PRESETS.slice(1)) {
            currentCatalog = item.exerciseNames.map((name, index) => ({ id: `${item.id}-${index}`, name }));
            creates.length = 0;
            updates.length = 0;
            assert.deepEqual(await assignExercisePresetToPatient("patient-user", "doctor-user", item.id), {
                presetName: item.name, assignedCount: item.exerciseNames.length, skippedCount: 0
            });
            assert.equal(creates.length, item.exerciseNames.length);
            assert.equal(updates.length, 0);
        }
    } finally {
        prisma.doctorProfile.findUnique = originals.doctor;
        prisma.patientProfile.findFirst = originals.patient;
        prisma.$transaction = originals.transaction;
    }
    console.log("Exercise preset assignment mock tests passed.");
}
testAssignment().catch((error) => { console.error(error); process.exitCode = 1; });
