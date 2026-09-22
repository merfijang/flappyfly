// Prints the pump.fun creator-fee vaults for a creator (dev) wallet; use them as FEE_WALLET.
// Usage: npx -y -p @solana/web3.js@1 node scripts/pump-vaults.mjs <creator wallet>
import { PublicKey } from '@solana/web3.js';

const creator = new PublicKey(process.argv[2]);
const PUMP = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const PUMP_AMM = new PublicKey('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA');
const ATA = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const TOKEN = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const WSOL = new PublicKey('So11111111111111111111111111111111111111112');

// bonding curve: seeds ["creator-vault", creator] (pump IDL); fees accrue here as SOL
const [curveVault] = PublicKey.findProgramAddressSync([Buffer.from('creator-vault'), creator.toBuffer()], PUMP);
// after migration to PumpSwap: WSOL ATA of PDA ["creator_vault", coin_creator] (pump_amm IDL)
const [ammAuthority] = PublicKey.findProgramAddressSync([Buffer.from('creator_vault'), creator.toBuffer()], PUMP_AMM);
const [ammVault] = PublicKey.findProgramAddressSync([ammAuthority.toBuffer(), TOKEN.toBuffer(), WSOL.toBuffer()], ATA);

console.log(`bonding curve vault: ${curveVault.toBase58()}`);
console.log(`PumpSwap vault:      ${ammVault.toBase58()}`);
console.log(`FEE_WALLET=${curveVault.toBase58()},${ammVault.toBase58()}`);
