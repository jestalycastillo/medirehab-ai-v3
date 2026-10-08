import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { planPhysiotherapyCatalog } from "./physiotherapy-catalog";

const prisma = new PrismaClient();

async function main() {
    if (process.argv.slice(2).some((arg) => !["--apply", "--dry-run"].includes(arg))) {
        throw new Error("Supported options: --dry-run (default), --apply");
    }
    if (process.argv.includes("--apply") && process.argv.includes("--dry-run")) {
        throw new Error("Choose either --apply or --dry-run.");
    }
    const plan = await planPhysiotherapyCatalog(prisma);
    console.log(JSON.stringify(plan, null, 2));
    if (!process.argv.includes("--apply")) {
        console.log("DRY RUN: no database data was changed.");
        return;
    }
    // One atomic, additive insert. No update/delete/reset/seed of existing rows.
    const data = plan.filter((item) => item.action === "create").map(({ action, ...item }) => item);
    if (data.length) {
        const result = await prisma.exercise.createMany({ data });
        console.log(`Added ${result.count} exercises; all existing records preserved.`);
    } else {
        console.log("All four exercises already exist; no database changes made.");
    }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
