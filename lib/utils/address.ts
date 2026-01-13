import { z } from "zod";

const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
  .transform((val) => val.toLowerCase());

export function normalizeAddress(address: string): string {
  return addressSchema.parse(address);
}

export function validateAddress(address: string): boolean {
  try {
    addressSchema.parse(address);
    return true;
  } catch {
    return false;
  }
}

export { addressSchema };
