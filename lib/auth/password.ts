import bcrypt from "bcryptjs";

const BCRYPT_PREFIX = "$2";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string) {
  if (!passwordHash.startsWith(BCRYPT_PREFIX)) {
    return false;
  }

  return bcrypt.compare(password, passwordHash);
}
