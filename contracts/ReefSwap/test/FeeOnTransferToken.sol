// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FeeOnTransferToken is ERC20 {
    uint256 public immutable feeBps;

    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        uint256 initialSupply,
        uint256 feeBasisPoints
    ) ERC20(tokenName, tokenSymbol) {
        require(feeBasisPoints < 10_000, "FeeOnTransferToken: INVALID_FEE");
        feeBps = feeBasisPoints;
        _mint(msg.sender, initialSupply);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0) || feeBps == 0) {
            super._update(from, to, value);
            return;
        }

        uint256 fee = (value * feeBps) / 10_000;
        uint256 amountAfterFee = value - fee;

        super._update(from, to, amountAfterFee);

        if (fee > 0) {
            super._update(from, address(0), fee);
        }
    }
}
