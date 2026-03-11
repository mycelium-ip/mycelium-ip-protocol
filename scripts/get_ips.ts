/**
 * Get IP Accounts Script
 *
 * Fetches and displays all registered IP accounts, or a single IP account
 * when IP_PUBKEY is provided.
 *
 * Usage:
 *   # All IP accounts
 *   anchor run get_ips --provider.cluster devnet
 *
 *   # Single IP account by PDA pubkey
 *   IP_PUBKEY=<pubkey> anchor run get_ips --provider.cluster devnet
 *
 * Environment Variables:
 *   IP_PUBKEY  (optional) - PDA public key of an existing IP account
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { IpCore } from "../target/types/ip_core";

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
 * Prints a single IP account's state to stdout.
 */
function printIpAccount(
  pubkey: PublicKey,
  ip: {
    contentHash: number[];
    registrantEntity: PublicKey;
    currentOwnerEntity: PublicKey;
    currentMetadataRevision: anchor.BN;
    createdAt: anchor.BN;
    updatedAt: anchor.BN;
    bump: number;
  },
  cluster: string,
  index?: number,
): void {
  const prefix = index !== undefined ? `[${index + 1}] ` : "";
  console.log(`\n${prefix}PDA: ${pubkey.toBase58()}`);
  console.log(`  Content Hash:       ${toHex(ip.contentHash)}`);
  console.log(`  Registrant Entity:  ${ip.registrantEntity.toBase58()}`);
  console.log(`  Current Owner:      ${ip.currentOwnerEntity.toBase58()}`);
  console.log(`  Metadata Revision:  ${ip.currentMetadataRevision.toString()}`);
  console.log(
    `  Created At:         ${new Date(
      ip.createdAt.toNumber() * 1000,
    ).toISOString()}`,
  );
  console.log(
    `  Updated At:         ${new Date(
      ip.updatedAt.toNumber() * 1000,
    ).toISOString()}`,
  );
  console.log(`  Bump:               ${ip.bump}`);
  console.log(
    `  Explorer:           ${explorerUrl(pubkey.toBase58(), cluster)}`,
  );
}

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.IpCore as Program<IpCore>;

  const endpoint = provider.connection.rpcEndpoint;
  let cluster = "localnet";
  if (endpoint.includes("mainnet")) {
    cluster = "mainnet-beta";
  } else if (endpoint.includes("devnet")) {
    cluster = "devnet";
  }

  const ipPubkeyEnv = process.env.IP_PUBKEY;

  console.log("=".repeat(60));
  console.log("IP Accounts");
  console.log("=".repeat(60));
  console.log(`Cluster:    ${cluster}`);
  console.log(`Program ID: ${program.programId.toBase58()}`);

  // ── Single IP account lookup ──────────────────────────────────
  if (ipPubkeyEnv) {
    let ipPubkey: PublicKey;

    try {
      ipPubkey = new PublicKey(ipPubkeyEnv);
    } catch {
      console.error(`\nInvalid IP_PUBKEY: "${ipPubkeyEnv}"`);
      process.exit(1);
    }

    console.log(`\nFetching IP account: ${ipPubkey.toBase58()}`);
    console.log("-".repeat(60));

    try {
      const ip = await program.account.ipAccount.fetch(ipPubkey);
      printIpAccount(ipPubkey, ip as any, cluster);
    } catch {
      console.error(`\nNo IP account found at: ${ipPubkey.toBase58()}`);
      console.error("Verify the pubkey is a valid IpAccount PDA.");
      process.exit(1);
    }

    console.log("\n" + "=".repeat(60));
    return;
  }

  // ── All IP accounts lookup ────────────────────────────────────
  console.log("\nFetching all registered IP accounts...");
  console.log("-".repeat(60));

  const allIps = await program.account.ipAccount.all();

  if (allIps.length === 0) {
    console.log("\nNo IP accounts registered yet.");
  } else {
    console.log(`\nFound ${allIps.length} IP account(s):`);
    for (let i = 0; i < allIps.length; i++) {
      printIpAccount(allIps[i].publicKey, allIps[i].account as any, cluster, i);
    }
  }

  console.log("\n" + "=".repeat(60));
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
