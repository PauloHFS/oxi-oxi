import { protectedProcedure, router } from "../lib/trpc";
import { nodes } from "@/db/schema/nodes";
import { randomUUID } from "crypto";
import * as z from "zod";

export const nodesRouter = router({
  createNode: protectedProcedure
    .input(
      z.object({
        flowId: z.string(),
        name: z.string().min(1).max(100),
        type: z.enum(["API", "WEBHOOK", "OLLAMA"]),
        data: z.object(z.any()),
        positionX: z.number(),
        positionY: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const newNode = await ctx.db.insert(nodes).values({
        id: randomUUID(),
        flowId: input.flowId,
        type: input.type,
        name: input.name,
        data: JSON.stringify(input.data),
        positionX: input.positionX,
        positionY: input.positionY,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return newNode;
    }),
  updateNode: protectedProcedure
    .input(z.object({}))
    .mutation(({ ctx, input }) => {
      return { message: "Node updated" };
    }),
  deleteNode: protectedProcedure
    .input(z.object({}))
    .mutation(({ ctx, input }) => {
      return { message: "Node deleted" };
    }),
  getNodeResult: protectedProcedure
    .input(
      z.object({
        nodeId: z.string(),
      })
    )
    .mutation(({ ctx, input }) => {
      return { message: "Node results" };
    }),
});
