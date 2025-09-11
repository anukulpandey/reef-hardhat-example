// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "../interfaces/ISqwidMarketplaceBase.sol";
import "../interfaces/ISqwidERC1155.sol";
import "../types/MarketplaceStructs.sol";
import "../types/MarketplaceTypes.sol";
import "../utils/MarketplaceVars.sol";
import "../utils/MarketplaceModifiers.sol";
import "../utils/MarketplaceEvents.sol";

contract SqwidMarketplaceAuctionModule is ReentrancyGuard,MarketplaceModifiers,MarketplaceVars,MarketplaceEvents {
    using Counters for Counters.Counter;

    ISqwidMarketplaceBase public base;

    constructor(address baseAddress) {
        base = ISqwidMarketplaceBase(baseAddress);
    }

    //====================== AUCTION FUNCTIONS ======================//

    function createItemAuction(
        uint256 itemId,
        uint256 amount,
        uint256 numMinutes,
        uint256 minBid,
        address nftContract,
        uint256 tokenId,
        address sender
    ) external {
        require(amount > 0, "Amount cannot be 0");
        require(numMinutes >= 1 && numMinutes <= 44640, "Minutes invalid");

        // Transfer NFT to module
        ISqwidERC1155(nftContract).safeTransferFrom(sender, address(this), tokenId, amount, "");

        // Increment position
        _positionIds.increment();
        uint256 positionId = _positionIds.current();

        // Initialize AuctionData field by field (cannot assign struct with mappings directly)
        AuctionData storage auction = _idToAuctionData[positionId];
        auction.deadline = block.timestamp + numMinutes * 1 minutes;
        auction.minBid = minBid;
        auction.highestBid = 0;
        auction.highestBidder = address(0);
        auction.totalAddresses = 0;

        // Register available position in base
        base.updateAvailablePosition(itemId, sender);

        emit PositionUpdate(positionId, itemId, sender, amount, 0, base.getMarketFee(PositionState.Auction), PositionState.Auction);
    }

    function createBid(uint256 positionId) external payable nonReentrant {
        AuctionData storage auction = _idToAuctionData[positionId];
        require(block.timestamp <= auction.deadline, "Auction ended");

        uint256 totalBid = auction.addressToAmount[msg.sender] + msg.value;
        require(totalBid > auction.highestBid && totalBid >= auction.minBid, "Bid too low");

        auction.highestBid = totalBid;
        auction.highestBidder = msg.sender;

        if (msg.value == totalBid) {
            auction.indexToAddress[auction.totalAddresses] = msg.sender;
            auction.totalAddresses++;
        }
        auction.addressToAmount[msg.sender] = totalBid;

        // Extend deadline if last 10 minutes
        uint256 secsToDeadline = auction.deadline - block.timestamp;
        if (secsToDeadline < 600) auction.deadline += (600 - secsToDeadline);

        emit BidCreated(positionId, msg.sender, msg.value);
    }

    function endAuction(
        uint256 positionId,
        uint256 itemId,
        address seller,
        address nftContract,
        uint256 tokenId,
        uint256 amount
    ) external {
        AuctionData storage auction = _idToAuctionData[positionId];
        require(block.timestamp > auction.deadline, "Deadline not reached");

        address receiver;

        if (auction.highestBid > 0) {
            receiver = auction.highestBidder;

            // Process sale via base contract
            base.createItemTransaction(positionId, receiver, auction.highestBid, amount);


            // Update available position
            base.updateAvailablePosition(itemId, receiver);

            // Refund other bidders
            for (uint256 i; i < auction.totalAddresses; i++) {
                address addr = auction.indexToAddress[i];
                uint256 bidAmount = auction.addressToAmount[addr];
                if (addr != receiver) {
                    base.updateBalance(addr, bidAmount);
                }
            }

            emit MarketItemSold(itemId, nftContract, tokenId, seller, receiver, auction.highestBid, amount);
        } else {
            receiver = seller;
            ISqwidERC1155(nftContract).safeTransferFrom(address(this), seller, tokenId, amount, "");
        }

        // Clean up
        delete _idToAuctionData[positionId];
        emit PositionDelete(positionId);
    }
}
