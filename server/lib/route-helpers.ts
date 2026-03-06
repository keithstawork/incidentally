import type { Request, Response, RequestHandler } from "express";

export function parseId(req: Request, res: Response): number | null {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ message: "Invalid ID" });
    return null;
  }
  return id;
}

/**
 * Wrap an async route handler so unhandled rejections
 * are forwarded to Express's global error handler.
 */
export const wrapAsync = (
  fn: (req: Request, res: Response) => Promise<any>,
): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };
