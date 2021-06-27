pragma solidity =0.8.0;

// SPDX-License-Identifier: LGPL-3.0-or-newer

struct Balances {
    uint256 reflection;
    uint256 tokens;
}

struct TokenStats {
    uint256 totalReflection;
    uint256 totalTokens;
    uint256 totalFees;
    uint256 totalExcludedReflection;
    uint256 totalExcludedTokens;
    uint256 liquidityTokens;
}

struct ExemptionStats {
    bool isExcluded;
    bool isExcludedFromFee;
}

struct TaxRates {
    uint32 distribution;
    uint32 infrastructure;
    uint32 liquidity;
    uint32 totalTaxRate;
}

struct CalculationParameters {
    uint256 reflectionAmount;
    uint256 reflectionTransferAmount;
    uint256 tokenTransferAmount;
}

struct TaxCalculationParameters {
    uint256 distributionValue;
    uint256 distributionReflectionValue;
    uint256 infrastructureValue;
    uint256 infrastructureReflectionValue;
    uint256 liquidityValue;
    uint256 liquidityReflectionValue;
    uint256 tokenTaxSum;
    uint256 reflectionTaxSum;
}