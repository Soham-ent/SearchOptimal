import JSBI from "jsbi";
import { CurrencyAmount, Token } from "@uniswap/sdk-core";
import type { Pool } from "@uniswap/v3-sdk";

// 1. Pure JSBI Constants
const BN_10 = JSBI.BigInt(10),
    DELTA = JSBI.exponentiate(BN_10, JSBI.BigInt(14)), // 0.0001 ETH delta for slope calculation
    // Helper 
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