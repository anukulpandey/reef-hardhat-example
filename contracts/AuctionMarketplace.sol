// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./BaseMarketplace.sol";

abstract contract AuctionMarketplace is BaseMarketplace {
    struct Auction {
        uint256 deadline;
        uint256 highestBid;
        address highestBidder;
    }

    mapping(uint256 => Auction) public auctions;

    event AuctionStarted(uint256 indexed id, uint256 deadline);
    event AuctionBid(uint256 indexed id, address indexed bidder, uint256 bid);

    function startAuction(uint256 id, uint256 duration) external onlyExisting(id) {
        auctions[id] = Auction(block.timestamp + duration, 0, address(0));
        emit AuctionStarted(id, block.timestamp + duration);
    }

    function placeBid(uint256 id) external payable {
        Auction storage a = auctions[id];
        require(block.timestamp < a.deadline, "Auction ended");
        require(msg.value > a.highestBid, "Bid too low");

        if (a.highestBidder != address(0)) {
            payable(a.highestBidder).transfer(a.highestBid);
        }

        a.highestBid = msg.value;
        a.highestBidder = msg.sender;

        emit AuctionBid(id, msg.sender, msg.value);
    }
}
