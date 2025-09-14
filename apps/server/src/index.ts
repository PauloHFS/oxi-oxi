import "dotenv/config";
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { createContext } from "@/lib/context";
import { appRouter } from "@/routers/index";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { auth } from "@/lib/auth";
import * as z from "zod";
import { producer, rabbitmqClient, ROUTING_KEYS, setupQueue } from "@/queue";

const app = new Elysia()
  .onStart(async () => {
    setupQueue();
  })
  .use(
    cors({
      origin: process.env.CORS_ORIGIN || "",
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
  )
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
  .post("/webhook/:webhook_id", async ({ params, body }) => {
    const webhookIdSchema = z.object({
      webhook_id: z.string(),
    });
    try {
      const { webhook_id } = webhookIdSchema.parse(params);

      if (!producer) {
        throw new Error("Producer not initialized");
      }
      await producer.publish(
        ROUTING_KEYS.webhook,
        JSON.stringify({
          nodeId: webhook_id,
        })
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          status: 400,
          body: { error: "Invalid webhook ID" },
        };
      }
      return {
        status: 500,
        body: { error: "Internal server error" },
      };
    }
  })
  .listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
  });
