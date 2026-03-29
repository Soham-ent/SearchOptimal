import * as fs from 'fs';
import JSBI from 'jsbi';

import { Token } from '@uniswap/sdk-core';
import { Pool, TickListDataProvider, TickMath } from '@uniswap/v3-sdk';

const snapshot = JSON.parse(fs.readFileSync('./src/data/v3_snapshot_23997631.json', 'utf-8'));

export function hydratePool(poolAddress: string, tokenA: Token, tokenB: Token, fee: number): Pool {
    const data: any = snapshot[poolAddress];

    if (!data) throw new Error(`Pool ${poolAddress} not found in snapshot.`);

    const tickSpacing = data.tickSpacing;

    // Format the ticks for the SDK
    const ticks = data.ticks.map((t: any) => ({
        index: t.tick,
        liquidityNet: JSBI.BigInt(t.liquidityNet),
        liquidityGross: JSBI.BigInt(t.liquidityGross)
    }));

    // Ensure ticks are sorted mathematically
    ticks.sort((a: any, b: any) => a.index - b.index);

    // Bypass sdk invariants
    const MIN_TICK_MAPPED = Math.ceil(TickMath.MIN_TICK / tickSpacing) * tickSpacing,
        MAX_TICK_MAPPED = Math.floor(TickMath.MAX_TICK / tickSpacing) * tickSpacing;

    // 1. Calculate the lowest dip in running liquidity to prevent 'LIQUIDITY_NET' error
    let minRunning = JSBI.BigInt(0),
        running = JSBI.BigInt(0);
    for (const t of ticks) {
        running = JSBI.add(running, t.liquidityNet);
        if (JSBI.lessThan(running, minRunning)) {
            minRunning = running;
        }
    }

    // Convert negative dip to a positive injection
    const initialLiquidity = JSBI.multiply(minRunning, JSBI.BigInt(-1));

    // Inject massive dummy liquidity at the absolute MIN_TICK
    if (ticks.length === 0 || ticks[0].index > MIN_TICK_MAPPED) {
        ticks.unshift({
            index: MIN_TICK_MAPPED,
            liquidityNet: initialLiquidity,
            liquidityGross: initialLiquidity
        });
    } else {
        ticks[0].liquidityNet = JSBI.add(ticks[0].liquidityNet, initialLiquidity);
    }

    // 2. Calculate final net liquidity to prevent 'ZERO_NET' error
    let totalNet = JSBI.BigInt(0);
    for (const t of ticks) {
        totalNet = JSBI.add(totalNet, t.liquidityNet);
    }

    // Inject negative offset dummy liquidity at the absolute MAX_TICK
    if (ticks[ticks.length - 1].index < MAX_TICK_MAPPED) {
        ticks.push({
            index: MAX_TICK_MAPPED,
            liquidityNet: JSBI.multiply(totalNet, JSBI.BigInt(-1)),
            liquidityGross: JSBI.BigInt(0)
        });
    } else {
        ticks[ticks.length - 1].liquidityNet = JSBI.subtract(ticks[ticks.length - 1].liquidityNet, totalNet);
    }

    const tickDataProvider = new TickListDataProvider(ticks, tickSpacing);

    return new Pool(
        tokenA,
        tokenB,
        fee,
        data.sqrtPriceX96,
        data.liquidity,
        data.tick,
        tickDataProvider
    );
}