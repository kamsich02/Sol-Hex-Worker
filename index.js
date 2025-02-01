// Load environment variables from .env
import "dotenv/config";

import {
  Connection,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

if (!process.env.OLD_OWNER_SECRET_KEY || !process.env.NEW_OWNER_SECRET_KEY) {
  throw new Error("Missing secret keys in environment variables!");
}
if (!process.env.CUSTOM_RPC_URL) {
  throw new Error("Missing CUSTOM_RPC_URL in environment variables!");
}

if (!process.env.BASE_64_TX) {
  throw new Error("Missing BASE_64_TX in environment variables!");
}

/**
 * WARNING: Never commit real private keys in production.
 */

// 1) Your base64-encoded transaction data
const base64Tx = process.env.BASE_64_TX;

const customRpcUrl = process.env.CUSTOM_RPC_URL;
// 1. Setup RPC Connection & Keypairs
const connection = new Connection(customRpcUrl);

// Convert string to array
const oldOwnerKeyArray = JSON.parse(process.env.OLD_OWNER_SECRET_KEY);
const newOwnerKeyArray = JSON.parse(process.env.NEW_OWNER_SECRET_KEY);

// Create Keypairs
const oldKeypair = Keypair.fromSecretKey(new Uint8Array(oldOwnerKeyArray));
const newKeypair = Keypair.fromSecretKey(new Uint8Array(newOwnerKeyArray));

// Log public keys
console.log("Old Keypair (Tx Owner):", oldKeypair.publicKey.toBase58());
console.log("New Keypair (Fee Payer):", newKeypair.publicKey.toBase58());


async function sendTransactionWithInterval() {
  try {
    // 4) Deserialize the transaction from base64
    let transaction = Transaction.from(Buffer.from(base64Tx, "base64"));

    // 5) (Optional) Update the blockhash if you suspect it might be expired
    //    Otherwise, if the existing blockhash is still valid, you can skip this.
    //    But generally it's safer to refresh unless there's a reason not to.
    const latestBlockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = latestBlockhash.blockhash;

    // 6) Set the fee payer to newKeypair
    transaction.feePayer = newKeypair.publicKey;

    // 7) Sign with both keypairs
    //    - The fee payer must sign because they're paying fees
    //    - The oldKeypair must sign if it's an authority on the instructions
    transaction.sign(newKeypair, oldKeypair);

    // 8) Send and confirm
    //    Optionally you can use sendAndConfirmRawTransaction if you prefer
    const txSignature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [newKeypair, oldKeypair], // signers array
      { skipPreflight: false, commitment: "confirmed" }
    );

    console.log("Transaction signature:", txSignature);
    console.log(
      "Explorer link:",
      `https://explorer.solana.com/tx/${txSignature}?cluster=mainnet-beta`
    );
  } catch (err) {
    console.error("Error signing and sending transaction:", err);
  }
}

/**
 * Start the script:
 * - Execute immediately
 * - Then set an interval to repeat every 60 minutes
 */
async function main() {
  // Execute once immediately
  await sendTransactionWithInterval();

  // Then repeat every 60 minutes (60 * 60 * 1000 = 3,000,000 ms)
  setInterval(async () => {
    await sendTransactionWithInterval();
  }, 37 * 60 * 1000); // 60 minutes
}

// Fire it up
main().catch(console.error);
