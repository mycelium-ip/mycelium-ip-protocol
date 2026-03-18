use anchor_lang::prelude::*;
use ip_core::state::Entity;

use crate::constants::{LICENSE_GRANT_SEED, LICENSE_SEED};
use crate::error::LicenseError;
use crate::events::LicenseGrantRevoked;
use crate::state::{License, LicenseGrant};

/// Accounts required for revoke_license_grant instruction.
#[derive(Accounts)]
pub struct RevokeLicenseGrant<'info> {
    /// The license grant account to close.
    #[account(
        mut,
        seeds = [LICENSE_GRANT_SEED, license.key().as_ref(), license_grant.grantee.as_ref()],
        bump = license_grant.bump,
        constraint = license_grant.license == license.key() @ LicenseError::InvalidLicense,
        close = rent_destination
    )]
    pub license_grant: Account<'info, LicenseGrant>,

    /// The license this grant is for.
    #[account(
        seeds = [LICENSE_SEED, license.origin_ip.as_ref()],
        bump = license.bump,
        constraint = license.authority == authority_entity.key() @ LicenseError::InvalidAuthority
    )]
    pub license: Account<'info, License>,

    /// The authority entity (must match license.authority).
    pub authority_entity: Account<'info, Entity>,

    /// The entity controller (must match authority_entity.controller).
    #[account(
        constraint = controller.key() == authority_entity.controller @ LicenseError::Unauthorized
    )]
    pub controller: Signer<'info>,

    /// Destination for rent refund.
    /// CHECK: This is just the recipient of lamports.
    #[account(mut)]
    pub rent_destination: UncheckedAccount<'info>,

    /// System program.
    pub system_program: Program<'info, System>,
}

/// Revoke a license grant by closing its account.
///
/// # Arguments
/// * `ctx` - Context containing accounts
/// * `ip_core_program_id` - The ip_core program ID for validation
///
/// # Errors
/// * `LicenseError::Unauthorized` - Controller signature mismatch
/// * `LicenseError::InvalidAuthority` - Authority entity doesn't match license authority
///
/// # Note
/// This instruction closes the license grant account and returns rent to rent_destination.
/// Grantee consent is NOT required.
pub fn handler(ctx: Context<RevokeLicenseGrant>, ip_core_program_id: Pubkey) -> Result<()> {
    let authority_entity = &ctx.accounts.authority_entity;

    // Validate authority entity is owned by ip_core
    if authority_entity.to_account_info().owner != &ip_core_program_id {
        return Err(LicenseError::InvalidAuthority.into());
    }

    // Emit event BEFORE the account is closed (close happens after handler returns)
    emit!(LicenseGrantRevoked {
        license_grant: ctx.accounts.license_grant.key(),
        license: ctx.accounts.license.key(),
        grantee: ctx.accounts.license_grant.grantee,
        authority: authority_entity.key(),
        rent_destination: ctx.accounts.rent_destination.key(),
    });

    msg!(
        "License grant revoked for grantee: {:?}",
        ctx.accounts.license_grant.grantee
    );

    Ok(())
}
