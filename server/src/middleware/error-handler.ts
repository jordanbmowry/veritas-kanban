import { Request, Response, NextFunction } from 'express';

// Custom error classes
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, message, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, message, 'VALIDATION_ERROR', details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
  }
}

// Express error handling middleware (4 args)
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId: string | undefined = res.locals.requestId;

  if (err instanceof AppError) {
    const response: { error: string; code?: string; details?: unknown; requestId?: string } = {
      error: err.message,
      code: err.code,
    };
    if (err.details) {
      response.details = err.details;
    }
    if (requestId) {
      response.requestId = requestId;
    }
    return res.status(err.statusCode).json(response);
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    ...(requestId ? { requestId } : {}),
  });
}
