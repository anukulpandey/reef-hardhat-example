// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../types/MarketplaceStructs.sol";
import "../interfaces/ISqwidMigrator.sol";

contract MarketplaceModifiers {
    mapping(uint256 => Item) internal _idToItem;
    mapping(uint256 => Position) internal _idToPosition;
    ISqwidMigrator public sqwidMigrator;

    // ===== Modifiers =====

    modifier itemExists(uint256 itemId) {
        require(_idToItem[itemId].itemId > 0, "SqwidMarket: Item not found");
        _;
    }

    modifier positionInState(uint256 positionId, PositionState expectedState) {
        require(_idToPosition[positionId].positionId > 0, "SqwidMarket: Position not found");
        require(
            _idToPosition[positionId].state == expectedState,
            "SqwidMarket: Position on wrong state"
        );
        _;
    }

    modifier isLastVersion() {
        require(address(sqwidMigrator) == address(0), "SqwidMarket: Not last market version");
        _;
    }
}
