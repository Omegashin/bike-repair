import type { ErrorRequestHandler } from "express";
import { z } from "zod";

// Last middleware: turns thrown errors into the API's JSON error contract.
// Express recognises error handlers by their four parameters, so `_next` must stay.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: "Invalid input", fieldErrors: z.flattenError(err).fieldErrors });
    return;
  }
  // express.json() rejects unparseable bodies with this type.
  if ((err as { type?: string }).type === "entity.parse.failed") {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
};
