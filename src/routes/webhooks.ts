import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient, Prisma } from "@prisma/client";
import { verifyGitHubSignature } from "../lib/verify-signature.js";

const MAX_BODY_SIZE = 256 * 1024; // 256 KB

export async function registerWebhookRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
) {
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret) {
    app.log.warn(
      "GITHUB_WEBHOOK_SECRET is not set; webhook signature verification will reject all requests.",
    );
  }

  app.post<{ Querystring: { orgId?: string } }>(
    "/integrations/github/webhook",
    { bodyLimit: MAX_BODY_SIZE, config: { rawBody: true } },
    async (req: FastifyRequest<{ Querystring: { orgId?: string } }>, reply: FastifyReply) => {
      const signatureHeader = req.headers["x-hub-signature-256"] as string | undefined;
      const deliveryId = req.headers["x-github-delivery"] as string | undefined;
      const eventType = req.headers["x-github-event"] as string | undefined;
      const orgId = (req.query as { orgId?: string }).orgId;

      if (!signatureHeader) {
        return reply.code(401).send({ error: "missing signature" });
      }

      if (!webhookSecret) {
        return reply.code(500).send({ error: "internal error" });
      }

      const rawBody = Buffer.from(
        (req as unknown as { rawBody: string }).rawBody ?? "",
        "utf8",
      );
      if (!verifyGitHubSignature(rawBody, signatureHeader, webhookSecret)) {
        return reply.code(401).send({ error: "invalid signature" });
      }

      if (!deliveryId) {
        return reply.code(400).send({ error: "missing delivery id" });
      }

      if (eventType === "ping") {
        return reply.code(200).send({ accepted: true, event: "ping" });
      }

      if (!orgId) {
        return reply.code(400).send({ error: "missing orgId query parameter" });
      }

      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      if (!org) {
        return reply.code(400).send({ error: "unknown organization" });
      }

      try {
        await prisma.integrationDelivery.create({
          data: {
            organizationId: orgId,
            deliveryId,
            source: "github",
            eventType: eventType ?? null,
            payload: req.body as Prisma.InputJsonValue,
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          app.log.info({ deliveryId }, "duplicate delivery ignored");
          return reply.code(200).send({ accepted: true, duplicate: true });
        }
        throw err;
      }

      app.log.info({ deliveryId, eventType }, "webhook delivery stored");
      return reply.code(200).send({ accepted: true, deliveryId });
    },
  );
}
