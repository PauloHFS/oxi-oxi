import { protectedProcedure, publicProcedure, router } from "../lib/trpc";
import { edges } from "@/db/schema/edges";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import * as z from "zod";

export const edgesRouter = router({
  createEdge: protectedProcedure
    .input(
      z.object({
        flowId: z.string(),
        sourceNodeId: z.string(),
        targetNodeId: z.string(),
      })
    )
    .mutation(({ ctx, input }) => {
      const newEdge = ctx.db.insert(edges).values({
        id: randomUUID(),
        flowId: input.flowId,
        sourceNodeId: input.sourceNodeId,
        targetNodeId: input.targetNodeId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return newEdge;
    }),
  deleteEdge: protectedProcedure
    .input(
      z.object({
        edgeId: z.string(),
      })
    )
    .mutation(({ ctx, input }) => {
      const deletedEdge = ctx.db
        .delete(edges)
        .where(eq(edges.id, input.edgeId));
      return deletedEdge;
    }),
});
