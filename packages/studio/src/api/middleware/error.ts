import type { Context } from "hono";
import { ConstraintError } from "@yanstory/core";

export function apiErrorHandler(error: Error, c: Context): Response {
  if (error instanceof ConstraintError || error.name === "ConstraintError") {
    return c.json(
      {
        error: "ConstraintError",
        message: error.message,
        violations: (error as ConstraintError).violations,
      },
      409
    );
  }

  return c.json({ error: "InternalError", message: error.message }, 500);
}
