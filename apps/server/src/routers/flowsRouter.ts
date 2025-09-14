import { protectedProcedure, publicProcedure, router } from "../lib/trpc";
import { flows } from "@/db/schema/flows";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import * as z from "zod";

export const flowsRouter = router({
  createFlow: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const newFlow = await ctx.db.insert(flows).values({
        id: randomUUID(),
        userId: ctx.session.user.id,
        name: input.name,
        description: input.description ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return newFlow;
    }),
  getFlows: protectedProcedure.query(async ({ ctx }) => {
    const userFlows = await ctx.db
      .select()
      .from(flows)
      .where(eq(flows.userId, ctx.session.user.id));
    return userFlows;
  }),
  executeFlow: protectedProcedure.mutation(() => {
    return { message: "Flow executed" };
  }),
});
