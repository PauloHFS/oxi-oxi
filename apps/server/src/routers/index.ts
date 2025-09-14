import { protectedProcedure, publicProcedure, router } from "../lib/trpc";
import { edgesRouter } from "./edgesRouter";
import { flowsRouter } from "./flowsRouter";
import { nodesRouter } from "./nodesRouter";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
  flows: flowsRouter,
  nodes: nodesRouter,
  edges: edgesRouter,
});
export type AppRouter = typeof appRouter;
