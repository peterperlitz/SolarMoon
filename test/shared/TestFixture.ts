import { ethers, deployments } from 'hardhat'

const setupPancakeSwap = deployments.createFixture(async ({ deployments, getNamedAccounts, ethers }, options) => {
    await deployments.fixture(['mocks', 'solarmoon'])
    let { deployer, admin, karen, bob, randy, stan, ultraWhale, whale, fish, shrimp } = await getNamedAccounts()

    const WETH = await deployments.get('WETH')
    const weth = await ethers.getContractAt('WETH9', WETH.address, ethers.provider.getSigner(deployer))

    const PancakeFactory = await deployments.get('MockPancakeFactory')
    const factory = await ethers.getContractAt('PancakeFactory', PancakeFactory.address, ethers.provider.getSigner(deployer))

    const PancakeRouter = await deployments.get('MockPancakeRouter')
    const router = await ethers.getContractAt('PancakeRouter', PancakeRouter.address, ethers.provider.getSigner(deployer))

    const Solarmoon = await deployments.get('SOLAR')
    const solarmoon = await ethers.getContractAt('Solarmoon', Solarmoon.address, ethers.provider.getSigner(deployer))

    const InfrastructureVault = await deployments.get('InfrastructureVault')
    const infrastructureVault = await ethers.getContractAt('InfrastructureVault', InfrastructureVault.address, ethers.provider.getSigner(deployer))

    const DevWallet = await deployments.get('DevWallet')
    const devWallet = await ethers.getContractAt('DevWallet', InfrastructureVault.address, ethers.provider.getSigner(deployer))

    return {
        deployer,
        admin,
        karen,
        bob,
        randy,
        stan,
        ultraWhale,
        whale,
        fish,
        shrimp,
        weth,
        factory,
        router,
        solarmoon,
        infrastructureVault,

    }
})

export { setupPancakeSwap as setupPancakeSwapTest }
