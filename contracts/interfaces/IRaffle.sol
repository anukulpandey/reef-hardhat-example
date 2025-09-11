// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface ISqwidMarketplaceRaffleModule {
    /**
     * Creates a raffle from an existing market item
     */
    function createItemRaffle(
        uint256 itemId,
        uint256 amount,
        uint256 numMinutes
    ) external;

    /**
     * Enter an active raffle
     */
    function enterRaffle(uint256 positionId) external payable;

    /**
     * Ends an open raffle
     */
    function endRaffle(uint256 positionId) external;
}
