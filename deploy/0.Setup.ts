import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
require('dotenv').config()

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre
    const { deploy, execute } = deployments

    const { deployer } = await getNamedAccounts()
    console.log('\n======== DEPLOYMENT STARTED ========')
    console.log('Using Deployer account: ', deployer)

    if (network.name == 'hardhat' || network.name == 'localhost') {
        console.log('\n======== MOCKS ========')
        const weth = await deploy('WETH', {
            from: deployer,
            log: true,
            contract: 'WETH9',
        })

        const factory = await deploy('MockPancakeFactory', {
            from: deployer,
            log: true,
            contract: 'PancakeFactory',
            args: [deployer],
        })

        const router = await deploy('MockPancakeRouter', {
            from: deployer,
            log: true,
            contract: 'PancakeRouter',
            args: [factory.address, weth.address],
        })
    }
}

export default func
func.tags = ['mocks']
