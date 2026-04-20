import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const SALT_ROUNDS = 10;

async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: "Unauthorized" });
  }
}

export async function registerAuthRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.post<{
    Body: { email?: string; password?: string; organizationName?: string; displayName?: string };
  }>("/auth/register", async (req, reply) => {
    const { email, password, organizationName, displayName } = req.body ?? {};
    if (!email || !password) {
      return reply.code(400).send({ error: "email and password are required" });
    }
    if (password.length < 8) {
      return reply.code(400).send({ error: "password must be at least 8 characters" });
    }
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return reply.code(409).send({ error: "email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const orgName = organizationName?.trim() || "My organization";

    const { user, organizationId } = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name: orgName } });
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          displayName: displayName?.trim() || null,
        },
      });
      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: "ADMIN",
        },
      });
      return { user, organizationId: org.id };
    });

    const token = await reply.jwtSign({ sub: user.id });
    return reply.code(201).send({
      token,
      user: { id: user.id, email: user.email, displayName: user.displayName },
      organizationId,
    });
  });

  app.post<{ Body: { email?: string; password?: string } }>("/auth/login", async (req, reply) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return reply.code(400).send({ error: "email and password are required" });
    }
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return reply.code(401).send({ error: "invalid email or password" });
    }
    const token = await reply.jwtSign({ sub: user.id });
    return { token, user: { id: user.id, email: user.email, displayName: user.displayName } };
  });

  app.get(
    "/auth/me",
    { preHandler: [authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const payload = req.user as { sub: string };
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          memberships: {
            include: { organization: { select: { id: true, name: true } } },
          },
        },
      });
      if (!user) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      return {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
        },
        memberships: user.memberships.map((m) => ({
          organizationId: m.organizationId,
          organizationName: m.organization.name,
          role: m.role,
        })),
      };
    },
  );
}
