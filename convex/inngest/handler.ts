"use node";

import { InngestCommHandler } from "inngest";

import { inngest, processApplication, processJobSubmission } from "./index";
import type { ActionCtx } from "../_generated/server";

/**
 * Factory that creates an Inngest handler with a specific ActionCtx.
 * The ctx is passed via reqArgs so middleware can access it.
 */
export function createInngestHandler(ctx: ActionCtx) {
  const handler = new InngestCommHandler<[Request, ActionCtx], Response>({
    frameworkName: "convex-node",
    client: inngest,
    functions: [processJobSubmission, processApplication],
    handler: (req: Request, _actionCtx: ActionCtx) => ({
      body: () => req.json(),
      headers: (key: string) => req.headers.get(key),
      method: () => req.method,
      url: () => new URL(req.url, `https://${req.headers.get("host") || "localhost"}`),
      transformResponse: (res: { body: string; status: number; headers: Record<string, string> }) =>
        new Response(res.body, { status: res.status, headers: res.headers }),
    }),
  });

  // Create the base handler
  const baseHandler = handler.createHandler();

  // Wrap it to inject ctx into reqArgs
  return async (request: Request): Promise<Response> => {
    return baseHandler(request, ctx);
  };
}
