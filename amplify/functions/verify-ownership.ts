import { ErrorCode } from '../../shared/types/kingdom';

type Identity = {
  sub?: string;
  username?: string;
  claims?: Record<string, string>;
} | null;

/**
 * Verifies the caller owns the given record by checking the owner field
 * against all possible Cognito identity representations.
 * Returns null if ownership is verified, or an error response object if not.
 */
export function verifyOwnership(
  identity: Identity,
  ownerField: string | null | undefined
): { success: false; error: string; errorCode: string } | null {
  if (!identity?.sub) {
    return { success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED };
  }
  if (!ownerField) {
    return { success: false, error: 'Resource has no owner', errorCode: ErrorCode.FORBIDDEN };
  }
  const ids = [
    identity.sub,
    identity.username,
    identity.claims?.email,
    identity.claims?.['preferred_username'],
    identity.claims?.['cognito:username'],
  ].filter(Boolean) as string[];

  if (!ids.some(id => ownerField.includes(id))) {
    return { success: false, error: 'You do not own this resource', errorCode: ErrorCode.FORBIDDEN };
  }
  return null;
}
