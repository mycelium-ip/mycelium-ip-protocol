/**
 * Create Entity Script
 *
 * Registers a new entity on-chain.
 *
 * Usage:
 *   HANDLE=<handle> anchor run create_entity --provider.cluster devnet
 *
 * Environment Variables:
 *   HANDLE                  - Entity handle (required, 1-32 chars, lowercase a-z, 0-9, underscores)
 *   ADDITIONAL_CONTROLLERS  - Comma-separated list of additional controller pubkeys (optional, max 4)
 *   SIGNATURE_THRESHOLD     - Required number of controller signatures (optional, defaults to 1)
 *
 * Examples:
 *   HANDLE="my_entity" anchor run create_entity --provider.cluster devnet
 *   HANDLE="my_entity" ADDITIONAL_CONTROLLERS="Abc...,Def..." SIGNATURE_THRESHOLD=2 anchor run create_entity --provider.cluster devnet
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { IpCore } from "../target/types/ip_core";

const MAX_HANDLE_LENGTH = 32;

/**
 * Pads a string to a fixed-length byte array.
 */
const padBytes = (data: string, length: number): number[] => {
  const bytes = Buffer.from(data);
  if (bytes.length > length) {
    throw new Error(
      `Input "${data}" exceeds maximum length of ${length} bytes`,
    );
  }
  const padded = Buffer.alloc(length);
  bytes.copy(padded);
  return Array.from(padded);
};

/**
 * Gets the Solana explorer URL for a transaction.
 */
const getExplorerUrl = (signature: string, cluster: string): string => {
  const clusterParam = cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
  return `https://explorer.solana.com/tx/${signature}${clusterParam}`;
};

async function main() {
  // Validate environment variables
  const handle = process.env.HANDLE;
  const additionalControllersStr = process.env.ADDITIONAL_CONTROLLERS;
  const signatureThresholdStr = process.env.SIGNATURE_THRESHOLD;

  if (!handle) {
    throw new Error(
      "HANDLE environment variable is required (1-32 chars, lowercase a-z, 0-9, underscores)",
    );
  }

  // Validate handle format
  const handleBytes = Buffer.from(handle);
  if (handleBytes.length > MAX_HANDLE_LENGTH) {
    throw new Error(
      `HANDLE exceeds maximum length of ${MAX_HANDLE_LENGTH} bytes`,
    );
  }
  if (!/^[a-z0-9_]+$/.test(handle)) {
    throw new Error(
      "HANDLE must contain only lowercase a-z, 0-9, and underscores",
    );
  }

  // Parse additional controllers
  const additionalControllers: PublicKey[] = [];
  if (additionalControllersStr) {
    const parts = additionalControllersStr
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const part of parts) {
      try {
        additionalControllers.push(new PublicKey(part));
      } catch {
        throw new Error(`Invalid controller pubkey: ${part}`);
      }
    }
    if (additionalControllers.length > 4) {
      throw new Error(
        "Maximum 4 additional controllers allowed (5 total including creator)",
      );
    }
  }

  // Parse signature threshold
  const totalControllers = 1 + additionalControllers.length;
  const signatureThreshold = signatureThresholdStr
    ? parseInt(signatureThresholdStr, 10)
    : 1;

  if (
    isNaN(signatureThreshold) ||
    signatureThreshold < 1 ||
    signatureThreshold > totalControllers
  ) {
    throw new Error(
      `SIGNATURE_THRESHOLD must be between 1 and ${totalControllers} (total controllers)`,
    );
  }

  // Setup Anchor provider and program
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.IpCore as Program<IpCore>;

  const cluster = provider.connection.rpcEndpoint.includes("devnet")
    ? "devnet"
    : provider.connection.rpcEndpoint.includes("mainnet")
    ? "mainnet-beta"
    : "localnet";

  console.log("=".repeat(60));
  console.log("Create Entity");
  console.log("=".repeat(60));
  console.log(`Cluster:     ${cluster}`);
  console.log(`Creator:     ${provider.wallet.publicKey.toBase58()}`);
  console.log(`Handle:      ${handle}`);
  console.log(
    `Controllers: ${totalControllers} (creator + ${additionalControllers.length} additional)`,
  );
  if (additionalControllers.length > 0) {
    additionalControllers.forEach((c, i) =>
      console.log(`  [${i + 1}] ${c.toBase58()}`),
    );
  }
  console.log(`Threshold:   ${signatureThreshold}`);
  console.log("-".repeat(60));

  // Prepare instruction parameters
  const handleBytesArray = padBytes(handle, MAX_HANDLE_LENGTH);

  // Derive PDA
  const [entityPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("entity"),
      provider.wallet.publicKey.toBuffer(),
      Buffer.from(handleBytesArray),
    ],
    program.programId,
  );

  console.log(`Entity PDA:  ${entityPda.toBase58()}`);

  // Check if entity already exists
  const existingEntity = await provider.connection.getAccountInfo(entityPda);
  if (existingEntity) {
    console.log("\nEntity already exists at this PDA.");
    console.log(
      "Entity addresses are unique per (creator, handle) combination.",
    );
    process.exit(0);
  }

  // Create the entity
  console.log("\nCreating entity...");

  const signature = await program.methods
    .createEntity(handleBytesArray, additionalControllers, signatureThreshold)
    .rpc();

  console.log("\nEntity created successfully!");
  console.log(`Transaction: ${signature}`);
  console.log(`Explorer:    ${getExplorerUrl(signature, cluster)}`);
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
