import { HardhatUserConfig } from "hardhat/types";

import '@nomiclabs/hardhat-truffle5'
import '@nomiclabs/hardhat-waffle'
import 'hardhat-deploy'
import 'solidity-coverage'
import '@nomiclabs/hardhat-etherscan'
import 'typechain'
import 'hardhat-tracer'
import 'hardhat-log-remover'

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
};

export default config;
