import type { Token } from "@uniswap/sdk-core";
import type { Pool } from "@uniswap/v3-sdk";
import JSBI from "jsbi";
import { calculateProfit } from "./binary";

const ONE = JSBI.BigInt("1000000000000000000"), // 1.0 in 1e18 scale
    GOLDEN_RATIO_NUM = JSBI.BigInt("618033988749894848"), // ≈ 0.618...
    ONE_MINUS_GOLDEN = JSBI.subtract(ONE, GOLDEN_RATIO_NUM); // ≈ 0.381...

export async function runGoldenSectionSearch(
    left: JSBI,
    right: JSBI,
    buyPool: Pool,
    sellPool: Pool,
    tokenIn: Token,
    tolerance: JSBI
) {
    let currentLeft = left,
        currentRight = right,
        evaluations = 0,
        h = JSBI.subtract(currentRight, currentLeft),
        offset = JSBI.divide(JSBI.multiply(h, GOLDEN_RATIO_NUM), ONE),
        c = JSBI.subtract(currentRight, offset),
        d = JSBI.add(currentLeft, offset);

    // Initial 2 evaluations
    let profitC = await calculateProfit(buyPool, sellPool, c, tokenIn),
        profitD = await calculateProfit(buyPool, sellPool, d, tokenIn);

    evaluations += 2;
    while (JSBI.greaterThan(JSBI.subtract(currentRight, currentLeft), tolerance)) {
        if (JSBI.greaterThan(profitC, profitD)) {
            currentRight = d;
            d = c;
            profitD = profitC;

            h = JSBI.subtract(currentRight, currentLeft);
            offset = JSBI.divide(JSBI.multiply(h, GOLDEN_RATIO_NUM), ONE);
            c = JSBI.subtract(currentRight, offset);

            // Only 1 new evaluation per loop
            profitC = await calculateProfit(buyPool, sellPool, c, tokenIn);
        } else {
            currentLeft = c;
            c = d;
            profitC = profitD;

            h = JSBI.subtract(currentRight, currentLeft);
            offset = JSBI.divide(JSBI.multiply(h, GOLDEN_RATIO_NUM), ONE);
            d = JSBI.add(currentLeft, offset);

            // Only 1 new evaluation per loop
            profitD = await calculateProfit(buyPool, sellPool, d, tokenIn);
        }
        evaluations++;
    }

    const optimalVolume = JSBI.greaterThan(profitC, profitD) ? c : d,
        optimalProfit = JSBI.greaterThan(profitC, profitD) ? profitC : profitD;

    return { volume: optimalVolume, profit: optimalProfit, evaluations };
}