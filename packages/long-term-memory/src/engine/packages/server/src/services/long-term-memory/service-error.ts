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

function isLtmServiceError(error: unknown): error is LtmServiceError {
  return Boolean(
    error &&
    typeof error === "object" &&
    typeof (error as { message?: unknown }).message === "string" &&
    Number.isInteger((error as { statusCode?: unknown }).statusCode) &&
    typeof (error as { code?: unknown }).code === "string",
  );
}

export function ltmErrorResponse(error: unknown, fallback: string) {
  if (isLtmServiceError(error))
    return { statusCode: error.statusCode, body: { error: error.message, code: error.code } };
  const message = error instanceof Error ? error.message : fallback;
  return { statusCode: 500, body: { error: message, code: "ltm_unexpected_failure" } };
}
