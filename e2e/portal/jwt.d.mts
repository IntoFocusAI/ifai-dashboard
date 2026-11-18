export function signJwt(payload: Record<string, unknown>, secret: string): string;
export function verifyJwt(token: string, secret: string): Record<string, unknown> | null;
