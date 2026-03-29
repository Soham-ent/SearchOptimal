import { Contract, providers } from "ethers";
import poolAbi from "../data/UniswapV3Pool.json"
import tickLensAbi from "../data/TickLens.json"
import type { UniswapV3Pool, TickLens } from "types/index"

// 1. Connect to your local Anvil fork locked at block 23997631
const provider = new providers.JsonRpcProvider("http://127.0.0.1:8545"),
    BLOCK_NUMBER = 23997631;

// The two pools you identified
const POOLS = [
    "0xE0554a476A092703abdB3Ef35c80e0D76d32939F",
    "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640"
];

// Uniswap Mainnet TickLens Contract
const TICK_LENS_ADDRESS = "0xbfd8137f7d1516D3ea5cA83523914859ec47F573";

async function snapshotPoolState() {
    const tickLens = new Contract(TICK_LENS_ADDRESS, tickLensAbi, provider) as TickLens;
    let snapshotData: any = {};

    for (const poolAddress of POOLS) {
        const pool = new Contract(poolAddress, poolAbi, provider) as UniswapV3Pool;

        // Fetch Base State at the exact block
        const [slot0, liquidity, tickSpacing] = await Promise.all([
            pool.slot0({ blockTag: BLOCK_NUMBER }),
            pool.liquidity({ blockTag: BLOCK_NUMBER }),
            pool.tickSpacing({ blockTag: BLOCK_NUMBER })
        ]);

        const currentTick = slot0.tick;

        // Calculate the word index for the current tick
        // V3 stores ticks in a bitmap where each "word" holds 256 ticks.
        const compressed = Math.floor(currentTick / tickSpacing),
            wordPos = Math.floor(compressed / 256);

        // Fetch the ticks in the current word, and the adjacent words (left and right) to ensure we have enough liquidity depth for the simulation
        const ticks = [];
        for (let i = wordPos - 2; i <= wordPos + 2; i++) {
            const populatedTicks = await tickLens.getPopulatedTicksInWord(poolAddress, i, { blockTag: BLOCK_NUMBER });
            ticks.push(...populatedTicks);
        }

        snapshotData[poolAddress] = {
            sqrtPriceX96: slot0.sqrtPriceX96.toString(),
            tick: currentTick,
            liquidity: liquidity.toString(),
            tickSpacing: tickSpacing,
            ticks: ticks.map(t => ({
                tick: t.tick,
                liquidityNet: t.liquidityNet.toString(),
                liquidityGross: t.liquidityGross.toString()
            }))
        };
    }

    // Save to local file
    await Bun.write("src/data/v3_snapshot_23997631.json", JSON.stringify(snapshotData, null, 2));
    console.log("Snapshot complete. RPC calls are now obsolete for this block.");
}

await snapshotPoolState();