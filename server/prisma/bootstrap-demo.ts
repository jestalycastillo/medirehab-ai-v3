import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/utils/password";
import { createDemoAccounts, planDemoAccounts } from "./demo-accounts";

async function main() {
    const args = process.argv.slice(2);

    if (
        args.some((arg) => arg !== "--apply" && arg !== "--dry-run") ||
        (args.includes("--apply") && args.includes("--dry-run"))
    ) {
        throw new Error(
            "Usage: npm run db:bootstrap:demo -- [--dry-run | --apply]. Default: read-only preview.",
        );
    }

    const apply = args.includes("--apply");
    const password = process.env.DEMO_ACCOUNT_PASSWORD;

    if (
        apply &&
        (!password ||
            password.length < 12 ||
            Buffer.byteLength(password, "utf8") > 72)
    ) {
        throw new Error(
            "Set DEMO_ACCOUNT_PASSWORD to at least 12 characters and no more than 72 UTF-8 bytes before applying.",
        );
    }

    const prisma = new PrismaClient();

    try {
        if (!apply) {
            const plan = await planDemoAccounts(prisma);

            console.table(
                plan.accounts.map(({ email, role, action }) => ({
                    email,
                    role,
                    action,
                })),
            );

            console.log(
                `Reuses ${plan.exercises.length} existing exercises: ${
                    plan.exercises.map((exercise) => exercise.name).join(", ")
                }.`,
            );

            console.log(
                "Preview only. After explicit database approval, use --apply to create missing accounts and assignments for NEW patients only.",
            );
            return;
        }

        const passwordHash = await hashPassword(password!);

        const result = await prisma.$transaction(
            (transaction) => createDemoAccounts(transaction, passwordHash),
            {
                isolationLevel: "Serializable",
                timeout: 30_000,
            },
        );

        console.log(result);
        console.log(
            "Named demo accounts must change their password on first login; the standard admin, doctor and patient logins are exempt. Existing accounts, passwords, exercises, care plans, history and consent were preserved.",
        );
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error: unknown) => {
    console.error(
        error instanceof Error ? error.message : "Demo account bootstrap failed.",
    );
    process.exitCode = 1;
});
