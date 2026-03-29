import { Token } from "@uniswap/sdk-core";
import type { Pool } from "@uniswap/v3-sdk";
import JSBI from "jsbi";
import { calculateProfit, performDerivativeBinarySearch } from "./algos/binary";
import { runGoldenSectionSearch } from "./algos/gss";
import { hydratePool } from "./utils/hydrate";
import { formatEther } from "@ethersproject/units";
import { findTightBounds } from "./algos/bounds";

export async function runBenchmark(buyPool: Pool, sellPool: Pool, WETH: Token) {
    const BN_10 = JSBI.BigInt(10),
        TOLERANCE = JSBI.exponentiate(BN_10, JSBI.BigInt(15)); // 0.001 ETH precision

    const sweepStart = performance.now(),
        bounds = await findTightBounds(buyPool, sellPool, WETH),
        sweepEnd = performance.now();

    const leftBound = bounds.left,
        rightBound = bounds.right;

    // Run Binary
    const startBinary = performance.now(),
        binaryResult = await performDerivativeBinarySearch(leftBound, rightBound, buyPool, sellPool, WETH, TOLERANCE),
        endBinary = performance.now();

    // Run GSS
    const startGSS = performance.now(),
        gssResult = await runGoldenSectionSearch(leftBound, rightBound, buyPool, sellPool, WETH, TOLERANCE),
        endGSS = performance.now();

    const binaryVolume = binaryResult.volume,
        gssVolume = gssResult.volume,
        binaryProfit = await calculateProfit(buyPool, sellPool, binaryVolume, WETH),
        gssProfit = await calculateProfit(buyPool, sellPool, gssResult.volume, WETH);

    console.log(`
    =========================================
    STAGE 1: COARSE HEURISTIC BRACKETING
    Best Bucket Evaluated : ${formatEther(bounds.bestVolume.toString())} WETH
    Bucket Profit         : ${formatEther(bounds.bestProfit.toString())} WETH
    Bounds Found          : [${formatEther(leftBound.toString())} WETH, ${formatEther(rightBound.toString())} WETH]
    Execution Time        : ${(sweepEnd - sweepStart).toFixed(2)} ms

    STAGE 2: PRECISION BENCHMARK
    --- DERIVATIVE BINARY SEARCH ---
    Optimal Volume : ${formatEther(binaryVolume.toString())} WETH
    Max Profit     : ${formatEther(binaryProfit.toString())} WETH
    Iterations     : ${binaryResult.iterations}
    Execution Time : ${(endBinary - startBinary).toFixed(2)} ms

    --- GOLDEN SECTION SEARCH ---
    Optimal Volume : ${formatEther(gssVolume.toString())} WETH
    Max Profit     : ${formatEther(gssProfit.toString())} WETH
    Iterations     : ${gssResult.evaluations}
    Execution Time : ${(endGSS - startGSS).toFixed(2)} ms
    `);
}

// 2. Define Mainnet Tokens
const CHAIN_ID = 1,
    WETH = new Token(CHAIN_ID, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 'WETH', 'Wrapped Ether'),
    USDC = new Token(CHAIN_ID, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC', 'USD Coin');

// The USDC/WETH 0.05% and USDC/WETH 0.01%
const POOL_ADDRESS1 = "0xE0554a476A092703abdB3Ef35c80e0D76d32939F",
    POOL_ADDRESS2 = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640";

const buyFromMarket = hydratePool(POOL_ADDRESS1, USDC, WETH, 100)
// USDC < WETH, so USDC is token0 and WETH is token1 in this pool.
const sellToMarket = hydratePool(POOL_ADDRESS2, USDC, WETH, 500); // 500 = 0.05% fee tier

await runBenchmark(buyFromMarket, sellToMarket, WETH)