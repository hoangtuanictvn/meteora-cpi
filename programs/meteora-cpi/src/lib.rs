use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount, Transfer as TokenTransfer},
};
use anchor_lang::system_program::Transfer as NativeSolTransfer;
use dynamic_amm::instructions::CustomizableParams;
pub const POOL_SIZE: usize = 8 + 944;

declare_id!("DA3yHByryquEJo2g3mFgo2UMJoewwsddadb3E5tNEatr");

#[program]
pub mod meteora_cpi {
    use super::*;

    pub fn init(
        ctx: Context<Initialize>,
    ) -> Result<()> {
        Ok(())
    }

    pub fn create_lp(
       ctx: Context<CreateLP>,
       token_a_amount: u64,
       token_b_amount: u64,
       params: CustomizableParams
    ) -> Result<()> {
        fund_creator_authority(
            token_a_amount,
            token_b_amount,
            FundCreatorAuthorityAccounts {
                creator_token_a: &ctx.accounts.creator_token_a,
                creator_token_b: &ctx.accounts.creator_token_b,
                payer_token_a: &ctx.accounts.payer_token_a.to_account_info(),
                payer_token_b: &ctx.accounts.payer_token_b.to_account_info(),
                token_program: &ctx.accounts.token_program,
                payer: &ctx.accounts.payer,
                system_program: &ctx.accounts.system_program,
                creator_authority: &ctx.accounts.authority,
            },
        )?;

        let accounts =
          dynamic_amm::cpi::accounts::InitializeCustomizablePermissionlessConstantProductPool {
              pool: ctx.accounts.pool.to_account_info(),
              token_a_mint: ctx.accounts.token_a_mint.to_account_info(),
              token_b_mint: ctx.accounts.token_b_mint.to_account_info(),
              a_vault: ctx.accounts.a_vault.to_account_info(),
              b_vault: ctx.accounts.b_vault.to_account_info(),
              a_token_vault: ctx.accounts.a_token_vault.to_account_info(),
              b_token_vault: ctx.accounts.b_token_vault.to_account_info(),
              a_vault_lp_mint: ctx.accounts.a_vault_lp_mint.to_account_info(),
              b_vault_lp_mint: ctx.accounts.b_vault_lp_mint.to_account_info(),
              a_vault_lp: ctx.accounts.a_vault_lp.to_account_info(),
              b_vault_lp: ctx.accounts.b_vault_lp.to_account_info(),
              payer_token_a: ctx.accounts.creator_token_a.to_account_info(),
              payer_token_b: ctx.accounts.creator_token_b.to_account_info(),
              payer_pool_lp: ctx.accounts.creator_pool_lp.to_account_info(),
              protocol_token_a_fee: ctx.accounts.protocol_token_a_fee.to_account_info(),
              protocol_token_b_fee: ctx.accounts.protocol_token_b_fee.to_account_info(),
              payer: ctx.accounts.authority.to_account_info(),
              rent: ctx.accounts.rent.to_account_info(),
              mint_metadata: ctx.accounts.mint_metadata.to_account_info(),
              metadata_program: ctx.accounts.metadata_program.to_account_info(),
              vault_program: ctx.accounts.vault_program.to_account_info(),
              token_program: ctx.accounts.token_program.to_account_info(),
              associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
              lp_mint: ctx.accounts.lp_mint.to_account_info(),
              system_program: ctx.accounts.system_program.to_account_info(),
          };

        let seeds = [
            b"creator".as_ref(),
            &[ctx.bumps.authority],
        ];

        let signer_seeds = &[&seeds[..]];

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.dynamic_amm_program.to_account_info(),
            accounts,
            signer_seeds,
        );

        dynamic_amm::cpi::initialize_customizable_permissionless_constant_product_pool(
            cpi_context,
            token_a_amount,
            token_b_amount,
            params,
        )
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    vault: SystemAccount<'info>,

    /// CHECK: System program.
    pub system_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CreateLP<'info> {

