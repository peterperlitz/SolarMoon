pragma solidity =0.8.0;

// SPDX-License-Identifier: UNLICENSED
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./libraries/TransferHelper.sol";

/**
 * @title DevWallet
 * @dev A token holder contract that can release its token balance gradually like a
 * typical vesting scheme, with a cliff and vesting period. Optionally revocable by the
 * owner.
 */
contract DevWallet is Ownable {
    using SafeMath for uint256;

    event TokensReleased(address token, uint256 amount);
    event TokenVestingRevoked(address token);
    event BeneficiaryUpdated(address newBeneficiary);

    // beneficiary of tokens after they are released
    address public beneficiary;

    // Durations and timestamps are expressed in UNIX time, the same units as block.timestamp.
    uint256 public cliff;
    uint256 public start;
    uint256 public duration;
    bool public revocable;

    mapping(address => uint256) public released;
    mapping(address => bool) public revoked;

    /**
     * @dev Creates a vesting contract that vests its balance of any ERC20 token to the
     * beneficiary, gradually in a linear fashion until start + duration. By then all
     * of the balance will have vested.
     * @param _beneficiary address of the beneficiary to whom vested tokens are transferred
     * @param _cliffDuration duration in seconds of the cliff in which tokens will begin to vest
     * @param _start the time (as Unix time) at which point vesting starts
     * @param _duration duration in seconds of the period in which the tokens will vest
     * @param _revocable whether the vesting is revocable or not
     */
    constructor(
        address _beneficiary,
        uint256 _start,
        uint256 _cliffDuration,
        uint256 _duration,
        bool _revocable
    ) public {
        require(_beneficiary != address(0), "TokenVesting: beneficiary is the zero address");
        require(_cliffDuration <= _duration, "TokenVesting: cliff is longer than duration");
        require(_duration > 0, "TokenVesting: duration is 0");
        require(_start.add(_duration) > block.timestamp, "TokenVesting: final time is before current time");

        beneficiary = _beneficiary;
        revocable = _revocable;
        duration = _duration;
        cliff = _start.add(_cliffDuration);
        start = _start;
        transferOwnership(_beneficiary);
    }

    /**
     * @notice Transfers vested tokens to beneficiary.
     * @param _token ERC20 token which is being vested
     */
    function release(IERC20 _token) external {
        uint256 unreleased = _releasableAmount(_token);
        require(unreleased > 0, "TokenVesting: no tokens are due");

        released[address(_token)] = released[address(_token)].add(unreleased);
        TransferHelper.safeTransfer(address(_token), beneficiary, unreleased);

        emit TokensReleased(address(_token), unreleased);
    }

    /**
     * @notice Allows the owner to revoke the vesting. Tokens already vested
     * remain in the contract, the rest are returned to the owner.
     * @param _token ERC20 token which is being vested
     */
    function revoke(IERC20 _token) external onlyOwner {
        require(revocable, "TokenVesting: cannot revoke");
        require(!revoked[address(_token)], "TokenVesting: token already revoked");

        uint256 balance = _token.balanceOf(address(this));
        uint256 unreleased = _releasableAmount(_token);
        uint256 refund = balance.sub(unreleased);
        revoked[address(_token)] = true;

        TransferHelper.safeTransfer(address(_token), owner(), refund);
        emit TokenVestingRevoked(address(_token));
    }

    /**
     * @dev Calculates the amount that has already vested but hasn't been released yet.
     * @param _token ERC20 token which is being vested
     */
    function _releasableAmount(IERC20 _token) internal view returns (uint256) {
        return _vestedAmount(_token).sub(released[address(_token)]);
    }

    /**
     * @dev Calculates the amount that has already vested.
     * @param _token ERC20 token which is being vested
     */
    function _vestedAmount(IERC20 _token) internal view returns (uint256) {
        uint256 currentBalance = _token.balanceOf(address(this));
        uint256 totalBalance = currentBalance.add(released[address(_token)]);

        if (block.timestamp < cliff) {
            return 0;
        } else if (block.timestamp >= start.add(duration) || revoked[address(_token)]) {
            return totalBalance;
        } else {
            return totalBalance.mul(block.timestamp.sub(start)).div(duration);
        }
    }

    /**
     * @notice Allows the owner to update the beneficiary
     * @param _newBeneficiary new beneficiary that can redeem vested tokens
     */
    function updateBeneficiary(address _newBeneficiary) external onlyOwner {
        beneficiary = _newBeneficiary;
        emit BeneficiaryUpdated(_newBeneficiary);
    }
}
