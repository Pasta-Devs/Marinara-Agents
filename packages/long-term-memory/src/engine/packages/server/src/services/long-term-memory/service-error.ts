export class LtmServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "LtmServiceError";
  }
}

// Only LTM's own errors carry a message written for users. A library error can also have a numeric statusCode and
// a string code (Fastify's FST_ERR_*), so the shape alone does not make one.
export function isLtmServiceError(error: unknown): error is LtmServiceError {
  return error instanceof LtmServiceError;
}

export function ltmErrorResponse(error: LtmServiceError) {
  return { statusCode: error.statusCode, body: { error: error.message, code: error.code } };
}
