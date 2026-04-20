import { PrismaClient, Prisma } from "@prisma/client";
import type { FastifyBaseLogger } from "fastify";
import {
  isWorkflowRunPayload,
  type GitHubWorkflowRunPayload,
} from "../lib/github-types.js";

const BATCH_SIZE = 10;

export function startNormalizer(
  prisma: PrismaClient,
  logger: FastifyBaseLogger,
  pollMs = 5_000,
): { stop: () => void } {
  let running = true;

  async function tick() {
    if (!running) return;

    try {
      const deliveries = await prisma.integrationDelivery.findMany({
        where: { processedAt: null },
        orderBy: { receivedAt: "asc" },
        take: BATCH_SIZE,
      });

      for (const delivery of deliveries) {
        await processDelivery(prisma, logger, delivery);
      }
    } catch (err) {
      logger.error(err, "normalizer poll error");
    }

    if (running) {
      setTimeout(tick, pollMs);
    }
  }

  logger.info({ pollMs, batchSize: BATCH_SIZE }, "normalizer worker started");
  setTimeout(tick, pollMs);

  return {
    stop() {
      running = false;
      logger.info("normalizer worker stopping");
    },
  };
}

interface DeliveryRow {
  id: string;
  organizationId: string;
  eventType: string | null;
  payload: Prisma.JsonValue;
}

async function processDelivery(
  prisma: PrismaClient,
  logger: FastifyBaseLogger,
  delivery: DeliveryRow,
): Promise<void> {
  try {
    if (delivery.eventType !== "workflow_run") {
      await markProcessed(prisma, delivery.id);
      return;
    }

    const payload = delivery.payload;
    if (!isWorkflowRunPayload(payload)) {
      await markError(prisma, delivery.id, "payload did not match workflow_run shape");
      return;
    }

    if (payload.action !== "completed") {
      await markProcessed(prisma, delivery.id);
      return;
    }

    await normalizeWorkflowRun(prisma, delivery.organizationId, payload);
    await markProcessed(prisma, delivery.id);

    logger.info(
      { deliveryId: delivery.id, workflowRunId: payload.workflow_run.id },
      "delivery normalized",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ deliveryId: delivery.id, err: message }, "delivery processing failed");
    await markError(prisma, delivery.id, message);
  }
}

async function normalizeWorkflowRun(
  prisma: PrismaClient,
  organizationId: string,
  payload: GitHubWorkflowRunPayload,
): Promise<void> {
  const wr = payload.workflow_run;
  const dedupeKey = `github:workflow_run:${wr.id}`;
  const eventType = `ci.workflow_run.${wr.conclusion ?? "unknown"}`;

  try {
    await prisma.signalEvent.create({
      data: {
        organizationId,
        source: "GITHUB",
        eventType,
        dedupeKey,
        occurredAt: new Date(wr.updated_at),
        repoFullName: wr.repository.full_name,
        conclusion: wr.conclusion,
        payload: {
          workflowName: wr.name,
          headBranch: wr.head_branch,
          conclusion: wr.conclusion,
          htmlUrl: wr.html_url,
        },
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // Duplicate dedupeKey — already normalized, safe to ignore.
      return;
    }
    throw err;
  }
}

async function markProcessed(prisma: PrismaClient, id: string) {
  await prisma.integrationDelivery.update({
    where: { id },
    data: { processedAt: new Date() },
  });
}

async function markError(prisma: PrismaClient, id: string, error: string) {
  await prisma.integrationDelivery.update({
    where: { id },
    data: { processedAt: new Date(), processError: error },
  });
}
