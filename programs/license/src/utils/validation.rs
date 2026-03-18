use anchor_lang::prelude::*;

use crate::error::LicenseError;

/// Validates that an account is owned by the expected program.
///
/// # Arguments
/// * `account` - The account to check
/// * `expected_owner` - The expected owner program ID
///
/// # Returns
/// * `Ok(())` if owner matches
/// * `Err` if owner doesn't match
pub fn validate_account_owner(account: &AccountInfo<'_>, expected_owner: &Pubkey) -> Result<()> {
    if account.owner != expected_owner {
        return Err(LicenseError::InvalidOriginIp.into());
    }
    Ok(())
}
