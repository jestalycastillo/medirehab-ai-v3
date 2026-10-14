import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { PHYSIOTHERAPY_CATALOG, planPhysiotherapyCatalog } from "../prisma/physiotherapy-catalog";

async function main() {
    const database = (rows: unknown[]) => ({ exercise: { findMany: async () => rows } }) as unknown as PrismaClient;
    const plan = await planPhysiotherapyCatalog(database([]));
    assert.equal(plan.length, 4);
    assert(plan.every((item) => item.action === "create"));
    const existing = PHYSIOTHERAPY_CATALOG.map((item) => ({ ...item, isActive: true, archivedAt: null }));
    assert((await planPhysiotherapyCatalog(database(existing))).every((item) => item.action === "keep"));
    await assert.rejects(planPhysiotherapyCatalog(database([{ ...existing[0], analysisModelKey: "left_flexion" }])), /Catalog conflict/);
    await assert.rejects(planPhysiotherapyCatalog(database([{ ...existing[0], isActive: false }])), /Catalog conflict/);
    console.log("Additive physiotherapy catalog planning passed; no database writes.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
