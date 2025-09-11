//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../types/MarketplaceTypes.sol";
import "../types/MarketplaceStructs.sol";

interface ISqwidMarketplaceBase {
    function createItem(uint256 tokenId) external returns (uint256);

    function addAvailableTokens(uint256 itemId) external;

    function pseudoRand() external view returns (uint256);

    function fetchItem(uint256 itemId) external view returns (Item memory);

    function fetchPosition(
        uint256 positionId
    ) external view returns (Position memory);

    function fetchLoanData(
        uint256 positionId
    ) external view returns (LoanData memory);

    function _updateAvailablePosition(
        uint256 itemId,
        address tokenOwner
    ) external;

    function _updateBalance(address addr, uint256 value) external;

    function getMarketFee(PositionState state) external view returns (uint256);

    function createItemTransaction(
        uint256 positionId,
        address tokenRecipient,
        uint256 saleValue,
        uint256 amount
    ) external;
}
