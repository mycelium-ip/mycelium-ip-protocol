use anchor_lang::prelude::*;

declare_id!("35pP3zCsTgs5EQ7UjMruosGyUKNoNuyYYoE7RY14VPH5");

#[program]
pub mod ip_core {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
