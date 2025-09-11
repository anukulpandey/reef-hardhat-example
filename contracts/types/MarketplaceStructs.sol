// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./MarketplaceTypes.sol";
/**
 * Represents a specific token in the marketplace.
 */
struct Item {
    uint256 itemId; // Incremental ID in the market contract
    address nftContract;
    uint256 tokenId; // Incremental ID in the NFT contract
    address creator;
    uint256 positionCount;
    ItemSale[] sales;
}

/**
 * Represents the position of a certain amount of tokens for an owner.
 * E.g.:
 *      - Alice has 10 XYZ tokens in auction
 *      - Alice has 2 XYZ tokens for sale for 5 Reef
 *      - Alice has 1 ABC token in a raffle
 *      - Bob has 10 XYZ tokens in sale for 5 Reef
 */
struct Position {
    uint256 positionId;
    uint256 itemId;
    address payable owner;
    uint256 amount;
    uint256 price;
    uint256 marketFee; // Market fee at the moment of creating the item
    PositionState state;
}

struct ItemSale {
    address seller;
    address buyer;
    uint256 price;
    uint256 amount;
}

struct AuctionData {
    uint256 deadline;
    uint256 minBid;
    address highestBidder;
    uint256 highestBid;
    mapping(address => uint256) addressToAmount;
    mapping(uint256 => address) indexToAddress;
    uint256 totalAddresses;
}

struct RaffleData {
    uint256 deadline;
    uint256 totalValue;
    mapping(address => uint256) addressToAmount;
    mapping(uint256 => address) indexToAddress;
    uint256 totalAddresses;
}

struct LoanData {
    uint256 loanAmount;
    uint256 feeAmount;
    uint256 numMinutes;
    uint256 deadline;
    address lender;
}

struct AuctionDataResponse {
    uint256 deadline;
    uint256 minBid;
    address highestBidder;
    uint256 highestBid;
    uint256 totalAddresses;
}

struct RaffleDataResponse {
    uint256 deadline;
    uint256 totalValue;
    uint256 totalAddresses;
}
