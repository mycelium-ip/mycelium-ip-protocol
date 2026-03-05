## Plan: ip_core Program Full Implementation

**TL;DR:** Implement the complete Mycelium IP Protocol core registry from scratch. The program requires 7 state accounts, 13 instructions across 5 domains (protocol, entity, metadata, IP, derivative), utility modules for PDA seeds/validation/multisig, and an error model. Implementation follows strict deterministic design—no royalties, no governance, no dynamic sizing. Dependencies need `anchor-spl` for SPL token transfers.

---

**Steps**

### Phase 1: Foundation Layer

1. **Add dependency** in [Cargo.toml](programs/ip_core/Cargo.toml): add `anchor-spl = "0.32.1"` for SPL token operations required by treasury instructions

2. **Create** [constants/mod.rs](programs/ip_core/src/constants/mod.rs): Define fixed limits:

   - `MAX_SCHEMA_ID_LENGTH = 32`
   - `MAX_VERSION_LENGTH = 16`
   - `MAX_CID_LENGTH = 96`
   - `MAX_HANDLE_LENGTH = 32`
   - `MAX_CONTROLLERS = 5`

3. **Create** [error.rs](programs/ip_core/src/error.rs): Define canonical `IpCoreError` enum with all 18 error variants (ConfigAlreadyInitialized, TreasuryAlreadyInitialized, Unauthorized, InvalidAuthority, InvalidThreshold, ControllerLimitExceeded, ControllerNotFound, InsufficientSignatures, EntityNotInitialized, InvalidHandle, HandleTooLong, HandleAlreadyExists, MetadataSchemaNotFound, InvalidMetadataRevision, IPAlreadyExists, InvalidOwnership, DerivativeAlreadyExists, ArithmeticOverflow)

4. **Create** [utils/seeds.rs](programs/ip_core/src/utils/seeds.rs): PDA derivation helpers for all account types:

   - `config_seeds()` → `["config"]`
   - `treasury_seeds()` → `["treasury"]`
   - `entity_seeds(creator, handle)` → `["entity", creator, handle]`
   - `metadata_schema_seeds(schema_id, version)` → `["metadata_schema", id, version]`
   - `metadata_entity_seeds(entity, revision)` → `["metadata", "entity", entity, revision]`
   - `metadata_ip_seeds(ip, revision)` → `["metadata", "ip", ip, revision]`
   - `ip_seeds(registrant_entity, content_hash)` → `["ip", entity, hash]`
   - `derivative_seeds(parent_ip, child_ip)` → `["derivative", parent, child]`

5. **Create** [utils/validation.rs](programs/ip_core/src/utils/validation.rs): Pure validation helpers:

   - `validate_handle(handle: &[u8])` → lowercase alphanumeric with underscores, 1-32 chars, regex `^[a-z0-9_]{1,32}$`
   - `validate_cid_not_empty(cid: &[u8])`
   - `validate_revision_increment(current, expected)`

6. **Create** [utils/multisig.rs](programs/ip_core/src/utils/multisig.rs): Multisig validation:

   - `validate_multisig(signers: &[Signer], controllers: &[Pubkey], threshold: u8)` → check signer count ≥ threshold, all signers in controllers

7. **Create** [utils/mod.rs](programs/ip_core/src/utils/mod.rs): Re-export submodules

---

### Phase 2: State Account Definitions

8. **Create** [state/protocol_config.rs](programs/ip_core/src/state/protocol_config.rs):

   - Seeds: `["config"]`
   - Fields: `authority`, `treasury`, `registration_currency`, `registration_fee`, `bump`
   - Space constant: `8 + 32 + 32 + 32 + 8 + 1 = 113`

9. **Create** [state/protocol_treasury.rs](programs/ip_core/src/state/protocol_treasury.rs):

   - Seeds: `["treasury"]`
   - Fields: `authority`, `config`, `bump`
   - Space constant: `8 + 32 + 32 + 1 = 73`

10. **Create** [state/metadata_schema.rs](programs/ip_core/src/state/metadata_schema.rs):

    - Seeds: `["metadata_schema", schema_id, version]`
    - Fields: `id` (32), `version` (16), `hash` (32), `cid` (96), `creator`, `created_at`, `bump`
    - Space constant: `8 + 32 + 16 + 32 + 96 + 32 + 8 + 1 = 225`

11. **Create** [state/metadata_account.rs](programs/ip_core/src/state/metadata_account.rs):

    - Entity seeds: `["metadata", "entity", entity, revision]`
    - IP seeds: `["metadata", "ip", ip, revision]`
    - Define `MetadataParentType` enum (Entity, IP)
    - Fields: `schema`, `hash` (32), `cid` (96), `parent_type`, `parent`, `revision`, `created_at`, `bump`

