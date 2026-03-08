/**
 * Get Metadata Schemas Script
 *
 * Fetches and displays all registered metadata schemas, or a single schema
 * when SCHEMA_PUBKEY is provided.
 *
 * Usage:
 *   # All schemas
 *   anchor run get_schemas --provider.cluster devnet
 *
 *   # Single schema by PDA pubkey
 *   SCHEMA_PUBKEY=<pubkey> anchor run get_schemas --provider.cluster devnet
 *
 * Environment Variables:
 *   SCHEMA_PUBKEY  (optional) - PDA public key of an existing metadata schema
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { IpCore } from "../target/types/ip_core";

/**
 * Decodes a fixed-length byte array to a trimmed UTF-8 string.
 */
const decodeBytes = (bytes: number[] | Uint8Array): string =>
  Buffer.from(bytes).toString("utf-8").replace(/\0/g, "");

/**
 * Encodes a fixed-length byte array to a lowercase hex string.
 */
const toHex = (bytes: number[] | Uint8Array): string =>
  Buffer.from(bytes).toString("hex");

/**
 * Returns a Solana Explorer address URL for the given cluster.
 */
const explorerUrl = (address: string, cluster: string): string =>
  cluster === "mainnet-beta"
    ? `https://explorer.solana.com/address/${address}`
    : `https://explorer.solana.com/address/${address}?cluster=${cluster}`;

/**
 * Prints a single metadata schema's state to stdout.
 */
function printSchema(
  pubkey: PublicKey,
  schema: {
    id: number[];
    version: number[];
    hash: number[];
    cid: number[];
    creator: PublicKey;
    createdAt: anchor.BN;
    bump: number;
  },
  cluster: string,
  index?: number,
): void {
  const prefix = index !== undefined ? `[${index + 1}] ` : "";
  console.log(`\n${prefix}PDA: ${pubkey.toBase58()}`);
  console.log(`  ID:         ${decodeBytes(schema.id)}`);
  console.log(`  Version:    ${decodeBytes(schema.version)}`);
  console.log(`  Hash:       ${toHex(schema.hash)}`);
  console.log(`  CID:        ${decodeBytes(schema.cid)}`);
  console.log(`  Creator:    ${schema.creator.toBase58()}`);
  console.log(
    `  Created At: ${new Date(
      schema.createdAt.toNumber() * 1000,
    ).toISOString()}`,
  );
  console.log(`  Bump:       ${schema.bump}`);
  console.log(`  Explorer:   ${explorerUrl(pubkey.toBase58(), cluster)}`);
}

async function main() {
  // Configure provider from Anchor.toml / CLI args
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.IpCore as Program<IpCore>;

  // Determine cluster name for display
  const endpoint = provider.connection.rpcEndpoint;
  let cluster = "localnet";
  if (endpoint.includes("mainnet")) {
    cluster = "mainnet-beta";
  } else if (endpoint.includes("devnet")) {
    cluster = "devnet";
  }

  const schemaPubkeyEnv = process.env.SCHEMA_PUBKEY;

  console.log("=".repeat(60));
  console.log("Metadata Schemas");
  console.log("=".repeat(60));
  console.log(`Cluster:    ${cluster}`);
  console.log(`Program ID: ${program.programId.toBase58()}`);

  // ── Single schema lookup ──────────────────────────────────────
  if (schemaPubkeyEnv) {
    let schemaPubkey: PublicKey;

    try {
      schemaPubkey = new PublicKey(schemaPubkeyEnv);
    } catch {
      console.error(`\nInvalid SCHEMA_PUBKEY: "${schemaPubkeyEnv}"`);
      process.exit(1);
    }

    console.log(`\nFetching schema: ${schemaPubkey.toBase58()}`);
    console.log("-".repeat(60));

    try {
      const schema = await program.account.metadataSchema.fetch(schemaPubkey);
      printSchema(schemaPubkey, schema as any, cluster);
    } catch {
      console.error(
        `\nNo metadata schema found at: ${schemaPubkey.toBase58()}`,
      );
      console.error("Verify the pubkey is a valid MetadataSchema PDA.");
      process.exit(1);
    }

    console.log("\n" + "=".repeat(60));
    return;
  }

  // ── All schemas lookup ────────────────────────────────────────
  console.log("\nFetching all registered schemas...");
  console.log("-".repeat(60));

  const allSchemas = await program.account.metadataSchema.all();

  if (allSchemas.length === 0) {
    console.log("\nNo metadata schemas registered yet.");
    console.log("Run 'anchor run register_schema' to create one.");
  } else {
    console.log(`\nFound ${allSchemas.length} schema(s):`);
    for (let i = 0; i < allSchemas.length; i++) {
      printSchema(
        allSchemas[i].publicKey,
        allSchemas[i].account as any,
        cluster,
        i,
      );
    }
  }

  console.log("\n" + "=".repeat(60));
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
