import "dotenv/config";
import { Elysia } from "elysia";
import { openapi } from '@elysiajs/openapi'
import { opentelemetry } from '@elysiajs/opentelemetry'
import { cors } from "@elysiajs/cors";
import { createContext } from "@/lib/context";
import { appRouter } from "@/routers/index";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { auth } from "@/lib/auth";
import * as z from "zod";
import { publish, ROUTING_KEYS, setupQueue } from "@/queue";

const app = new Elysia()
  .use(
    cors({
      origin: process.env.CORS_ORIGIN || "",
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
  )
  .use(openapi())
  .use(opentelemetry())
  .onStart(async () => {
    await setupQueue();
  })
  .all("/api/auth/*", async (context) => {
    const { request } = context;
    if (["POST", "GET"].includes(request.method)) {
      return auth.handler(request);
    }
    context.error(405);
  })
  .all("/trpc/*", async (context) => {
    const res = await fetchRequestHandler({
      endpoint: "/trpc",
      router: appRouter,
      req: context.request,
      createContext: () => createContext({ context }),
    });
    return res;
  })
  .get("/", () => "OK")
  .post("/webhook/:webhook_id", async ({ params }) => {
    const webhookIdSchema = z.object({
      webhook_id: z.string(),
    });
    try {
      const { webhook_id } = webhookIdSchema.parse(params);

      // Use the new rabbitmqManager to publish the message
      await publish(
        ROUTING_KEYS.webhook,
        JSON.stringify({
          nodeId: webhook_id,
        })
      );

      return {
        status: 202, // Accepted
        body: { message: "Webhook accepted and queued for processing." },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          status: 400,
          body: { error: "Invalid webhook ID format." },
        };
      }
      console.error("[✗] Erro ao processar webhook:", error);
      return {
        status: 500,
        body: { error: "Internal server error while queueing webhook." },
      };
    }
  })
  .listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
  });
