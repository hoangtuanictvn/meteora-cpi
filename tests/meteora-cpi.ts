import * as anchor from "@coral-xyz/anchor";
import IDL from '../target/idl/meteora_cpi.json';
import {
  AddressLookupTableProgram,
  ComputeBudgetProgram, Connection,
  Keypair,
  PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction, TransactionMessage, VersionedTransaction
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID
} from "@solana/spl-token";

import feePayerKP from '../public/fee-payer-pk.5qAqQ5nuhrHwD2BH8baBTQAUZ3MbfGoiyuTkmXBVVZ5T.json';
import tokenAKP from '../public/token-A-pk.3yCJrDbY5Cmw3sohbV3XnqDS6TyATgB9s1MDKuacZxjy.json';
import tokenBKP from '../public/token-B-pk.FsJP76e3dBBKpjEnDFYduQKmVKPnpuGh1YCcY1CaroZr.json';
import {BN, Idl, Program} from '@coral-xyz/anchor';

import { Program as Anchor30Program } from 'switchboard-anchor';

import {METAPLEX_PROGRAM, SEEDS} from "@meteora-ag/dynamic-amm-sdk/dist/cjs/src/amm/constants";
import { SEEDS as VSEEDS} from "@meteora-ag/vault-sdk/dist/cjs/src/vault/constants";
import {VaultIDL} from "./utils/vault/idl";
import VaultImpl from "@meteora-ag/vault-sdk";
import {ON_DEMAND_DEVNET_PID, PullFeed, Queue} from "@switchboard-xyz/on-demand";

function getFirstKey(key1: PublicKey, key2: PublicKey): PublicKey {
  if (key1.toBuffer().compare(key2.toBuffer()) > 0) {
    return key1;
  }
  return key2;
}

function getSecondKey(key1: PublicKey, key2: PublicKey): PublicKey {
  if (key1.toBuffer().compare(key2.toBuffer()) > 0) {
    return key2;
  }
  return key1;
}

export function deriveMintMetadata(lpMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), METAPLEX_PROGRAM.toBuffer(), lpMint.toBuffer()],
    METAPLEX_PROGRAM,
  );
}

const VAULT_BASE_KEY = new PublicKey("HWzXGcGHy4tcpYfaRDCyLNzXqBTv3E6BttpCH2vJxArv"); // Replace with the actual base key

function deriveVaultAddress(mint: PublicKey, programId: PublicKey): PublicKey {
  const [vaultAddress] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("vault"),
      mint.toBuffer(),
      VAULT_BASE_KEY.toBuffer()
    ],
    programId
  );
  return vaultAddress;
}

const METAPLEX_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

async function deriveMetadataKey(lpMint: PublicKey): Promise<PublicKey> {
  const [metadataKey] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      METAPLEX_PROGRAM_ID.toBuffer(),
      lpMint.toBuffer()
    ],
    METAPLEX_PROGRAM_ID
  );
  return metadataKey;
}

async function deriveVaultLpKey(vaultKey: PublicKey, poolKey: PublicKey, programId: PublicKey): Promise<PublicKey> {
  const [vaultLpKey] = PublicKey.findProgramAddressSync(
    [
      vaultKey.toBuffer(),
      poolKey.toBuffer()
    ],
    new PublicKey(programId)
  );
  return vaultLpKey;
}

function derivePoolKey(mintA: PublicKey, mintB: PublicKey, programId: PublicKey): PublicKey {
  const firstKey = getFirstKey(mintA, mintB);
  const secondKey = getSecondKey(mintA, mintB);

  const [poolKey] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool"),
      firstKey.toBuffer(),
      secondKey.toBuffer()
    ],
    programId
  );
  return poolKey;
}

export const getVaultPdas = (tokenMint: PublicKey, programId: PublicKey, seedBaseKey?: PublicKey) => {
  const [vault, _vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from(VSEEDS.VAULT_PREFIX), tokenMint.toBuffer(), (seedBaseKey ?? VAULT_BASE_KEY).toBuffer()],
    programId,
  );

  const [tokenVault] = PublicKey.findProgramAddressSync(
    [Buffer.from(VSEEDS.TOKEN_VAULT_PREFIX), vault.toBuffer()],
    programId,
  );

  const [lpMint] = PublicKey.findProgramAddressSync([Buffer.from(VSEEDS.LP_MINT_PREFIX), vault.toBuffer()], programId);

  return {
    vaultPda: vault,
    tokenVaultPda: tokenVault,
    lpMintPda: lpMint,
  };
};