12. **Create** [state/entity.rs](programs/ip_core/src/state/entity.rs):

    - Seeds: `["entity", creator, handle]`
    - Fields: `creator`, `handle` (32), `controllers` (Vec with 4+5\*32 sizing), `signature_threshold`, `current_metadata_revision`, `created_at`, `updated_at`, `bump`
    - Space: `8 + 32 + 32 + (4 + 5*32) + 1 + 8 + 8 + 8 + 1 = 262`

13. **Create** [state/ip_account.rs](programs/ip_core/src/state/ip_account.rs):

    - Seeds: `["ip", registrant_entity, content_hash]`
    - Fields: `content_hash` (32), `registrant_entity`, `current_owner_entity`, `current_metadata_revision`, `created_at`, `bump`
    - Space: `8 + 32 + 32 + 32 + 8 + 8 + 1 = 121`

14. **Create** [state/derivative_link.rs](programs/ip_core/src/state/derivative_link.rs):

    - Seeds: `["derivative", parent_ip, child_ip]`
    - Fields: `parent_ip`, `child_ip`, `license`, `created_at`, `bump`
    - Space: `8 + 32 + 32 + 32 + 8 + 1 = 113`

15. **Create** [state/mod.rs](programs/ip_core/src/state/mod.rs): Re-export all state structs

---

### Phase 3: Protocol Instructions

16. **Create** [instructions/protocol/initialize_config.rs](programs/ip_core/src/instructions/protocol/initialize_config.rs):

    - Context: `config` (init PDA), `authority` (signer), `system_program`
    - Validates: config not already initialized (Anchor handles)
    - Sets initial authority, treasury, currency, fee

17. **Create** [instructions/protocol/update_config.rs](programs/ip_core/src/instructions/protocol/update_config.rs):

    - Context: `config` (mut), `authority` (signer)
    - Requires: `authority == config.authority`
    - Mutates: authority, treasury, registration_currency, registration_fee
    - Validates treasury PDA

18. **Create** [instructions/protocol/initialize_treasury.rs](programs/ip_core/src/instructions/protocol/initialize_treasury.rs):

    - Context: `treasury` (init PDA), `config`, `authority` (signer), `system_program`
    - Validates: config exists, treasury not initialized
    - Sets authority, config reference

19. **Create** [instructions/protocol/withdraw_treasury.rs](programs/ip_core/src/instructions/protocol/withdraw_treasury.rs):

    - Context: `treasury`, `treasury_token_account`, `destination_token_account`, `authority` (signer), `token_program`
    - SPL token transfer using treasury PDA as authority (needs anchor-spl)
    - Does NOT mutate treasury struct

20. **Create** [instructions/protocol/mod.rs](programs/ip_core/src/instructions/protocol/mod.rs): Re-export

---

### Phase 4: Entity Instructions

21. **Create** [instructions/entity/create_entity.rs](programs/ip_core/src/instructions/entity/create_entity.rs):

    - Context: `entity` (init PDA with seeds `["entity", creator, handle]`), `creator` (signer), `config`, `system_program`
    - Validates: handle format (lowercase alphanumeric, 1-32), threshold ∈ [1, len(controllers)]
    - Initializes with creator as first controller, metadata_revision=0

22. **Create** [instructions/entity/update_entity_controllers.rs](programs/ip_core/src/instructions/entity/update_entity_controllers.rs):

    - Context: `entity` (mut), controllers signers (remaining accounts)
    - Validates: multisig threshold met, cannot remove creator, cannot exceed MAX_CONTROLLERS
    - Parameters: action (add/remove), controller pubkey, optional new threshold
    - Updates `updated_at`

23. **Create** [instructions/entity/mod.rs](programs/ip_core/src/instructions/entity/mod.rs): Re-export

---

### Phase 5: Metadata Instructions

24. **Create** [instructions/metadata/create_metadata_schema.rs](programs/ip_core/src/instructions/metadata/create_metadata_schema.rs):

    - Context: `metadata_schema` (init PDA with seeds `["metadata_schema", id, version]`), `creator` (signer), `system_program`
    - Validates: cid not empty
    - Schema is immutable after creation

25. **Create** [instructions/metadata/create_entity_metadata.rs](programs/ip_core/src/instructions/metadata/create_entity_metadata.rs):

    - Context: `metadata` (init PDA), `entity` (mut for revision), `schema`, signers
    - Validates: multisig, schema exists, revision = current + 1
    - Increments `entity.current_metadata_revision` using `checked_add`

