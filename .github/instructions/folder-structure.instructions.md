# Mycelium IP Protocol – Canonical Folder Structure Specification

This document defines the mandatory repository layout.

No files may be placed outside the defined structure.

No additional directories may be invented.

All modules must follow this hierarchy exactly.

---

# ROOT STRUCTURE

```
mycelium-ip-protocol/
|
├── migrations/
│
├── programs/
│   └── ip_core/
│       ├── Cargo.toml
│       └── src/
│
├── tests/
│
├── migrations/
│
├── Anchor.toml
├── Cargo.toml
├── package.json
├── tsconfig.json
└── README.md
```

No alternative program names allowed.

---

# PROGRAM SOURCE STRUCTURE

```
programs/ip_core/src/
│
├── lib.rs
│
├── constants/
│   └── mod.rs
│
├── error.rs
│
├── state/
│   ├── mod.rs
│   ├── protocol_config.rs
│   ├── protocol_treasury.rs
│   ├── metadata_schema.rs
│   ├── metadata_account.rs
│   ├── entity.rs
│   ├── ip_account.rs
│   └── derivative_link.rs
│
├── instructions/
│   ├── mod.rs
│   │
│   ├── protocol/
│   │   ├── mod.rs
│   │   ├── initialize_config.rs
│   │   ├── update_config.rs
│   │   ├── initialize_treasury.rs
│   │   └── withdraw_treasury.rs
│   │
│   ├── metadata/
│   │   ├── mod.rs
│   │   ├── create_metadata_schema.rs
│   │   ├── create_entity_metadata.rs
│   │   └── create_ip_metadata.rs
│   │
│   ├── entity/
│   │   ├── mod.rs
│   │   ├── create_entity.rs
│   │   └── update_entity_controllers.rs
│   │
│   ├── ip/
│   │   ├── mod.rs
│   │   ├── create_ip.rs
│   │   └── transfer_ip.rs
│   │
│   └── derivative/
│       ├── mod.rs
│       ├── create_derivative_link.rs
│       └── update_derivative_license.rs
│
└── utils/
    ├── mod.rs
    ├── seeds.rs
    ├── validation.rs
    └── multisig.rs
```

This structure is mandatory.

---

# FILE RESPONSIBILITIES

## lib.rs

- Program entrypoint
- Declares all instruction handlers
- Re-exports instruction modules
- No business logic allowed
- No validation logic allowed
- No state definitions allowed

Only routing.

---

# constants/mod.rs

Must contain:

- MAX_SCHEMA_ID_LENGTH = 32
- MAX_VERSION_LENGTH = 16
- MAX_CID_LENGTH = 96
- MAX_HANDLE_LENGTH = 32
- MAX_CONTROLLERS = 5
- Any other global fixed limits

No dynamic sizing.

No logic.

---

# error.rs

Contains:

- Canonical error enum
- All errors defined in specification
- No logic
- No helper functions

---

# state/

Each account must:

- Be defined in its own file
- Include struct definition
- Include PDA seed documentation
- Include space calculation constant
- Include invariant comments

No instruction logic inside state files.

Each file contains exactly one account struct.

---

# instructions/

Each instruction must:

- Be defined in its own file
- Contain:
  - Context struct
  - Handler function
  - All validations
  - All state mutations
- Must not define state structs
- Must not define global constants

No instruction may modify accounts not listed in canonical spec.

---

# utils/

## seeds.rs

Contains:

- Canonical PDA derivation helper functions
- Seed arrays for:
  - config
  - treasury
  - entity
  - metadata
  - ip
  - derivative

No logic beyond deterministic seed construction.

---

## validation.rs

Contains:

- Handle validation (regex enforcement)
- Length validation helpers
- Cross-account reference validation
- Metadata revision validation

No state mutation.

---

## multisig.rs

Contains:

- Signature threshold validation
- Controller membership validation
- No account mutation

Pure validation utilities only.

---

# TEST STRUCTURE

```
tests/
│
├── protocol.test.ts
├── entity.test.ts
├── metadata.test.ts
├── ip.test.ts
└── derivative.test.ts
```

Rules:

- One domain per test file
- No mixed-domain tests
- No duplicate coverage

---

# MIGRATIONS

```
migrations/
└── deploy.ts
```

No additional migration scripts allowed.

---

# STRICT RULES

1. No circular module dependencies.
2. No instruction logic inside state/.
3. No state structs inside instructions/.
4. No validation logic inside lib.rs.
5. No dynamic account resizing.
6. No global mutable statics.
7. No implicit PDA derivation — always use canonical seed helpers.
8. All space calculations must be explicit and constant.

---

# ENTITY PDA RULE (MANDATORY)

All Entity accounts must derive using:

```
["entity", creator_pubkey, handle]
```

Where:

- handle is lowercase alphanumeric
- length ∈ [1, 32]
- stored as fixed [u8; MAX_HANDLE_LENGTH]

No alternative derivation permitted.

---

# IP PDA RULE (MANDATORY)

```
["ip", registrant_entity, content_hash]
```

No deviation permitted.

---

# DERIVATIVE PDA RULE (MANDATORY)

```
["derivative", parent_ip, child_ip]
```

No deviation permitted.

---

# METADATA PDA RULE (MANDATORY)

Entity metadata:

```
["metadata", "entity", entity_pubkey, revision]
```

IP metadata:

```
["metadata", "ip", ip_pubkey, revision]
```

No deviation permitted.
