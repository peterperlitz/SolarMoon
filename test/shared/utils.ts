import { hexStripZeros } from '@ethersproject/bytes'
import { BigNumber } from 'ethers'
import { network, ethers } from 'hardhat'
import { PancakePair, PancakeRouter } from '../../typechain'

export function expandTo9Decimals(n: number): BigNumber {
    return BigNumber.from(n).mul(BigNumber.from(10).pow(9))
}

export function expandTo18Decimals(n: number): BigNumber {
    return BigNumber.from(n).mul(BigNumber.from(10).pow(18))
}

export const formatFromDecimals = function (amount: BigNumber): String {
    return amount.toString()
}

export const formatToDecimals = function (factor: any, amount: number): BigNumber {
    return BigNumber.from(factor).mul(BigNumber.from(10).pow(amount))
}

export function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export const getPercentageOfTotalSupply = function (percentage: number): BigNumber {
    let correctedAmount = percentage * 10000
    let totalSupply = BigNumber.from(10).pow(24)
    let percentageAmount = BigNumber.from(totalSupply.div(1000000))
    let amount = percentageAmount.mul(correctedAmount)
    return amount
}

export async function latestBlock() {
    const block = await ethers.provider.getBlockNumber()
    return BigNumber.from(block)
}

export async function latestBlockTimestamp() {
    const block = await ethers.provider.getBlock('latest')
    if (block) {
        return BigNumber.from(block.timestamp)
    }
    console.warn('failed to fetch block')
    return ethers.constants.Zero
}

export async function advanceBlocks(num: number): Promise<void> {
    if (num < 1) {
        throw new Error('No blocks to advance')
    }

    for (let i = 0; i < num; i++) {
        await network.provider.request({
            method: 'evm_mine',
            params: [],
        })
    }
}

export async function advanceBlock() {
    await network.provider.request({
        method: 'evm_mine',
        params: [],
    })
}

export async function advanceBlockAndTime(time: number) {
    const currentBlockTime = (await latestBlockTimestamp()).toNumber()
    const timeDelta = currentBlockTime + time

    await network.provider.request({
        method: 'evm_increaseTime',
        params: [timeDelta],
    })
    await network.provider.request({
        method: 'evm_mine',
        params: [],
    })
}

export async function getPancakeTokenPrice(router: PancakeRouter, path: string[], convertToString: Boolean) {
    let outAmounts = await router.getAmountsOut(ethers.utils.parseEther('1'), path)

    if (convertToString) {
        return ethers.utils.formatUnits(outAmounts[1], 'gwei')
    } else {
        return outAmounts[1]
    }
}

export const tokenAmounts = {
    ultraWhale: getPercentageOfTotalSupply(1.6),
    whale: getPercentageOfTotalSupply(0.1),
    orca: getPercentageOfTotalSupply(0.05),
    shark: getPercentageOfTotalSupply(0.025),
    dolphin: getPercentageOfTotalSupply(0.01),
    fish: getPercentageOfTotalSupply(0.005),
    shrimp: getPercentageOfTotalSupply(0.0035),
}