export function deriveProtocolFeeKey(
  mintKey: PublicKey,
  poolKey: PublicKey,
  dynamicAmmProgramId: PublicKey
): PublicKey {
  const [feeKey, _] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("fee"),
      mintKey.toBuffer(),
      poolKey.toBuffer()
    ],
    dynamicAmmProgramId
  );
  return feeKey;
}

// describe('Meteora CPI Tests', () => {
//   const provider = anchor.AnchorProvider.env();
//   anchor.setProvider(provider);
//
//   const dynamicAmmProgramId = new PublicKey("Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB");
//   const vaultProgramId = new PublicKey("24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi");
//   const program = new Program(IDL as Idl, new PublicKey("JB4qQ1kQHbhFgcNNk4eyw57jfsvL39QeVt2p3beW8DwH"),{
//     connection: anchor.getProvider().connection,
//   });
//
//   const vaultProgram = new Program(VaultIDL as Idl, new PublicKey(vaultProgramId),{
//     connection: anchor.getProvider().connection,
//   });
//
//   const payer = Keypair.fromSecretKey(new Uint8Array(feePayerKP));
//   const tokenAMint = Keypair.fromSecretKey(new Uint8Array(tokenAKP));
//   const tokenBMint = Keypair.fromSecretKey(new Uint8Array(tokenBKP));
//
//   let creatorAuthorityPDA: PublicKey;
//   let payerTokenA= new PublicKey("CFrD1EUe5MhUZJzVPMpFfBYicVZLJiZYhEcD3Fm1T7Su");
//   let payerTokenB = new PublicKey("62zknxcQF6pYNQ6WZkAV8tN3jgpjsUyj9omBNgd9dU9w");
//   let creatorTokenAAccount: PublicKey;
//   let creatorTokenBAccount: PublicKey;
//   let creatorPoolLp: PublicKey;
//   let protocolTokenAFee: PublicKey;
//   let protocolTokenBFee: PublicKey;
//   let pool: PublicKey;
//   let lpMint: PublicKey;
//   let aVault: PublicKey;
//   let bVault: PublicKey;
//   let aTokenVault: PublicKey;
//   let bTokenVault: PublicKey;
//   let aLpMintPda: PublicKey;
//   let bLpMintPda: PublicKey;
//   let aVaultLp: PublicKey;
//   let bVaultLp: PublicKey;
//   let mintMetadata: PublicKey;
//   let lookupTableAddress: PublicKey;
//   //
//   // const tokenAAmount = new anchor.BN(1_000_000_000); // 1 token A with 6 decimals
//   // const tokenBAmount = new anchor.BN(1_000_000_000); // 1 token B with 6 decimals
//   //
//   before(async () => {
//     // Find creator authority PDA
//     [creatorAuthorityPDA] = PublicKey.findProgramAddressSync(
//       [Buffer.from("creator")],
//       program.programId
//     );
//     creatorTokenAAccount = getAssociatedTokenAddressSync(
//       tokenAMint.publicKey,
//       creatorAuthorityPDA,
//       true
//     );
//
//     creatorTokenBAccount = getAssociatedTokenAddressSync(
//       tokenBMint.publicKey,
//       creatorAuthorityPDA,
//       true
//     );
//
//     const atx = new Transaction()
//     if(await provider.connection.getAccountInfo(creatorTokenAAccount) == null) {
//       atx.add(createAssociatedTokenAccountInstruction(payer.publicKey, creatorTokenAAccount, creatorAuthorityPDA, tokenAMint.publicKey));
//     }
//     if(await provider.connection.getAccountInfo(creatorTokenBAccount) == null) {
//       atx.add(createAssociatedTokenAccountInstruction(payer.publicKey, creatorTokenBAccount, creatorAuthorityPDA, tokenBMint.publicKey));
//       await sendAndConfirmTransaction(provider.connection, atx, [payer])
//     }
//
//     pool = derivePoolKey(
//       tokenAMint.publicKey,
//       tokenBMint.publicKey,
//       dynamicAmmProgramId
//     );
//
//     [lpMint] = PublicKey.findProgramAddressSync(
//       [Buffer.from(SEEDS.LP_MINT), pool.toBuffer()],
//       dynamicAmmProgramId,
//     );
//
//     creatorPoolLp = getAssociatedTokenAddressSync(
//       lpMint,
//       creatorAuthorityPDA,
//       true
//     );
//
//     // if(await provider.connection.getAccountInfo(creatorPoolLp) == null) {
//     //   const tx = new Transaction();
//     //   tx.add(createAssociatedTokenAccountInstruction(payer.publicKey, creatorPoolLp, creatorAuthorityPDA, lpMint))
//     //   const s = await sendAndConfirmTransaction(provider.connection, tx, [payer], {
//     //     skipPreflight: true
//     //   })
//     //   console.log("create creator pool lp", s);
//     // }
//
//     [
//       { vaultPda: aVault, tokenVaultPda: aTokenVault, lpMintPda: aLpMintPda },
//       { vaultPda: bVault, tokenVaultPda: bTokenVault, lpMintPda: bLpMintPda },
//     ] = [getVaultPdas(tokenAMint.publicKey, vaultProgramId), getVaultPdas(tokenBMint.publicKey, vaultProgramId)];
//
//     [[aVaultLp], [bVaultLp]] = [
//       PublicKey.findProgramAddressSync([aVault.toBuffer(), pool.toBuffer()], dynamicAmmProgramId),
//       PublicKey.findProgramAddressSync([bVault.toBuffer(), pool.toBuffer()], dynamicAmmProgramId),
//     ];
//     protocolTokenAFee = deriveProtocolFeeKey(tokenAMint.publicKey, pool, dynamicAmmProgramId)
//     // @ts-ignore
//     protocolTokenBFee = deriveProtocolFeeKey(tokenBMint.publicKey, pool, dynamicAmmProgramId)
//
//
//     let _mintMetadataBump: number;
//     [mintMetadata, _mintMetadataBump] = deriveMintMetadata(lpMint);
//
//     lookupTableAddress = await initLookupTable(provider.connection, payer, [
//       creatorAuthorityPDA, creatorTokenBAccount, creatorTokenAAccount, pool,payerTokenA, payerTokenB, creatorTokenAAccount, creatorTokenBAccount
//     ])
//   });
//
//   it('Creates a liquidity pool successfully', async () => {
//     if(await provider.connection.getAccountInfo(aVault) == null) {
//       const createVaultInx = await VaultImpl.createPermissionlessVaultInstruction(provider.connection, payer.publicKey, tokenAMint.publicKey, {
//         programId: vaultProgramId.toBase58()
//       })
//       const vtx = new Transaction();
//       vtx.add(createVaultInx)
//       const vtxs = await sendAndConfirmTransaction(provider.connection, vtx, [payer])
//       console.log("create a vault", vtxs)
//     }
//
//     if(await provider.connection.getAccountInfo(bVault) == null) {
//       const createVaultInx = await VaultImpl.createPermissionlessVaultInstruction(provider.connection, payer.publicKey, tokenBMint.publicKey, {
//         programId: vaultProgramId.toBase58()
//       })
//       const vtx = new Transaction();
//       vtx.add(createVaultInx)
//       const vtxs = await sendAndConfirmTransaction(provider.connection, vtx, [payer])
//       console.log("create B vault", vtxs)
//     }
//
//     const params = {
//       tradeFeeNumerator: new BN(10_000),
//       activationPoint: null,
//       hasAlphaVault: false,
//       activationType: 1,
//       padding: Buffer.alloc(90, 0),
//     };
//
//     const ix = await program.methods
//       .createLp(
//         new BN(100), new BN(100), params
//       )
//       .accountsStrict({
//         authority: creatorAuthorityPDA,
//         creatorTokenA: creatorTokenAAccount,
//         creatorTokenB: creatorTokenBAccount,
//         pool: pool,
//         lpMint: lpMint,
//         tokenAMint: tokenAMint.publicKey,
//         tokenBMint: tokenBMint.publicKey,
//         aVault: aVault,
//         bVault: bVault,
//         aTokenVault: aTokenVault,
//         bTokenVault: bTokenVault,
//         aVaultLpMint: aLpMintPda,
//         bVaultLpMint: bLpMintPda,
//         aVaultLp: aVaultLp,
//         bVaultLp: bVaultLp,
//         payerTokenA: payerTokenA,
//         payerTokenB: payerTokenB,
//         creatorPoolLp: creatorPoolLp,
//         protocolTokenAFee: protocolTokenAFee,
//         protocolTokenBFee: protocolTokenBFee,
//         payer: payer.publicKey,
//         rent: anchor.web3.SYSVAR_RENT_PUBKEY,
//         mintMetadata: mintMetadata,
//         metadataProgram: METAPLEX_PROGRAM,
//         vaultProgram: new PublicKey("24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi"),
//         tokenProgram: TOKEN_PROGRAM_ID,
//         associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
//         systemProgram: SystemProgram.programId,
//         dynamicAmmProgram: dynamicAmmProgramId
//       })
//       .signers([payer])
//       .instruction();
//
//     const lookupTableAccount = (
//       await provider.connection.getAddressLookupTable(lookupTableAddress)
//     ).value;
//
//     const messageV0 = new TransactionMessage({
//       payerKey: payer.publicKey,
//       recentBlockhash: (await provider.connection.getRecentBlockhash()).blockhash,
//       instructions: [ComputeBudgetProgram.setComputeUnitLimit({ units: 450_000}) , ix],
//     }).compileToV0Message([lookupTableAccount]);
//     const transactionV0 = new VersionedTransaction(messageV0);
//
//     transactionV0.sign([payer]);
//
//     const txid = await provider.connection.sendTransaction(transactionV0, {
//       skipPreflight: true
//     });
//
//     console.log("Liquidity pool created successfully!", txid);
//   });
// });
//
// const initLookupTable = async(connection: Connection, payer: Keypair, addresses: PublicKey[]) => {
//   const currentSlot = await connection.getSlot();
//
//   const [lookupTableInstruction, lookupTableAddress] =
//     AddressLookupTableProgram.createLookupTable({
//       authority: payer.publicKey,
//       payer: payer.publicKey,
//       recentSlot: currentSlot,
//     });
//
//   const extendInstruction = AddressLookupTableProgram.extendLookupTable({
//     payer: payer.publicKey,
//     authority: payer.publicKey,
//     lookupTable: lookupTableAddress,
//     addresses: addresses,
//   });
//
//   const tx = new Transaction()
//   tx.add(lookupTableInstruction, extendInstruction)
//
//   await sendAndConfirmTransaction(connection, tx, [payer])
//
//   console.log(`Created and extended the lookup table, address: ${lookupTableAddress}`)
//   return lookupTableAddress
// }