26. **Create** [instructions/metadata/create_ip_metadata.rs](programs/ip_core/src/instructions/metadata/create_ip_metadata.rs):

    - Context: `metadata` (init PDA), `ip` (mut), `owner_entity`, `schema`, signers
    - Validates: owner multisig, schema exists, revision = current + 1
    - Increments `ip.current_metadata_revision`

27. **Create** [instructions/metadata/mod.rs](programs/ip_core/src/instructions/metadata/mod.rs): Re-export

---

### Phase 6: IP Instructions

28. **Create** [instructions/ip/create_ip.rs](programs/ip_core/src/instructions/ip/create_ip.rs):

    - Context: `ip` (init PDA with `["ip", entity, hash]`), `registrant_entity`, `config`, `treasury`, `treasury_token_account`, `payer_token_account`, `payer` (signer), `token_program`, `system_program`, remaining accounts for multisig
    - Validates: entity multisig, token account mints match config.registration_currency, treasury authority
    - **Payment enforcement**: Transfer `config.registration_fee` from payer to treasury token account BEFORE init
    - Initializes: `current_owner_entity = registrant_entity`, `revision = 0`

29. **Create** [instructions/ip/transfer_ip.rs](programs/ip_core/src/instructions/ip/transfer_ip.rs):

    - Context: `ip` (mut), `current_owner_entity`, `new_owner_entity`, signers
    - Validates: multisig of current owner
    - Mutates ONLY: `current_owner_entity`
    - Must NOT touch: content_hash, registrant_entity, metadata_revision, created_at

30. **Create** [instructions/ip/mod.rs](programs/ip_core/src/instructions/ip/mod.rs): Re-export

---

### Phase 7: Derivative Instructions

31. **Create** [instructions/derivative/create_derivative_link.rs](programs/ip_core/src/instructions/derivative/create_derivative_link.rs):

    - Context: `derivative_link` (init PDA), `parent_ip`, `child_ip`, `child_owner_entity`, `license`, signers
    - Validates: both IPs exist, child owner multisig, license validation (owner = LICENSE_PROGRAM_ID, origin_ip = parent, derivatives_allowed = true, check expiration)
    - Initialize link

32. **Create** [instructions/derivative/update_derivative_license.rs](programs/ip_core/src/instructions/derivative/update_derivative_license.rs):

    - Context: `derivative_link` (mut), `child_ip`, `child_owner_entity`, `new_license`, signers
    - Validates: child owner multisig, new license validity
    - Mutates ONLY: `license` field

33. **Create** [instructions/derivative/mod.rs](programs/ip_core/src/instructions/derivative/mod.rs): Re-export

---

### Phase 8: Wiring & Entrypoint

34. **Create** [instructions/mod.rs](programs/ip_core/src/instructions/mod.rs): Re-export all instruction submodules

35. **Update** [lib.rs](programs/ip_core/src/lib.rs):
    - Remove placeholder `initialize`
    - Declare all 13 instruction handlers via `#[program]` module
    - Wire each handler to its context and function
    - Re-export `mod constants`, `mod error`, `mod state`, `mod instructions`, `mod utils`

---

### Phase 9: Testing

36. **Create** [tests/protocol.test.ts](tests/protocol.test.ts): Test initialize_config, update_config, initialize_treasury, withdraw_treasury

37. **Create** [tests/entity.test.ts](tests/entity.test.ts): Test create_entity, update_entity_controllers, handle validation, multisig edge cases

38. **Create** [tests/metadata.test.ts](tests/metadata.test.ts): Test schema creation, entity metadata, IP metadata, revision increments

39. **Create** [tests/ip.test.ts](tests/ip.test.ts): Test create_ip with payment, transfer_ip, deterministic PDA validation

40. **Create** [tests/derivative.test.ts](tests/derivative.test.ts): Test derivative link creation, license validation, license updates

---

**Verification**

- `anchor build` — compiles without warnings
- `anchor test` — all test suites pass
- `cargo clippy` — no lints
- Manual: verify PDA derivation is fully deterministic (no randomness, no counters)
- Manual: verify no royalty/governance/economic logic leaked into ip_core

---

**Decisions**

- **Dependency**: Adding `anchor-spl` is required for SPL token transfers in treasury and IP registration
- **License validation**: The external `LICENSE_PROGRAM_ID` must be defined as a constant (placeholder until dispute/licensing program exists)
- **Multisig pattern**: Using remaining accounts for variable signers, validated against controller list
- **Vec sizing**: Entity controllers use bounded Vec with explicit size `4 + MAX_CONTROLLERS * 32`
