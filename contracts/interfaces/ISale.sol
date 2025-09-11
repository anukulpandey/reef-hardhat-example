// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface ISqwidMarketplaceSaleModule {
    /**
     * Puts an existing market item on regular sale
     */
    function putItemOnSale(
        uint256 itemId,
        uint256 amount,
        uint256 price
    ) external;

    /**
     * Creates a new sale for an existing market item
     */
    function createSale(uint256 positionId, uint256 amount) external payable;

    /**
     * Unlist item from regular sale
     */
    function unlistPositionOnSale(uint256 positionId) external;
}