describe('switchboard', () => {
  it('liquidate', async () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const feedId = new PublicKey('EYycumtzRd4X1kB2GQcLD8CGyRCqP8DCKwAZcWGCysTd');
    const payer = Keypair.fromSecretKey(new Uint8Array(feePayerKP));
    const program = new Program(IDL as Idl,{
      connection: anchor.getProvider().connection,
    });

    const idl = await Anchor30Program.fetchIdl(
      ON_DEMAND_DEVNET_PID,
      provider,
    );

    const sbOnDemandProgram = new Anchor30Program(idl!, provider);

    const pullFeed = new PullFeed(sbOnDemandProgram as any, feedId);

    const feedConfigs = await pullFeed.loadConfigs();

    let queueAccount = new Queue(sbOnDemandProgram as any, feedConfigs.queue);

    let gws = await queueAccount.fetchGateway();

    const conf = {
      numSignatures: 2,
      feed: feedId,
      network: "devnet"
    };

    const [pullIx, responses, success] = await pullFeed.fetchUpdateIx(conf, true, payer.publicKey);

    const ix = await program.methods.liquidate().accounts({
      feed: feedId
    }).instruction()

    const tx = new Transaction();
    tx.add(...pullIx)
    tx.add(ix)
    const txs = await sendAndConfirmTransaction(provider.connection, tx, [payer], {
      skipPreflight: true
    })
    console.log(txs)
  })
});