    /// CHECK: Creator authority
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub authority: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        associated_token::mint = token_a_mint,
        associated_token::authority = authority,
        payer = payer
    )]
    pub creator_token_a: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        associated_token::mint = token_b_mint,
        associated_token::authority = authority,
        payer = payer
    )]
    pub creator_token_b: Box<Account<'info, TokenAccount>>,

    /// CHECK: Pool account (PDA)
    #[account(mut)]
    pub pool: UncheckedAccount<'info>,

    /// CHECK: LP token mint of the pool
    #[account(mut)]
    pub lp_mint: UncheckedAccount<'info>,

    /// CHECK: Token A mint of the pool. Eg: USDT
    pub token_a_mint: Box<Account<'info, Mint>>,

    /// CHECK: Token B mint of the pool. Eg: USDC
    pub token_b_mint: Box<Account<'info, Mint>>,

    /// CHECK: Vault account for token A. Token A of the pool will be deposit / withdraw from this vault account.
    #[account(mut)]
    pub a_vault: AccountInfo<'info>,

    #[account(mut)]
    /// CHECK: Vault account for token B. Token B of the pool will be deposit / withdraw from this vault account.
    pub b_vault: AccountInfo<'info>,

    #[account(mut)]
    /// CHECK: Token vault account of vault A
    pub a_token_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    /// CHECK: Token vault account of vault B
    pub b_token_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    /// CHECK: LP token mint of vault A
    pub a_vault_lp_mint: Box<Account<'info, Mint>>,

    #[account(mut)]
    /// CHECK: LP token mint of vault B
    pub b_vault_lp_mint: Box<Account<'info, Mint>>,

    /// CHECK: LP token account of vault A. Used to receive/burn the vault LP upon deposit/withdraw from the vault.
    #[account(mut)]
    pub a_vault_lp: UncheckedAccount<'info>,

    /// CHECK: LP token account of vault B. Used to receive/burn vault LP upon deposit/withdraw from the vault.
    #[account(mut)]
    pub b_vault_lp: UncheckedAccount<'info>,

    #[account(mut)]
    /// CHECK: Payer token account for pool token A mint. Used to bootstrap the pool with initial liquidity.
    pub payer_token_a: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    /// CHECK: Admin token account for pool token B mint. Used to bootstrap the pool with initial liquidity.
    pub payer_token_b: Box<Account<'info, TokenAccount>>,

    /// CHECK: Creator pool LP token account. Used to receive LP during first deposit (initialize pool). Creator is a PDA.
    #[account(mut)]
    pub creator_pool_lp: UncheckedAccount<'info>,

    #[account(mut)]
    /// CHECK: Protocol fee token account for token A. Used to receive trading fee.
    pub protocol_token_a_fee: UncheckedAccount<'info>,

    /// CHECK: Protocol fee token account for token B. Used to receive trading fee.
    #[account(mut)]
    pub protocol_token_b_fee: UncheckedAccount<'info>,

    /// CHECK: Payer account. This account will be the creator of the pool, and the payer for PDA during initialize pool.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Rent account.
    pub rent: Sysvar<'info, Rent>,

    /// CHECK: LP mint metadata PDA. Metaplex do the checking.
    #[account(mut)]
    pub mint_metadata: UncheckedAccount<'info>,

    /// CHECK: Metadata program
    pub metadata_program: UncheckedAccount<'info>,

    /// CHECK: Vault program. The pool will deposit/withdraw liquidity from the vault.
    pub vault_program: UncheckedAccount<'info>,
    /// Token program.
    pub token_program: Program<'info, Token>,
    /// Associated token program.
    pub associated_token_program: Program<'info, AssociatedToken>,
    /// System program.
    pub system_program: Program<'info, System>,

    /// CHECK: Dynamic AMM program
    #[account(address = dynamic_amm::ID)]
    pub dynamic_amm_program: UncheckedAccount<'info>,
}

pub struct FundCreatorAuthorityAccounts<'b, 'info> {
    pub creator_token_a: &'b Account<'info, TokenAccount>,
    pub creator_token_b: &'b Account<'info, TokenAccount>,
    pub payer_token_a: &'b AccountInfo<'info>,
    pub payer_token_b: &'b AccountInfo<'info>,
    pub token_program: &'b Program<'info, Token>,
    pub payer: &'b Signer<'info>,
    pub system_program: &'b Program<'info, System>,
    pub creator_authority: &'b AccountInfo<'info>,
}

pub fn fund_creator_authority<'b, 'info>(
    token_a_amount: u64,
    token_b_amount: u64,
    accounts: FundCreatorAuthorityAccounts<'b, 'info>,
) -> Result<()> {
    let FundCreatorAuthorityAccounts {
        creator_token_a,
        creator_token_b,
        payer_token_a,
        payer_token_b,
        token_program,
        payer,
        system_program,
        creator_authority,
    } = accounts;

    // Fund creator PDA with token A and token B
    if token_a_amount > creator_token_a.amount {
        let amount = token_a_amount - creator_token_a.amount;
        anchor_spl::token::transfer(
            CpiContext::new(
                token_program.to_account_info(),
                TokenTransfer {
                    from: payer_token_a.to_account_info(),
                    to: creator_token_a.to_account_info(),
                    authority: payer.to_account_info(),
                },
            ),
            amount,
        )?;
    }

    if token_b_amount > creator_token_b.amount {
        let amount = token_b_amount - creator_token_b.amount;
        anchor_spl::token::transfer(
            CpiContext::new(
                token_program.to_account_info(),
                TokenTransfer {
                    from: payer_token_b.to_account_info(),
                    to: creator_token_b.to_account_info(),
                    authority: payer.to_account_info(),
                },
            ),
            amount,
        )?;
    }

    // Fund creator PDA with SOL to pay for account rental
    let mut lamports: u64 = 0;

    // Pool
    lamports += Rent::get()?.minimum_balance(POOL_SIZE);
    // LP mint
    lamports += Rent::get()?.minimum_balance(Mint::LEN);
    //  a_vault_lp + b_vault_lp + creator LP ATA + protocol fee A + protocol fee B
    let token_account_lamports = Rent::get()?.minimum_balance(TokenAccount::LEN);
    lamports += token_account_lamports * 5;
    // LP mint Metadata
    lamports += Rent::get()?.minimum_balance(679);
    // Metaplex fee ...
    lamports += 10_000_000;

    msg!("Required lamports: {}", lamports);

    anchor_lang::system_program::transfer(
        CpiContext::new(
            system_program.to_account_info(),
            NativeSolTransfer {
                from: payer.to_account_info(),
                to: creator_authority.to_account_info(),
            },
        ),
        // Weird bug in bpf, more lamport causes failure. The calculated lamports above should be the correct one
        // lamports,
        34290400,
    )?;

    Ok(())
}
