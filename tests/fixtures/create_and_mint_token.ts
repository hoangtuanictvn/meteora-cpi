import {createMint, getOrCreateAssociatedTokenAccount, mintTo} from "@solana/spl-token";

import feePayerKP from '../../public/fee-payer-pk.5qAqQ5nuhrHwD2BH8baBTQAUZ3MbfGoiyuTkmXBVVZ5T.json' with { type: 'json' };
import IDL from "../../target/idl/meteora_cpi.json" with { type: 'json' };
import {Keypair, PublicKey} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import anchorPkg from '@coral-xyz/anchor';
const {Idl, Program, BN} = anchorPkg;
import tokenAKP from "../../public/token-A-pk.3yCJrDbY5Cmw3sohbV3XnqDS6TyATgB9s1MDKuacZxjy.json" with { type: 'json' };
import tokenBKP from "../../public/token-B-pk.FsJP76e3dBBKpjEnDFYduQKmVKPnpuGh1YCcY1CaroZr.json" with { type: 'json' };
const createAndMint = async () => {
  const provider = anchor.AnchorProvider.env()
  const program = new Program(IDL as Idl,new PublicKey(IDL.metadata.address),{
    connection: provider.connection,
  });

  const tokenAMint = Keypair.fromSecretKey(new Uint8Array(tokenAKP));
  const tokenBMint = Keypair.fromSecretKey(new Uint8Array(tokenBKP));

  const payer = Keypair.fromSecretKey(new Uint8Array(feePayerKP));

  if(await provider.connection.getAccountInfo(tokenAMint.publicKey) === null) {
    await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      payer.publicKey,
      6,
      tokenAMint
    );
  }

  if(await provider.connection.getAccountInfo(tokenBMint.publicKey) === null) {
    await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      payer.publicKey,
      6,
      tokenBMint
    );
  }

  const payerTokenAAccount = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    tokenAMint.publicKey,
    payer.publicKey
  );
  console.log("payerTokenA:", payerTokenAAccount.address.toBase58());

  const payerTokenBAccount = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    tokenBMint.publicKey,
    payer.publicKey
  );
  console.log("payerTokenB:", payerTokenBAccount.address.toBase58());

  await mintTo(
    provider.connection,
    payer,
    tokenAMint.publicKey,
    payerTokenAAccount.address,
    payer.publicKey,
    1000000
  );

  await mintTo(
    provider.connection,
    payer,
    tokenBMint.publicKey,
    payerTokenBAccount.address,
    payer.publicKey,
    1000000
  );

  console.log("tokenA:", tokenAMint.publicKey.toBase58());
  console.log("tokenB:", tokenBMint.publicKey.toBase58());
}

createAndMint().then(()=> {}).catch(e => {
  console.log(e)
});