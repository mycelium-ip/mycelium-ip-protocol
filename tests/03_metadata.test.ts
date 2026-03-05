import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { IpCore } from "../target/types/ip_core";
import { Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import * as crypto from "crypto";
import entitySchemaJson from "./utils/metadata_schema/entity.metadata.v1.json";
import ipSchemaJson from "./utils/metadata_schema/ip.metadata.v1.json";

describe("ip_core metadata", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.IpCore as Program<IpCore>;
  const creator = provider.wallet as anchor.Wallet;

  // Helper to pad bytes
  const padBytes = (data: string, length: number): number[] => {
    const bytes = Buffer.from(data);
    const padded = Buffer.alloc(length);
    bytes.copy(padded);
    return Array.from(padded);
  };

  const padHandle = (handle: string): number[] => padBytes(handle, 32);
  const padSchemaId = (id: string): number[] => padBytes(id, 32);
  const padVersion = (version: string): number[] => padBytes(version, 16);
  const padCid = (cid: string): number[] => padBytes(cid, 96);
  const randomHash = (): number[] =>
    Array.from(Keypair.generate().publicKey.toBytes());

  // Hash schema JSON using SHA-256
  const hashSchema = (schema: object): number[] => {
    const json = JSON.stringify(schema);
    const hash = crypto.createHash("sha256").update(json).digest();
    return Array.from(hash);
  };

  describe("create_metadata_schema", () => {
    it("creates a metadata schema", async () => {
      const schemaId = padSchemaId(entitySchemaJson.schema.schema_id);
      const version = padVersion(entitySchemaJson.schema.version);
      const hash = hashSchema(entitySchemaJson.schema);
      const cid = padCid(entitySchemaJson.cid);

      const [schemaPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata_schema"),
          Buffer.from(schemaId),
          Buffer.from(version),
        ],
        program.programId,
      );

      await program.methods
        .createMetadataSchema(schemaId, version, hash, cid)
        .rpc();

      const schema = await program.account.metadataSchema.fetch(schemaPda);
      expect(schema.creator.toString()).to.equal(creator.publicKey.toString());
      expect(schema.createdAt.toNumber()).to.be.greaterThan(0);
    });

    it("fails with empty CID", async () => {
      const schemaId = padSchemaId("empty-cid-schema");
      const version = padVersion("1.0.0");
      const hash = randomHash();
      const cid = Array(96).fill(0); // Empty CID

      const [schemaPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata_schema"),
          Buffer.from(schemaId),
          Buffer.from(version),
        ],
        program.programId,
      );

      try {
        await program.methods
          .createMetadataSchema(schemaId, version, hash, cid)
          .rpc();
        expect.fail("Should have failed");
      } catch (err) {
        expect(err.toString()).to.include("EmptyCid");
      }
    });
  });

  describe("create_entity_metadata", () => {
    let entityPda: PublicKey;
    let schemaPda: PublicKey;
    const handle = padHandle("metadataentity");

    before(async () => {
      // Create entity
      [entityPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("entity"),
          creator.publicKey.toBuffer(),
          Buffer.from(handle),
        ],
        program.programId,
      );

      await program.methods.createEntity(handle, [], 1).rpc();

      // Create schema using IP metadata schema
      const schemaId = padSchemaId(ipSchemaJson.schema.schema_id);
      const version = padVersion(ipSchemaJson.schema.version);
      const hash = hashSchema(ipSchemaJson.schema);
      const cid = padCid(ipSchemaJson.cid);

      [schemaPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata_schema"),
          Buffer.from(schemaId),
          Buffer.from(version),
        ],
        program.programId,
      );

      await program.methods
        .createMetadataSchema(schemaId, version, hash, cid)
        .rpc();
    });

    it("creates entity metadata", async () => {
      const revision = new anchor.BN(1);
      const hash = randomHash();
      const cid = padCid("QmEntityMetadata1");

      const revisionBytes = revision.toArrayLike(Buffer, "le", 8);
      const [metadataPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          Buffer.from("entity"),
          entityPda.toBuffer(),
          revisionBytes,
        ],
        program.programId,
      );

      await program.methods
        .createEntityMetadata(revision, hash, cid)
        .accounts({
          entity: entityPda,
          schema: schemaPda,
        })
        .remainingAccounts([
          { pubkey: creator.publicKey, isSigner: true, isWritable: false },
        ])
        .rpc();

      const metadata = await program.account.metadataAccount.fetch(metadataPda);
      expect(metadata.revision.toNumber()).to.equal(1);
      expect(metadata.parent.toString()).to.equal(entityPda.toString());
    });

    it("fails with invalid revision", async () => {
      const revision = new anchor.BN(5); // Should be 2, not 5
      const hash = randomHash();
      const cid = padCid("QmInvalidRevision");

      const revisionBytes = revision.toArrayLike(Buffer, "le", 8);
      const [metadataPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          Buffer.from("entity"),
          entityPda.toBuffer(),
          revisionBytes,
        ],
        program.programId,
      );

      try {
        await program.methods
          .createEntityMetadata(revision, hash, cid)
          .accounts({
            entity: entityPda,
            schema: schemaPda,
          })
          .remainingAccounts([
            { pubkey: creator.publicKey, isSigner: true, isWritable: false },
          ])
          .rpc();
        expect.fail("Should have failed");
      } catch (err) {
        expect(err.toString()).to.include("InvalidMetadataRevision");
      }
    });
  });
});
