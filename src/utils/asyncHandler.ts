import { Request, RequestHandler, Response } from 'express';

// express 4 doesn't catch async errors, so pass them to next()
export const asyncHandler =
  (handler: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    handler(req, res).catch(next);
  };
