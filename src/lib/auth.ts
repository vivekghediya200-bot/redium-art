import jwt from 'jsonwebtoken'

const SECRET = process.env.NEXTAUTH_SECRET || 'your-secret-key'

export function signToken(payload: object): string {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, SECRET)
  } catch (error) {
    return null
  }
}

export function getTokenFromHeader(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null
  const parts = authHeader.split(' ')
  return parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null
}
