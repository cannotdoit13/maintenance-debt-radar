import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@example.com";
  const password = "demo12345";

  await prisma.organization.deleteMany({ where: { name: "Demo organization" } });
  await prisma.user.deleteMany({ where: { email } });

  const passwordHash = await bcrypt.hash(password, 10);

  const org = await prisma.organization.create({
    data: { name: "Demo organization" },
  });
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName: "Demo Admin",
    },
  });
  await prisma.membership.create({
    data: {
      userId: user.id,
      organizationId: org.id,
      role: "ADMIN",
    },
  });
  const service = await prisma.service.create({
    data: {
      name: "Example API",
      organizationId: org.id,
    },
  });
  await prisma.repoLink.create({
    data: {
      serviceId: service.id,
      repoFullName: "octocat/Hello-World",
    },
  });

  console.log("Seed OK:", { email, password, organizationId: org.id });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
