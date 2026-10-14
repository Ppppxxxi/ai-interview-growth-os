import type { PublicErrorCode } from '../../src/domain/llmContracts';

export class AIError extends Error {
  constructor(readonly code: PublicErrorCode) { super(code); }
}
export const errorStatus: Record<PublicErrorCode, number> = {
  INVALID_REQUEST: 400, REQUEST_TOO_LARGE: 400, AI_UNAVAILABLE: 503,
  RATE_LIMITED: 429, QUOTA_EXCEEDED: 503, TIMEOUT: 504, UPSTREAM_ERROR: 502, INVALID_RESPONSE: 502,
};
