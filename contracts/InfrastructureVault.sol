pragma solidity =0.8.0;

// SPDX-License-Identifier: UNLICENSED
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./libraries/TransferHelper.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract InfrastructureVault is Ownable {
    event WithdrawNativeCurrency(address indexed recipent, uint256 amount);
    event WithdrawBEPToken(address indexed recipient, address token, uint256 amount);

    constructor(address _owner) {
        transferOwnership(_owner);
    }

    function withdrawNativeCurrency(address recipent, uint256 amount) external onlyOwner {
        TransferHelper.safeTransferETH(recipent, amount);
        emit WithdrawNativeCurrency(recipent, amount);
    }

    function withdrawBEPToken(
        address recipient,
        address token,
        uint256 amount
    ) external onlyOwner {
        TransferHelper.safeTransfer(token, recipient, amount);
        emit WithdrawBEPToken(recipient, token, amount);
    }

    // fallback
    receive() external payable {}
}
