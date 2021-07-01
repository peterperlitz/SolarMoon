pragma solidity =0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./libraries/Structs.sol";
import "./interfaces/IPancakeRouter02.sol";
import "./interfaces/IPancakeFactory.sol";

contract Solarmoon is Ownable, IERC20 {
    using SafeMath for uint256;
    using Address for address;

    uint256 public TOTAL_SUPPLY = 10e23;
    uint256 private constant _MAX_UINT = ~uint256(0);
    uint8 private constant _HUNDRED_PERCENT = 100;
    uint256 private _TOTAL_REFLECTION = (_MAX_UINT - _MAX_UINT.mod(TOTAL_SUPPLY));

    TokenStats internal _stats = TokenStats(_TOTAL_REFLECTION, TOTAL_SUPPLY, 0, 0, 0, 0);
    TaxRates internal _taxRates = TaxRates(2, 6, 2, 10);

    uint256 internal tokenLiquidityThreshold = 50e19;
    bool private _isProvidingLiquidity = false;
    bool private _liquidityMutex = false;

    IPancakeRouter02 public immutable router;
    address public immutable pair;

    mapping(address => Balances) private _balances;
    mapping(address => ExemptionStats) private _exemptions;
    mapping(address => mapping(address => uint256)) private _allowances;

    string private _name = "Solarmoon";
    string private _symbol = "SOLAR";

    event LiquidityProvided(uint256 tokenAmount, uint256 nativeAmount, uint256 exchangeAmount);
    event LiquidityProvisionStateChanged(bool newState);
    event LiquidityThresholdUpdated(uint256 newThreshold);
    event AccountExclusionStateChanged(address account, bool excludeFromReward, bool excludeFromFee);

    modifier mutexLock() {
        if (!_liquidityMutex) {
            _liquidityMutex = true;
            _;
            _liquidityMutex = false;
        }
    }

    constructor(address pancakeRouter) {
        address deployer = _msgSender();

        _balances[deployer].reflection = _stats.totalReflection;
        emit Transfer(address(0), deployer, _stats.totalTokens);

        _exemptions[deployer].isExcludedFromFee = true;
        _exemptions[address(this)].isExcludedFromFee = true;

        IPancakeRouter02 _router = IPancakeRouter02(pancakeRouter);
        router = _router;
        pair = IPancakeFactory(_router.factory()).createPair(address(this), _router.WETH());
    }

    /**
     * @dev fallback to receive bnb
     *
     */
    receive() external payable {}

    function name() public view virtual returns (string memory) {
        return _name;
    }

    function symbol() public view virtual returns (string memory) {
        return _symbol;
    }

    function decimals() public view virtual returns (uint8) {
        return 9;
    }

    function totalSupply() external view virtual override returns (uint256) {
        return _stats.totalTokens;
    }

    function totalFees() external view returns (uint256) {
        return _stats.totalFees;
    }

    /**
     * @dev function to migrate liquidity to pancakeSwap
     *
     */
    function balanceOf(address account) public view override returns (uint256) {
        if (_exemptions[account].isExcluded) return _balances[account].tokens;
        return tokenFromReflection(_balances[account].reflection);
    }

    /**
     * @dev function to migrate liquidity to pancakeSwap
     *
     */
    function reflectionFromToken(uint256 amountTokens, bool deductFees) public view returns (uint256) {
        require(amountTokens <= _stats.totalTokens, "Solarmoon: amount must be less than total supply");
        (CalculationParameters memory params, ) = calculateValues(amountTokens, deductFees);
        return params.reflectionTransferAmount;
    }

    /**
     * @dev function to migrate liquidity to pancakeSwap
     *
     */
    function tokenFromReflection(uint256 reflectionAmount) internal view returns (uint256) {
        require(reflectionAmount <= _stats.totalReflection, "Solarmoon: amount has to be less or equal to total reflection");
        uint256 rate = calculateReflectionRate();

        return reflectionAmount.div(rate);
    }

    function allowance(address owner, address spender) public view virtual override returns (uint256) {
        return _allowances[owner][spender];
    }

    /**
     * @dev SafeERC20 approve implementation that only allows approvals from or to
     * a zero amount. Increase- or DecreaseAllowance should be used for anything else
     *
     */
    function approve(address spender, uint256 amount) external override returns (bool) {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    /**
     * @dev function to increase the allowance of a spender
     *
     */
    function increaseAllowance(address spender, uint256 value) external returns (bool) {
        uint256 newValue = allowance(_msgSender(), spender).add(value);
        _approve(_msgSender(), spender, newValue);
        return true;
    }

    /**
     * @dev function to decrease the allowance of a spender
     *
     */
    function decreaseAllowance(address spender, uint256 value) external returns (bool) {
        uint256 oldValue = allowance(_msgSender(), spender);
        require(oldValue >= value, "Solarmoon: cannot decrease allowance below zero");
        uint256 newValue = oldValue.sub(value);
        _approve(_msgSender(), spender, newValue);
        return true;
    }

    /**
     * @dev ERC20 transfer
     *
     */
    function transfer(address recipient, uint256 amount) external override returns (bool) {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    /**
     * @dev ERC20 transferFrom
     *
     */
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external override returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(sender, _msgSender(), _allowances[sender][_msgSender()].sub(amount, "Solarmoon: transfer amount exceeds allowance"));
        return true;
    }

    /**
     * @dev update threshold for liquidity adding
     *
     */
    function updateLiquidityThreshold(uint256 threshold) external onlyOwner {
        require(threshold > 0, "Solarmoon: Cannot set threshold to zero");
        tokenLiquidityThreshold = threshold;

        emit LiquidityThresholdUpdated(tokenLiquidityThreshold);
    }

    /**
     * @dev turn liquidity adding on and off
     *
     */
    function updateLiquidityProvisionState(bool state) external onlyOwner {
        _isProvidingLiquidity = state;

        emit LiquidityProvisionStateChanged(_isProvidingLiquidity);
    }

    /**
     * @dev external wrapper to update reward exclusion state
     *
     */
    function updateRewardExclusionState(address account, bool exclude) external onlyOwner {
        updateAccountExclusionState(account, exclude, _exemptions[account].isExcludedFromFee);
    }


    /**
     * @dev external wrapper to update fee exclusion state
     *
     */
    function updateFeeExclusionState(address account, bool exclude) external onlyOwner {
        updateAccountExclusionState(account, _exemptions[account].isExcluded, exclude);
    }

    /**
     * @dev internal function to handle changes in exclusion state
     *
     */
    function updateAccountExclusionState(
        address account,
        bool excludeFromReward,
        bool excludeFromFees
    ) internal {
        TokenStats storage stats = _stats;
        if (excludeFromReward && !_exemptions[account].isExcluded) {
            _balances[account].tokens = tokenFromReflection(_balances[account].reflection);
            stats.totalExcludedReflection = _stats.totalExcludedReflection.add(_balances[account].reflection);
            stats.totalExcludedTokens = _stats.totalExcludedTokens.add(_balances[account].tokens);
        }
        if (!excludeFromReward && _exemptions[account].isExcluded) {
            stats.totalExcludedReflection = _stats.totalExcludedReflection.sub(_balances[account].reflection);
            stats.totalExcludedTokens = _stats.totalExcludedTokens.sub(_balances[account].tokens);

            _balances[account].tokens = 0;
        }

        _exemptions[account].isExcludedFromFee = excludeFromFees;
        _exemptions[account].isExcluded = excludeFromReward;

        emit AccountExclusionStateChanged(account, excludeFromReward, excludeFromFees);
    }

    /**
     * @dev internal function to handle excluded or standard transfers
     *
     */
    function extendedTransfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal {
        bool isFromExcluded = _exemptions[sender].isExcluded;
        bool isToExcluded = _exemptions[recipient].isExcluded;

        bool takeFees = !(_exemptions[sender].isExcludedFromFee || _exemptions[recipient].isExcludedFromFee);

        if (isFromExcluded || isToExcluded) {
            extendedTransferExcluded(sender, recipient, amount, isToExcluded, isFromExcluded, takeFees);
        } else {
            extendedTransferStandard(sender, recipient, amount, takeFees);
        }
    }

    /**
     * @dev non excluded transfer
     *
     */
    function extendedTransferStandard(
        address sender,
        address recipient,
        uint256 amount,
        bool takeFees
    ) internal {
        (CalculationParameters memory params, TaxCalculationParameters memory taxParams) = calculateValues(amount, takeFees);

        _balances[sender].reflection = _balances[sender].reflection.sub(
            params.reflectionAmount,
            "Solarmoon: transfer amount exceeds balance"
        );
        _balances[recipient].reflection = _balances[recipient].reflection.add(params.reflectionTransferAmount);

        if (_exemptions[address(this)].isExcluded)
            _balances[address(this)].tokens = _balances[address(this)].tokens.add(taxParams.liquidityValue);

        _balances[address(this)].reflection = _balances[address(this)].reflection.add(taxParams.liquidityReflectionValue);

        if (takeFees) {
            collectTaxes(taxParams);
        }
    }

    /**
     * @dev excluded transfer
     *
     */
    function extendedTransferExcluded(
        address sender,
        address recipient,
        uint256 amount,
        bool isToExcluded,
        bool isFromExcluded,
        bool takeFees
    ) internal {
        (CalculationParameters memory params, TaxCalculationParameters memory taxParams) = calculateValues(amount, takeFees);
        TokenStats storage stats = _stats;

        if (isToExcluded && isFromExcluded) {
            _balances[sender].reflection = _balances[sender].reflection.sub(
                params.reflectionAmount,
                "Solarmoon: transfer amount exceeds balance"
            );
            _balances[sender].tokens = _balances[sender].tokens.sub(amount, "Solarmoon: transfer amount exceeds balance");
            _balances[recipient].reflection = _balances[recipient].reflection.add(params.reflectionTransferAmount);
            _balances[recipient].tokens = _balances[recipient].tokens.add(params.tokenTransferAmount);
        } else if (isToExcluded) {
            _balances[sender].reflection = _balances[sender].reflection.sub(
                params.reflectionAmount,
                "Solarmoon: transfer amount exceeds balance"
            );

            _balances[recipient].reflection = _balances[recipient].reflection.add(params.reflectionTransferAmount);
            _balances[recipient].tokens = _balances[recipient].tokens.add(params.tokenTransferAmount);

            // since the transfer is to an excluded account, we have to keep account of the total excluded reflection amount (add)
            stats.totalExcludedReflection = _stats.totalExcludedReflection.add(params.reflectionTransferAmount);
            stats.totalExcludedTokens = _stats.totalExcludedTokens.add(params.tokenTransferAmount);
        } else {
            _balances[sender].reflection = _balances[sender].reflection.sub(
                params.reflectionAmount,
                "Solarmoon: transfer amount exceeds balance"
            );
            _balances[sender].tokens = _balances[sender].tokens.sub(
                params.tokenTransferAmount,
                "Solarmoon: transfer amount exceeds balance"
            );

            _balances[recipient].reflection = _balances[recipient].reflection.add(params.reflectionTransferAmount);

            // since the transfer is from an excluded account, we have to keep account of the total excluded reflection amount (remove)
            stats.totalExcludedReflection = _stats.totalExcludedReflection.sub(params.reflectionTransferAmount);
            stats.totalExcludedTokens = _stats.totalExcludedTokens.sub(params.tokenTransferAmount);
        }

        if (_exemptions[address(this)].isExcluded)
            _balances[address(this)].tokens = _balances[address(this)].tokens.add(taxParams.liquidityValue);

        _balances[address(this)].reflection = _balances[address(this)].reflection.add(taxParams.liquidityReflectionValue);

        if (takeFees) {
            collectTaxes(taxParams);
        }
    }

    /**
     * @dev calculate reflection values
     *
     */
    function calculateValues(uint256 tokenAmount, bool isTakingFees)
        internal
        view
        returns (CalculationParameters memory, TaxCalculationParameters memory)
    {
        uint256 rate = calculateReflectionRate();

        CalculationParameters memory params = CalculationParameters(0, 0, 0);
        TaxCalculationParameters memory taxParams = TaxCalculationParameters(0, 0, 0, 0, 0, 0, 0, 0);

        taxParams = isTakingFees ? calculateTaxes(_taxRates, tokenAmount, rate) : taxParams;

        params.reflectionAmount = tokenAmount.mul(rate);

        if (isTakingFees) {
            params.tokenTransferAmount = tokenAmount.sub(taxParams.tokenTaxSum);
            params.reflectionTransferAmount = params.reflectionAmount.sub(taxParams.reflectionTaxSum);
        } else {
            params.tokenTransferAmount = tokenAmount;
            params.reflectionTransferAmount = params.reflectionAmount;
        }

        return (params, taxParams);
    }

    /**
     * @dev calculate current reflection rate
     *
     */
    function calculateReflectionRate() internal view returns (uint256) {
        (uint256 reflectionSupply, uint256 tokenSupply) = calculateActualSupply();

        return reflectionSupply.div(tokenSupply);
    }

    /**
     * @dev calculate taxes
     *
     */
    function calculateTaxes(
        TaxRates memory taxes,
        uint256 tokenAmount,
        uint256 rate
    ) internal pure returns (TaxCalculationParameters memory) {
        TaxCalculationParameters memory params;

        params.distributionValue = tokenAmount.mul(taxes.distribution).div(_HUNDRED_PERCENT);
        params.distributionReflectionValue = params.distributionValue.mul(rate);

        params.infrastructureValue = tokenAmount.mul(taxes.infrastructure).div(_HUNDRED_PERCENT);
        params.infrastructureReflectionValue = params.infrastructureValue.mul(rate);

        params.liquidityValue = tokenAmount.mul(taxes.liquidity).div(_HUNDRED_PERCENT);
        params.liquidityReflectionValue = params.liquidityValue.mul(rate);

        params.tokenTaxSum = tokenAmount.mul(taxes.totalTaxRate).div(_HUNDRED_PERCENT);
        params.reflectionTaxSum = params.tokenTaxSum.mul(rate);

        return params;
    }

    /**
     * @dev calculate current supply
     *
     */
    function calculateActualSupply() internal view returns (uint256, uint256) {
        uint256 reflectionSupply = _stats.totalReflection;
        uint256 tokenSupply = _stats.totalTokens;

        reflectionSupply = reflectionSupply.sub(_stats.totalExcludedReflection);
        tokenSupply = tokenSupply.sub(_stats.totalExcludedTokens);

        if (reflectionSupply < _stats.totalReflection.div(_stats.totalTokens)) return (_stats.totalReflection, _stats.totalTokens);

        return (reflectionSupply, tokenSupply);
    }

    

    /**
     * @dev subtract taxes from actual token supply, to keep rate
     *
     */
    function collectTaxes(TaxCalculationParameters memory params) internal {
        TokenStats storage stats = _stats;
        stats.totalReflection = _stats.totalReflection.sub(params.distributionReflectionValue);
        stats.totalFees = _stats.totalFees.add(params.distributionValue);
    }

    /**
     * @dev internal _approve
     *
     */
    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) private {
        require(spender != address(0), "Solarmoon: approve to the zero address");
        require(owner != address(0), "Solarmoon: approve from the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    /**
     * @dev internal _transfer
     *
     */
    function _transfer(
        address from,
        address to,
        uint256 amount
    ) private {
        require(to != address(0), "Solarmoon: transfer to the zero address");
        require(from != address(0), "Solarmoon: transfer from the zero address");
        require(amount > 0, "Solarmoon: Transfer amount must be greater than zero");

        extendedTransfer(from, to, amount);

        if (!(from == address(pair) || to == address(pair)) && _isProvidingLiquidity) {
            provideLiquidity();
        }

        emit Transfer(from, to, amount);
    }

    /**
     * @dev function to migrate liquidity to pancakeSwap
     *
     */
    function provideLiquidity() private mutexLock {
        uint256 contractBalance = balanceOf(address(this));
        if (contractBalance >= tokenLiquidityThreshold) {
            contractBalance = tokenLiquidityThreshold;
            uint256 exchangeAmount = contractBalance.div(2);
            uint256 tokenAmount = contractBalance.sub(exchangeAmount);

            uint256 ignore = address(this).balance;
            exchangeTokenToNativeCurrency(exchangeAmount);
            uint256 profit = address(this).balance.sub(ignore);

            addToLiquidityPool(tokenAmount, profit);
            emit LiquidityProvided(exchangeAmount, profit, tokenAmount);
        }
    }

    /**
     * @dev function to swap token to native currency
     *
     */
    function exchangeTokenToNativeCurrency(uint256 tokenAmount) private {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = router.WETH();

        _approve(address(this), address(router), tokenAmount);
        router.swapExactTokensForETHSupportingFeeOnTransferTokens(tokenAmount, 0, path, address(this), block.timestamp);
    }

    /**
     * @dev function to add token and native currency to liquidity pool
     *
     */
    function addToLiquidityPool(uint256 tokenAmount, uint256 nativeAmount) private {
        _approve(address(this), address(router), tokenAmount);
        router.addLiquidityETH{value: nativeAmount}(address(this), tokenAmount, 0, 0, address(0), block.timestamp);
    }

}
