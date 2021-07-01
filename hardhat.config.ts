import { HardhatUserConfig } from "hardhat/types";

import '@nomiclabs/hardhat-truffle5'
import '@nomiclabs/hardhat-waffle'
import 'hardhat-deploy'
import 'solidity-coverage'
import '@nomiclabs/hardhat-etherscan'
import 'hardhat-tracer'
import 'hardhat-log-remover'
import 'hardhat-typechain'

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            live: false,
            tags: ['local'],
            allowUnlimitedContractSize: true,
            accounts: {
                accountsBalance: '100000000000000000000000',
            },
        },
        localhost: {},
    },
    paths: {
        artifacts: 'build/artifacts',
        cache: 'build/cache',
        deploy: 'deploy',
        deployments: 'deployments',
        sources: 'contracts',
    },
    solidity: {
        compilers: [
            {
                version: '0.8.0',
            },
            {
                version: '0.7.6',
            },
            {
                version: '0.5.16',
            },
            {
                version: '0.6.6',
            },
        ],
        settings: {
            outputSelection: {
                '*': {
                    '*': ['storageLayout'],
                },
            },
            metadata: {
                bytecodeHash: 'none',
            },
        },
    },
    etherscan: {
        // Your API key for Etherscan
        // Obtain one at https://etherscan.io/
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
        admin: {
            default: 1,
        },
        karen: {
            default: 2,
        },
        bob: {
            default: 3,
        },
        randy: {
            default: 4,
        },
        stan: {
            default: 5,
        },
        ultraWhale: {
            default: 6,
        },
        whale: {
            default: 7,
        },
        fish: {
            default: 8,
        },
        shrimp: {
            default: 9,
        },
    },
};

export default config;
