import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Ensure demo user
  const demo = await prisma.user.upsert({
    where: { email: "demo@pantry.local" },
    update: {},
    create: { email: "demo@pantry.local", name: "Demo User" },
  });

  // Ensure one pantry
  const pantry = await prisma.pantry.upsert({
    where: { id: 1 }, // fine for seed; or findFirst by userId
    update: {},
    create: { name: "Main Pantry", userId: demo.id },
  });

  // Ensure a barcode
  const bc = await prisma.barcode.upsert({
    where: { code: "012345678905" },
    update: { label: "Canned Tomatoes" },
    create: { code: "012345678905", label: "Canned Tomatoes" },
  });

  // Seed items (no skipDuplicates)
  // Simple + safe to re-run: upsert by name+pantry — OPTIONAL if you add a unique index (see note below)
  // Without a unique index, just do create() and run the seed once.
  await prisma.item.create({
    data: { name: "Canned Tomatoes", quantity: 4, pantryId: pantry.id, barcodeId: bc.id },
  });
  await prisma.item.create({
    data: { name: "Spaghetti", quantity: 2, pantryId: pantry.id },
  });

  console.log("✅ Seeded demo user + pantry + items + barcode.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
