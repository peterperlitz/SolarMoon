import { expect, assert } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import hre, { waffle, ethers, deployments } from 'hardhat'
import { BigNumber, FixedNumber } from '@ethersproject/bignumber'
import { latestBlockTimestamp } from './shared/utils'

import { setupPancakeSwapTest } from './shared/TestFixture'
import { PancakeFactory, PancakePair, Weth9, PancakeRouter, Solarmoon } from '../typechain'
//import { formatFromDecimals, formatToDecimals, latestBlockTimestamp, getPancakeTokenPrice, tokenAmounts } from './shared/utils'

describe.only('Solarmoon Token', async () => {
    if (hre.network.name !== 'hardhat') {
        console.error('Tests are meant to be run on hardhat only!')
        process.exit(1)
    }

    let deployer: SignerWithAddress,
        admin: SignerWithAddress,
        karen: SignerWithAddress,
        bob: SignerWithAddress,
        randy: SignerWithAddress,
        stan: SignerWithAddress,
        ultraWhale: SignerWithAddress,
        whale: SignerWithAddress,
        fish: SignerWithAddress,
        shrimp: SignerWithAddress,
        solarMoon: Solarmoon,
        pancakePair: PancakePair,
        pancakeFactory: PancakeFactory,
        pancakeRouter: PancakeRouter,
        WETH: Weth9,
        initialLPBalance: BigNumber,
        initialLiquidityTokens: BigNumber,
        path: string[]

    beforeEach(async () => {
        const config = await setupPancakeSwapTest()

        solarMoon = config.solarmoon as Solarmoon
        pancakeFactory = config.factory as PancakeFactory
        pancakeRouter = config.router as PancakeRouter
        WETH = config.weth as Weth9

        //console.log('INIT_CODE_PAIR_HASH:', await pancakeFactory.INIT_CODE_PAIR_HASH())

        // configure tracer plugin contract addresses
        hre.tracer.nameTags[solarMoon.address] = 'Solarmoon'
        hre.tracer.nameTags[pancakeFactory.address] = 'PancakeFactory'
        hre.tracer.nameTags[pancakeRouter.address] = 'PancakeRouter'
        hre.tracer.nameTags[WETH.address] = 'WETH9'

        path = [WETH.address, solarMoon.address]

        deployer = await ethers.getSigner(config.deployer)
        admin = await ethers.getSigner(config.admin)
        randy = await ethers.getSigner(config.randy)
        stan = await ethers.getSigner(config.stan)
        karen = await ethers.getSigner(config.karen)
        bob = await ethers.getSigner(config.bob)
        ultraWhale = await ethers.getSigner(config.ultraWhale)
        whale = await ethers.getSigner(config.whale)
        fish = await ethers.getSigner(config.fish)
        shrimp = await ethers.getSigner(config.shrimp)

        // configure tracer plugin user addresses
        hre.tracer.nameTags[deployer.address] = 'Deployer'
        hre.tracer.nameTags[karen.address] = 'Karen'
        hre.tracer.nameTags[bob.address] = 'Bob'
        hre.tracer.nameTags[randy.address] = 'Randy'
        hre.tracer.nameTags[stan.address] = 'Stan'
        hre.tracer.nameTags[whale.address] = 'Whale'
        hre.tracer.nameTags[fish.address] = 'Fish'

        let deadline = (await latestBlockTimestamp()).add(60)

        initialLiquidityTokens = BigNumber.from(10).pow(23)
        let initialLiquidityNative = hre.ethers.utils.parseEther('10000')

        //await expect(
        //    pancakeFactory.connect(deployer).createPair(Solarmoon.address, WETH.address),
        //    "Did not emit 'PairCreated' event"
        //).to.emit(pancakeFactory, 'PairCreated')

        let pairAddress = await pancakeFactory.getPair(solarMoon.address, WETH.address)
        pancakePair = (await ethers.getContractAt('PancakePair', pairAddress)) as PancakePair

        hre.tracer.nameTags[pancakePair.address] = 'PancakePair'

        await solarMoon.connect(deployer).approve(pancakeRouter.address, initialLiquidityTokens)
        await pancakeRouter
            .connect(deployer)
            .addLiquidityETH(solarMoon.address, initialLiquidityTokens, 0, 0, deployer.address, deadline, {
                value: initialLiquidityNative,
            })

        await expect(pancakePair.sync(), "Did not emit 'Sync' event").to.emit(pancakePair, 'Sync')

        let [pairReserve0, pairReserve1] = await pancakePair.getReserves()
        expect(pairReserve0).to.equal(initialLiquidityNative, 'Initial injected bnb value does not equal reserve0');
        expect(pairReserve1).to.equal(initialLiquidityTokens, 'Initial injected token value does not equal reserve1');
        initialLPBalance = await pancakePair.balanceOf(deployer.address);
    })

    describe('Solarmoon initial state', async () => {
        it('Owner owns all tokens on deployment', async () => {
            let numTokensDeployer = await solarMoon.balanceOf(deployer.address)

            // compensate for tokens used for liquidity in beforeEach
            numTokensDeployer = numTokensDeployer.add(initialLiquidityTokens)

            let totalSupply = await solarMoon.totalSupply()
            expect(numTokensDeployer).to.equal(totalSupply)
        })

        it('totalFees is zero after deployment', async () => {
            expect(await solarMoon.totalFees()).to.equal(ethers.constants.Zero)
        })

        it('Has lp-tokens balance after creation', async () => {
            initialLPBalance = await pancakePair.balanceOf(deployer.address)
            expect(initialLPBalance).to.be.gt(ethers.constants.Zero)
        })
    })
    /**
    describe('Excluding accounts will properly account to reflection value', async () => {
        beforeEach(async () => {
            await Solarmoon.connect(deployer).transfer(bob.address, BigNumber.from(tokenAmounts.fish));
            await Solarmoon.connect(deployer).transfer(fish.address, BigNumber.from(tokenAmounts.fish));
            await Solarmoon.connect(deployer).transfer(stan.address, BigNumber.from(tokenAmounts.orca));
        })

        it('Excluding an account with a balance greater then zero will add to excluded reflection amount', async () => {
            let initialExcludedReflectionAmount = await Solarmoon.getExcludedReflectionAmount()
            await Solarmoon.connect(deployer).transfer(stan.address, BigNumber.from(tokenAmounts.dolphin))
            await Solarmoon.connect(deployer).updateAccountExclusionState(stan.address, true, false)
            let updatedExcludedReflectionAmount = await Solarmoon.getExcludedReflectionAmount()

            expect(initialExcludedReflectionAmount).to.be.lt(
                updatedExcludedReflectionAmount,
                'Excluded reflection amount did not change between transfers'
            )
        })

        it('Excluding an account without a balance first and then transfering to it will add to excluded reflection amount', async () => {
            let initialAmount = await Solarmoon.getExcludedReflectionAmount()
            await Solarmoon.connect(deployer).updateAccountExclusionState(randy.address, true, false)
            await Solarmoon.connect(deployer).transfer(randy.address, BigNumber.from(tokenAmounts.shark))
            let newAmount = await Solarmoon.getExcludedReflectionAmount()

            expect(initialAmount).to.be.lt(newAmount, 'Reflection rate has changed between transfers')
        })

        it('Reflection rate after including an priorly excluded account stays the same', async () => {
            let oldRate = await Solarmoon.getReflectionRate();
            await Solarmoon.connect(deployer).updateAccountExclusionState(randy.address, true, false);
            await Solarmoon.connect(deployer).transfer(randy.address, BigNumber.from(tokenAmounts.shark));
            await Solarmoon.updateAccountExclusionState(randy.address, false, false);
            let newRate = await Solarmoon.getReflectionRate();

            expect(oldRate).to.be.equal(newRate, 'Reflection rate has not changed after inclusion')
        })

        it('Other account has not received any rewards from excluded transfers', async () => {
            await Solarmoon.connect(deployer).updateAccountExclusionState(randy.address, true, false)
            let initialBalanceFish = await Solarmoon.balanceOf(fish.address)
            await Solarmoon.connect(deployer).transfer(randy.address, BigNumber.from(tokenAmounts.shark))
            let updatedBalanceFish = await Solarmoon.balanceOf(fish.address)

            expect(initialBalanceFish).to.be.equal(updatedBalanceFish, 'Balance of fish has changed')
        })

        it('Transfering from a normal account to an excluded account will add to excluded reflection amount', async () => {
            await Solarmoon.connect(deployer).updateAccountExclusionState(stan.address, true, false)
            let initialExcludedReflectionAmount = await Solarmoon.getExcludedReflectionAmount()
            await Solarmoon.connect(bob).transfer(stan.address, BigNumber.from(tokenAmounts.fish))
            let updatedExcludedReflectionAmount = await Solarmoon.getExcludedReflectionAmount()

            expect(initialExcludedReflectionAmount).to.be.lt(
                updatedExcludedReflectionAmount,
                'Excluded reflection amount did not increase after transfer'
            )
        })

        it('Transfering from an excluded account to a normal account will subtract from excluded reflection amount', async () => {
            await Solarmoon.connect(deployer).updateAccountExclusionState(stan.address, true, false)
            await Solarmoon.connect(deployer).transfer(stan.address, BigNumber.from(tokenAmounts.dolphin))
            let initialExcludedReflectionAmount = await Solarmoon.getExcludedReflectionAmount()
            await Solarmoon.connect(stan).transfer(bob.address, BigNumber.from(tokenAmounts.fish))
            let updatedExcludedReflectionAmount = await Solarmoon.getExcludedReflectionAmount()

            expect(initialExcludedReflectionAmount).to.be.gt(
                updatedExcludedReflectionAmount,
                'Excluded reflection amount did not decrease after transfer'
            )
        })

        it('increases balance from liquidity tax on transfer from non-excluded account if contract is excluded from rewards', async () => {
            let initialBalanceContract = await Solarmoon.balanceOf(Solarmoon.address);
            await Solarmoon.connect(deployer).updateAccountExclusionState(Solarmoon.address, true, true);
            await Solarmoon.connect(fish).transfer(stan.address, BigNumber.from(tokenAmounts.shrimp));
            let updatedBalanceContract = await Solarmoon.balanceOf(Solarmoon.address);

            expect(updatedBalanceContract).to.be.gt(initialBalanceContract, "Balance of fish has changed");
        })

        it('increases balance from liquidity tax on transfer from non-excluded account if contract is excluded from rewards', async () => {
            let initialBalanceContract = await Solarmoon.balanceOf(Solarmoon.address);
            await Solarmoon.connect(deployer).updateAccountExclusionState(Solarmoon.address, true, true);
            await Solarmoon.connect(fish).transfer(stan.address, BigNumber.from(tokenAmounts.shrimp));
            let updatedBalanceContract = await Solarmoon.balanceOf(Solarmoon.address);

            expect(updatedBalanceContract).to.be.gt(initialBalanceContract, "Balance of fish has changed");
        })

        it('increases balance from liquidity tax on transfer from excluded account if contract is excluded from rewards', async () => {
            await Solarmoon.connect(deployer).updateAccountExclusionState(stan.address, true, false);
            let initialBalanceContract = await Solarmoon.balanceOf(Solarmoon.address);
            await Solarmoon.connect(deployer).updateAccountExclusionState(Solarmoon.address, true, true);
            await Solarmoon.connect(stan).transfer(fish.address, BigNumber.from(tokenAmounts.shrimp));
            let updatedBalanceContract = await Solarmoon.balanceOf(Solarmoon.address);

            expect(updatedBalanceContract).to.be.gt(initialBalanceContract, "Balance of fish has changed");
        })

        it('Other account does receive rewards on a transfer to a non-excluded account', async () => {
            let initialBalanceFish = await Solarmoon.balanceOf(fish.address);
            await Solarmoon.connect(deployer).updateAccountExclusionState(stan.address, true, false);
            let initialBalanceContract = await Solarmoon.balanceOf(Solarmoon.address);
            await Solarmoon.connect(deployer).updateAccountExclusionState(Solarmoon.address, true, true);
            await Solarmoon.connect(stan).transfer(fish.address, BigNumber.from(tokenAmounts.shrimp));
            let updatedBalanceContract = await Solarmoon.balanceOf(Solarmoon.address);

            expect(updatedBalanceContract).to.be.gt(initialBalanceContract, "Balance of fish has changed");
        })

        it('Other account does receive rewards on a transfer to a non-excluded account', async () => {
            let initialBalanceFish = await Solarmoon.balanceOf(fish.address)
            await Solarmoon.connect(deployer).updateAccountExclusionState(stan.address, true, false)
            await Solarmoon.connect(deployer).transfer(stan.address, BigNumber.from(tokenAmounts.dolphin))
            await Solarmoon.connect(stan).transfer(bob.address, BigNumber.from(tokenAmounts.fish))
            let updatedBalanceFish = await Solarmoon.balanceOf(fish.address)

            expect(initialBalanceFish).to.be.lt(updatedBalanceFish, 'Balance of fish has changed')
        })
    })
    
    describe('Users can interact with PancakeSwap', async () => {
        beforeEach(async () => {
            await Solarmoon.connect(deployer).transfer(whale.address, BigNumber.from(tokenAmounts.whale));
            await Solarmoon.connect(deployer).transfer(fish.address, BigNumber.from(tokenAmounts.whale));

        })

        it('User can buy tokens via pancakeswap', async () => {
            let deadline = (await latestBlockTimestamp()).add(60)

            expect(
                await pancakeRouter
                    .connect(karen)
                    .swapExactETHForTokensSupportingFeeOnTransferTokens(0, path, karen.address, deadline, {
                        value: ethers.utils.parseEther('10'),
                    })
            ).to.emit(pancakePair, 'Swap')
        })

        it('10% fee is being taken from the amount of tokens the user has bought and received', async () => {
            let deadline = (await latestBlockTimestamp()).add(60)

            let amountBeforeSwap = await Solarmoon.balanceOf(karen.address)
            let priceBeforeSwap = (await getPancakeTokenPrice(pancakeRouter, path, false)) as BigNumber

            await pancakeRouter
                .connect(karen)
                .swapExactETHForTokensSupportingFeeOnTransferTokens(0, path, karen.address, deadline, {
                    value: ethers.utils.parseEther('1'),
                })
            let amountAfterSwap = await Solarmoon.balanceOf(karen.address)

            expect(amountAfterSwap).to.be.lt(amountBeforeSwap.add(priceBeforeSwap))
        })

        it('User can sell tokens via pancakeswap', async () => {
            let deadline = (await latestBlockTimestamp()).add(60);
            await Solarmoon.connect(whale).approve(pancakeRouter.address, tokenAmounts.ultraWhale)
            expect(await pancakeRouter.connect(whale).swapExactTokensForETHSupportingFeeOnTransferTokens(tokenAmounts.fish, 0, path.reverse(), whale.address, deadline)).to.emit(pancakePair, 'Swap')
        })

        it('turns off liquidity provision', async () => {
            await Solarmoon.updateLiquidityProvisionState(false)
            let deadline = (await latestBlockTimestamp()).add(60);
            await pancakeRouter.connect(karen).swapExactETHForTokensSupportingFeeOnTransferTokens(0, path, karen.address, deadline, { value: ethers.utils.parseEther('100') })
            await Solarmoon.connect(fish).approve(pancakeRouter.address, tokenAmounts.ultraWhale)
            expect(await pancakeRouter.connect(fish).swapExactTokensForETHSupportingFeeOnTransferTokens(tokenAmounts.fish, 0, path.reverse(), fish.address, deadline)).to.not.emit(Solarmoon, 'LiquidityProvided')
        })

        it('turns on liquidity provision', async () => {
            await Solarmoon.updateLiquidityProvisionState(true)
            let deadline = (await latestBlockTimestamp()).add(60);
            await pancakeRouter.connect(karen).swapExactETHForTokensSupportingFeeOnTransferTokens(0, path, karen.address, deadline, { value: ethers.utils.parseEther('100') })
            await Solarmoon.connect(fish).approve(pancakeRouter.address, tokenAmounts.ultraWhale)
            expect(await pancakeRouter.connect(fish).swapExactTokensForETHSupportingFeeOnTransferTokens(tokenAmounts.fish, 0, path.reverse(), fish.address, deadline)).to.emit(Solarmoon, 'LiquidityProvided')
        })
    })

    describe('Solarmoon transfer between two normal accounts', async () => {
        beforeEach(async () => {
            await Solarmoon.connect(deployer).transfer(karen.address, BigNumber.from(tokenAmounts.shark))
            await Solarmoon.connect(deployer).transfer(bob.address, BigNumber.from(tokenAmounts.shrimp))
            await Solarmoon.connect(deployer).transfer(randy.address, BigNumber.from(tokenAmounts.orca))
            await Solarmoon.connect(deployer).transfer(stan.address, BigNumber.from(tokenAmounts.dolphin))
            await Solarmoon.connect(deployer).transfer(whale.address, BigNumber.from(tokenAmounts.whale))
            await Solarmoon.connect(deployer).transfer(fish.address, BigNumber.from(tokenAmounts.fish))
        })

        it('Tax gets applied on a transfer between two normal accounts', async () => {
            let initialBalanceStan = await Solarmoon.balanceOf(stan.address)

            await Solarmoon.connect(randy).transfer(stan.address, tokenAmounts.fish)
            let updatedBalanceStan = await Solarmoon.balanceOf(stan.address)
            expect(updatedBalanceStan).to.be.lt(
                initialBalanceStan.add(tokenAmounts.fish),
                'Tax has not been taken - the balance after the trade is greater or equal to the balance before plus the transfer amount'
            )
        })
    })

    describe('Solarmoon transfer between a normal account and a excluded account', async () => {
        beforeEach(async () => {
            await Solarmoon.connect(deployer).transfer(karen.address, BigNumber.from(tokenAmounts.shark));
            await Solarmoon.connect(deployer).transfer(bob.address, BigNumber.from(tokenAmounts.shrimp));
            await Solarmoon.connect(deployer).transfer(randy.address, BigNumber.from(tokenAmounts.orca));
            await Solarmoon.connect(deployer).transfer(stan.address, BigNumber.from(tokenAmounts.dolphin));
            await Solarmoon.updateAccountExclusionState(karen.address, false, false);
            await Solarmoon.updateAccountExclusionState(randy.address, false, false);
            await Solarmoon.updateAccountExclusionState(stan.address, true, false);
            await Solarmoon.updateAccountExclusionState(bob.address, true, false);
        })

        it('Tax gets applied on a transfer between two normal accounts', async () => {
            let initialBalanceStan = await Solarmoon.balanceOf(stan.address);
            await Solarmoon.connect(randy).transfer(stan.address, tokenAmounts.fish);
            let updatedBalanceStan = await Solarmoon.balanceOf(stan.address);

            expect(updatedBalanceStan).to.be.lt(initialBalanceStan.add(tokenAmounts.fish), "Tax has not been taken - the balance after the trade is greater or equal to the balance before plus the transfer amount")
        })
    })

    describe('Solarmoon transfer between a normal account and a excluded account', async () => {
        beforeEach(async () => {
            await Solarmoon.connect(deployer).transfer(karen.address, BigNumber.from(tokenAmounts.shark));
            await Solarmoon.connect(deployer).transfer(bob.address, BigNumber.from(tokenAmounts.shrimp));
            await Solarmoon.connect(deployer).transfer(randy.address, BigNumber.from(tokenAmounts.orca));
            await Solarmoon.connect(deployer).transfer(stan.address, BigNumber.from(tokenAmounts.dolphin));
            await Solarmoon.updateAccountExclusionState(karen.address, false, false);
            await Solarmoon.updateAccountExclusionState(randy.address, false, false);
            await Solarmoon.updateAccountExclusionState(stan.address, true, false);
            await Solarmoon.updateAccountExclusionState(bob.address, true, false);
        })

        it('Transfer between excluded accounts does not change excluded reflection amount', async () => {
            let initialExcludedReflectionAmount = await Solarmoon.getExcludedReflectionAmount();
            await Solarmoon.connect(stan).transfer(karen.address, tokenAmounts.fish);
            let updatedExcludedReflectionAmount = await Solarmoon.getExcludedReflectionAmount();

            expect(initialExcludedReflectionAmount).to.be.not.equal(updatedExcludedReflectionAmount, "Reflection amount did change between transfer");
        })
    })

    describe('Solarmoon transfer between two excluded accounts', async () => {
        beforeEach(async () => {
            await Solarmoon.connect(deployer).transfer(karen.address, BigNumber.from(tokenAmounts.shark));
            await Solarmoon.connect(deployer).transfer(bob.address, BigNumber.from(tokenAmounts.shrimp));
            await Solarmoon.connect(deployer).transfer(randy.address, BigNumber.from(tokenAmounts.orca));
            await Solarmoon.connect(deployer).transfer(stan.address, BigNumber.from(tokenAmounts.dolphin));
            await Solarmoon.updateAccountExclusionState(karen.address, true, false);
            await Solarmoon.updateAccountExclusionState(randy.address, true, false);
            await Solarmoon.updateAccountExclusionState(stan.address, true, false);
            await Solarmoon.updateAccountExclusionState(bob.address, true, false);
        })

        it('Transfer between excluded accounts does not change excluded reflection amount', async () => {
            let initialExcludedReflectionAmount = await Solarmoon.getExcludedReflectionAmount();
            await Solarmoon.connect(randy).transfer(karen.address, tokenAmounts.fish);
            let updatedExcludedReflectionAmount = await Solarmoon.getExcludedReflectionAmount();

            expect(initialExcludedReflectionAmount).to.be.equal(updatedExcludedReflectionAmount, "Reflection amount did change between transfer");
        })

        it('BalanceOf on excluded account returns the correct value', async () => {
            let excludedBalanceValue = await Solarmoon.balanceOf(stan.address);
            await Solarmoon.updateAccountExclusionState(stan.address, false, false);
            let nonExcludedBalanceValue = await Solarmoon.balanceOf(stan.address);

            expect(excludedBalanceValue).to.be.equal(nonExcludedBalanceValue, "Balances do not match")
        })
    })

    describe('Solarmoon contract extra behavior', async () => {
        let individualTaxAmount = BigNumber.from(3);
        let burnTaxAmount = BigNumber.from(5);
        let totalTax = BigNumber.from(18);
        it('can update taxes', async () => {
            await Solarmoon.updateTaxes({
                instantBoost: individualTaxAmount,
                charity: individualTaxAmount,
                communityBoost: individualTaxAmount,
                marketing: individualTaxAmount,
                liquidity: individualTaxAmount,
                burn: burnTaxAmount,
                totalTaxRate: totalTax
            })

            let burnTax = await Solarmoon.getTaxes();
            expect(burnTax).to.be.equal(burnTaxAmount, "returned value for burn tax did not match expected value")
        })

        it('cannot use approve with address zero as spender', async () => {
            await expect(Solarmoon.connect(karen).approve(ethers.constants.AddressZero, tokenAmounts.fish)).to.be.revertedWith("Solarmoon: approve to the zero address")
        })

        it('cannot use approve on same spender twice for non-zero value', async () => {
            await Solarmoon.connect(karen).approve(bob.address, tokenAmounts.fish);

            await expect(Solarmoon.connect(karen).approve(bob.address, tokenAmounts.fish)).to.be.revertedWith("Solarmoon: approve from non-zero to non-zero allowance")
        })

        it('returns the correct allowance amount', async () => {
            await Solarmoon.connect(bob).approve(karen.address, tokenAmounts.orca);
            let allowanceAmount = await Solarmoon.allowance(bob.address, karen.address)

            expect(allowanceAmount).to.be.equal(tokenAmounts.orca, "Allowance is not the same as the value that has been set")
        })

        it('can use increaseAllowance after the initial value has been set with approve', async () => {
            await Solarmoon.connect(stan).approve(randy.address, tokenAmounts.shrimp);

            await Solarmoon.connect(stan).increaseAllowance(randy.address, tokenAmounts.fish);
            let allowanceAmount = await Solarmoon.allowance(stan.address, randy.address);

            expect(allowanceAmount).to.be.equal(tokenAmounts.shrimp.add(tokenAmounts.fish), "Allowance value does not match expected amount")
        })

        it('cannot use decreaseAllowance to set the allowance below zero', async () => {
            await Solarmoon.connect(stan).approve(karen.address, tokenAmounts.orca);

            await expect(Solarmoon.connect(stan).decreaseAllowance(karen.address, tokenAmounts.whale)).to.be.revertedWith("Solarmoon: cannot decrease allowance below zero");
        })

        it('can use decreaseAllowance after the initial value has been set with approve', async () => {
            await Solarmoon.connect(stan).approve(karen.address, tokenAmounts.orca);

            await Solarmoon.connect(stan).decreaseAllowance(karen.address, tokenAmounts.dolphin);
            let allowanceAmount = await Solarmoon.allowance(stan.address, karen.address);

            expect(allowanceAmount).to.be.equal(tokenAmounts.orca.sub(tokenAmounts.dolphin), "Allowance value does not match expected amount")
        })

        it('reverts on transfer to zero address', async () => {

            await expect(Solarmoon.connect(randy).transfer(ethers.constants.AddressZero, tokenAmounts.fish)).to.be.revertedWith("Solarmoon: transfer to the zero address");
        })

        it('reverts on transfer with zero amount', async () => {

            await expect(Solarmoon.connect(randy).transfer(stan.address, ethers.constants.Zero)).to.be.revertedWith("Solarmoon: Transfer amount must be greater than zero");
        })
    })
    */
})
