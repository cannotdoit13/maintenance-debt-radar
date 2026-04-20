import "dotenv/config";
import Fastify from "fastify";
import fjwt from "@fastify/jwt";
import { PrismaClient } from "@prisma/client";
import { registerAuthRoutes } from "./routes/auth.js";

const prisma = new PrismaClient();
const app = Fastify({ logger: true });

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 16) {
  app.log.warn(
    "JWT_SECRET is missing or short; set a strong secret in production (>= 16 chars).",
  );
}

await app.register(fjwt, {
  secret: jwtSecret ?? "dev-only-change-JWT_SECRET-in-env",
});

app.get("/health", async () => ({ status: "ok" }));

app.get("/ready", async (_req, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ready", database: "connected" };
  } catch (err) {
    app.log.error(err, "readiness check failed");
    return reply.code(503).send({ status: "not_ready", database: "disconnected" });
  }
});

await registerAuthRoutes(app, prisma);

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

try {
  await app.listen({ port, host });
  app.log.info(`listening on http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

const shutdown = async () => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
