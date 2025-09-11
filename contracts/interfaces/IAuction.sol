// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface ISqwidMarketplaceAuctionModule {
    /**
     * Create a new auction for an item
     */
    function createItemAuction(
        uint256 itemId,
        uint256 amount,
        uint256 numMinutes,
        uint256 minBid,
        address nftContract,
        uint256 tokenId,
        address sender
    ) external;

    /**
     * Place a bid on an auction
     */
    function createBid(uint256 positionId) external payable;

    /**
     * End the auction and process NFT sale or refund
     */
    function endAuction(
        uint256 positionId,
        uint256 itemId,
        address seller,
        address nftContract,
        uint256 tokenId,
        uint256 amount
    ) external;
}
