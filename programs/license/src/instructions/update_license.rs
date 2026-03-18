use anchor_lang::prelude::*;
use ip_core::state::Entity;

use crate::constants::LICENSE_SEED;
use crate::error::LicenseError;
use crate::events::LicenseUpdated;
use crate::state::License;

/// Accounts required for update_license instruction.
#[derive(Accounts)]
pub struct UpdateLicense<'info> {
    /// The license account to update.
    #[account(
        mut,
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

    /// System program (not strictly needed but included for consistency).
    pub system_program: Program<'info, System>,
}

/// Update a license's terms.
///
/// # Arguments
/// * `ctx` - Context containing accounts
/// * `derivatives_allowed` - New value for derivatives_allowed
/// * `ip_core_program_id` - The ip_core program ID for validation
///
/// # Errors
/// * `LicenseError::Unauthorized` - Controller signature mismatch
/// * `LicenseError::InvalidAuthority` - Authority entity doesn't match license authority
///
/// # Note
/// Only `derivatives_allowed` may be updated. Other fields are immutable.
pub fn handler(
    ctx: Context<UpdateLicense>,
    derivatives_allowed: bool,
    ip_core_program_id: Pubkey,
) -> Result<()> {
    let authority_entity = &ctx.accounts.authority_entity;

    // Validate authority entity is owned by ip_core
    if authority_entity.to_account_info().owner != &ip_core_program_id {
        return Err(LicenseError::InvalidAuthority.into());
    }

    // Update license (only derivatives_allowed is mutable)
    let license = &mut ctx.accounts.license;
    let old_derivatives_allowed = license.derivatives_allowed;
    license.derivatives_allowed = derivatives_allowed;

    emit!(LicenseUpdated {
        license: license.key(),
        origin_ip: license.origin_ip,
        authority: authority_entity.key(),
        old_derivatives_allowed,
        new_derivatives_allowed: derivatives_allowed,
    });

    msg!(
        "License updated: derivatives_allowed = {}",
        derivatives_allowed
    );

    Ok(())
}
