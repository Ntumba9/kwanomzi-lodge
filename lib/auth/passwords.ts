import { hash, verify } from "@node-rs/argon2";

export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export function verifyPassword(hashedPassword: string, password: string): Promise<boolean> {
  return verify(hashedPassword, password);
}
