// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Counters.sol";
import "../types/MarketplaceStructs.sol";
import "../interfaces/ISqwidERC1155.sol";

contract MarketplaceEvents {
    using Counters for Counters.Counter;
    // events================================

    event ItemCreated(
        uint256 indexed itemId,
        address indexed nftContract,
        uint256 indexed tokenId,
        address creator
    );

    event PositionUpdate(
        uint256 indexed positionId,
        uint256 indexed itemId,
        address indexed owner,
        uint256 amount,
        uint256 price,
        uint256 marketFee,
        PositionState state
    );

    event PositionDelete(uint256 indexed positionId);

    event MarketItemSold(
        uint256 indexed itemId,
        address indexed nftContract,
        uint256 indexed tokenId,
        address seller,
        address buyer,
        uint256 price,
        uint256 amount
    );

    event BidCreated(
        uint256 indexed positionId,
        address indexed bidder,
        uint256 indexed value
    );

    event RaffleEntered(
        uint256 indexed positionId,
        address indexed addr,
        uint256 indexed value
    );

    event LoanFunded(uint256 indexed positionId, address indexed funder);

    event BalanceUpdated(address indexed addr, uint256 indexed value);
}
