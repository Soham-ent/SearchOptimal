import JSBI from "jsbi";
import { calculateProfit } from "./binary";
import type { Pool } from "@uniswap/v3-sdk";
import type { Token } from "@uniswap/sdk-core";

const BN_10 = JSBI.BigInt(10),
    ETHER = JSBI.exponentiate(BN_10, JSBI.BigInt(18)),
    // Helper
    TWO = JSBI.BigInt(2),
    ZERO = JSBI.BigInt(0);

function div(x: number) {
    const d = JSBI.BigInt(x)
    return JSBI.divide(ETHER, d)
}

function mul(x: number) {
    const val = JSBI.BigInt(x)
    return JSBI.multiply(ETHER, val)
}

const iterableVolumes: JSBI[] = [div(200), div(100), div(40), div(20), div(10), div(4), div(2), ETHER, mul(2), mul(5), mul(10), mul(20), mul(50), mul(100)]

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