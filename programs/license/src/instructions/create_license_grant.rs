use anchor_lang::prelude::*;
use ip_core::state::Entity;

use crate::constants::{LICENSE_GRANT_SEED, LICENSE_SEED};
use crate::error::LicenseError;
use crate::events::LicenseGrantCreated;
use crate::state::{License, LicenseGrant, LICENSE_GRANT_SIZE};

/// Accounts required for create_license_grant instruction.
#[derive(Accounts)]
pub struct CreateLicenseGrant<'info> {
    /// The license grant account to create (PDA).
    #[account(
        init,
        payer = payer,
        space = LICENSE_GRANT_SIZE,
        seeds = [LICENSE_GRANT_SEED, license.key().as_ref(), grantee_entity.key().as_ref()],
        bump
    )]
    pub license_grant: Account<'info, LicenseGrant>,

    /// The license to grant.
    #[account(
        seeds = [LICENSE_SEED, license.origin_ip.as_ref()],
        bump = license.bump,
        constraint = license.authority == authority_entity.key() @ LicenseError::InvalidAuthority
    )]
    pub license: Account<'info, License>,

    /// The authority entity (must match license.authority).
    /// This is the IP owner who grants licenses.
    pub authority_entity: Account<'info, Entity>,

    /// The entity controller (must match authority_entity.controller).
    #[account(
        constraint = controller.key() == authority_entity.controller @ LicenseError::Unauthorized
    )]
    pub controller: Signer<'info>,

    /// The grantee entity receiving the license.
    pub grantee_entity: Account<'info, Entity>,

    /// Payer for account creation.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// System program for account creation.
    pub system_program: Program<'info, System>,
}

/// Create a license grant for a grantee entity.
///
/// # Arguments
/// * `ctx` - Context containing accounts
/// * `expiration` - Expiration timestamp (0 = no expiration)
/// * `ip_core_program_id` - The ip_core program ID for validation
///
/// # Errors
/// * `LicenseError::Unauthorized` - Controller signature mismatch
/// * `LicenseError::InvalidAuthority` - Authority entity doesn't match license authority
/// * `LicenseError::InvalidGrantee` - Grantee is not a valid entity
pub fn handler(
    ctx: Context<CreateLicenseGrant>,
    expiration: i64,
    ip_core_program_id: Pubkey,
) -> Result<()> {
    let authority_entity = &ctx.accounts.authority_entity;
    let grantee_entity = &ctx.accounts.grantee_entity;
    let license = &ctx.accounts.license;

    // Validate authority entity is owned by ip_core
    if authority_entity.to_account_info().owner != &ip_core_program_id {
        return Err(LicenseError::InvalidAuthority.into());
    }

    // Validate grantee entity is owned by ip_core
    if grantee_entity.to_account_info().owner != &ip_core_program_id {
        return Err(LicenseError::InvalidGrantee.into());
    }

    // Get current timestamp
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;

    // Initialize license grant
    let grant = &mut ctx.accounts.license_grant;
    grant.license = license.key();
    grant.grantee = grantee_entity.key();
    grant.granted_at = now;
    grant.expiration = expiration;
    grant.bump = ctx.bumps.license_grant;

    emit!(LicenseGrantCreated {
        license_grant: ctx.accounts.license_grant.key(),
        license: license.key(),
        grantee: grantee_entity.key(),
        expiration,
        granted_at: now,
    });

    msg!(
        "License grant created for grantee: {:?}, expiration: {}",
        grantee_entity.key(),
        if expiration == 0 {
            "never".to_string()
        } else {
            expiration.to_string()
        }
    );

    Ok(())
}
