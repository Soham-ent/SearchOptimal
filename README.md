# EVM Optimal Routing: GSS vs Binary Search

This repository contains the pure TypeScript benchmarking engine used to evaluate continuous optimization algorithms (Golden Section Search vs. Derivative Binary Search) for finding the exact `amountIn` maxima on Uniswap V3 profit curves.

**Read the full mathematical teardown and latency analysis on Substack:** [here](https://sohammalve.substack.com/p/coarse-to-precise-a-2-phase-search)

## Architecture Overview
To accurately measure algorithmic CPU latency without JSON-RPC I/O contamination, this engine decouples state-fetching from routing math. 
1. `snapshot.ts` extracts the exact tick horizon from a local mainnet fork.
2. `hydrate.ts` loads the V3 pool state into local memory, bypassing SDK invariants.
3. `benchmark.ts` runs the algorithms purely off-chain using `JSBI` integer math.

## Quick Start (Run the Benchmark)

This project is built using [Bun](https://bun.sh/) for minimal runtime overhead.

```bash
# 1. Install dependencies
bun install

# 2. Run the benchmarking engine
bun benchmark