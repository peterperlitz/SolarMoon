import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

require('dotenv').config()

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log('\n======== SOLARMOON TOKEN ========')
    const { deployments, getNamedAccounts, network } = hre
    const { deploy, execute } = deployments
    const { deployer } = await getNamedAccounts()

    let pancakeRouter, owner, preSale
    if (network.name == 'mainnet') {
        pancakeRouter = process.env.MAINNET_PANCAKEROUTER
        owner = process.env.MAINNET_MULTISIG
    } else if (network.name == 'testnet') {
        pancakeRouter = process.env.TESTNET_PANCAKEROUTER
        owner = deployer
    } else {
        pancakeRouter = await (await deployments.get('MockPancakeRouter')).address
        owner = deployer
    }

    await deploy('InfrastructureVault', {
        from: deployer,
        log: true,
        contract: 'InfrastructureVault',
        args: [owner],
    })

    await deploy('DevWallet', {
        from: deployer,
        log: true,
        contract: 'DevWallet',
        args: [owner, 1624913963, 0, 30000, true],
    })

    await deploy('SOLAR', {
        from: deployer,
        log: true,
        contract: 'Solarmoon',
        args: [pancakeRouter],
    })
}

export default func
func.tags = ['solarmoon']