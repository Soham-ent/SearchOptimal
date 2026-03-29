import JSBI from "jsbi";
import { CurrencyAmount, Token } from "@uniswap/sdk-core";
import type { Pool } from "@uniswap/v3-sdk";

// 1. Pure JSBI Constants
const BN_10 = JSBI.BigInt(10),
    ETHER = JSBI.exponentiate(BN_10, JSBI.BigInt(18)),
    DELTA = JSBI.exponentiate(BN_10, JSBI.BigInt(14)); // 0.0001 ETH delta for slope calculation

function div(x: number) {
    const d = JSBI.BigInt(x)
    return JSBI.divide(ETHER, d)
}

function mul(x: number) {
    const val = JSBI.BigInt(x)
    return JSBI.multiply(ETHER, val)
}

const iterableVolumes: JSBI[] = [div(200), div(100), div(40), div(20), div(10), div(4), div(2), ETHER, mul(2), mul(5), mul(10), mul(20), mul(50), mul(100)]

// Helper to keep code clean
const ZERO = JSBI.BigInt(0),
    TWO = JSBI.BigInt(2);

export async function calculateProfit(
    buyFromMarket: Pool,
    sellToMarket: Pool,
    size: JSBI,
    tokenIn: Token
): Promise<JSBI> {
    const amountIn = CurrencyAmount.fromRawAmount(tokenIn, size),
        [tokensOutFromBuyingSize,] = await buyFromMarket.getOutputAmount(amountIn),
        [proceedsFromSellingTokens,] = await sellToMarket.getOutputAmount(tokensOutFromBuyingSize);

    return JSBI.subtract(proceedsFromSellingTokens.quotient, size)
}

export async function findTightBounds(buyPool: Pool, sellPool: Pool, WETH: Token): Promise<{ left: JSBI, right: JSBI }> {
    let bestProfit = ZERO,
        optimalIndex = 0;

    for (let i = 0; i < iterableVolumes.length; i++) {
        const size = iterableVolumes[i],
            profit = await calculateProfit(buyPool, sellPool, size, WETH);

        if (JSBI.greaterThan(profit, bestProfit)) {
            bestProfit = profit;
            optimalIndex = i;
        }
    }

    if (JSBI.equal(bestProfit, ZERO)) {
        throw new Error("No profitable arbitrage found in coarse sweep.");
    }

    // The peak must be between the size tested before the best and the size tested after.
    const leftBound = optimalIndex > 0 ? iterableVolumes[optimalIndex - 1] : ZERO,
        rightBound = optimalIndex < iterableVolumes.length - 1 ? iterableVolumes[optimalIndex + 1] : JSBI.multiply(iterableVolumes[optimalIndex], TWO);

    return { left: leftBound, right: rightBound };
}

export async function performDerivativeBinarySearch(
    left: JSBI, // Lower bound
    right: JSBI, // Upper bound
    buyFromMarket: Pool,
    sellToMarket: Pool,
    tokenIn: Token,
    tolerance = JSBI.exponentiate(BN_10, JSBI.BigInt(15)), // 0.001 ETH precision
) {
    let currentLeft = left,
        currentRight = right,
        iterations = 0;

    while (
        JSBI.greaterThan(JSBI.subtract(currentRight, currentLeft), tolerance)
    ) {
        // mid = (left + right) / 2 
        const mid = JSBI.divide(JSBI.add(currentLeft, currentRight), TWO);

        // mid + delta (to calculate slope)
        const midPlusDelta = JSBI.add(mid, DELTA),
            profitMid = await calculateProfit(buyFromMarket, sellToMarket, mid, tokenIn),
            profitMidPlus = await calculateProfit(buyFromMarket, sellToMarket, midPlusDelta, tokenIn);

        // If slope is positive, peak is to the right
        if (JSBI.greaterThan(profitMidPlus, profitMid)) {
            currentLeft = mid;
        } else {
            // Slope is negative, peak is to the left
            currentRight = mid;
        }

        iterations++;

    }

    const optimalVolume = JSBI.divide(JSBI.add(currentLeft, currentRight), TWO);

    return { volume: optimalVolume, iterations }
}