// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./SqwidMarketplaceBase.sol";

abstract contract SqwidMarketplaceAuction is SqwidMarketplaceBase{   
    using Counters for Counters.Counter;  
    ////////////////////////////////////////////////////////////////////////
    /////////////////////////// AUCTION ////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////

    /**
     * Creates an auction from an existing market item.
     */
    function createItemAuction(
        uint256 itemId,
        uint256 amount,
        uint256 numMinutes,
        uint256 minBid
    ) public isLastVersion itemExists(itemId) {
        address nftContract = _idToItem[itemId].nftContract;
        uint256 tokenId = _idToItem[itemId].tokenId;
        require(
            amount <= ISqwidERC1155(nftContract).balanceOf(msg.sender, tokenId),
            "SqwidMarket: Address balance too low"
        );
        require(amount > 0, "SqwidMarket: Amount cannot be 0");
        require(numMinutes >= 1 && numMinutes <= 44640, "SqwidMarket: Number of minutes invalid"); // 44,640 min = 1 month

        // Transfer ownership of the token to this contract
        ISqwidERC1155(nftContract).safeTransferFrom(msg.sender, address(this), tokenId, amount, "");

        // Map new Position
        Counters.increment(_positionIds);
        uint256 positionId = _positionIds.current();
        uint256 marketFee = marketFees[PositionState.Auction];
        _idToPosition[positionId] = Position(
            positionId,
            itemId,
            payable(msg.sender),
            amount,
            0,
            marketFee,
            PositionState.Auction
        );

        _idToItem[itemId].positionCount++;

        // Create AuctionData
        uint256 deadline = (block.timestamp + numMinutes * 1 minutes);
        _idToAuctionData[positionId].deadline = deadline;
        _idToAuctionData[positionId].minBid = minBid;

        _stateToCounter[PositionState.Auction].increment();

        emit PositionUpdate(
            positionId,
            itemId,
            msg.sender,
            amount,
            0,
            marketFee,
            PositionState.Auction
        );
    }

    /**
     * Adds bid to an active auction.
     */
    function createBid(uint256 positionId)
        external
        payable
        positionInState(positionId, PositionState.Auction)
        nonReentrant
    {
        require(
            _idToAuctionData[positionId].deadline >= block.timestamp,
            "SqwidMarket: Auction has ended"
        );
        uint256 totalBid = _idToAuctionData[positionId].addressToAmount[msg.sender] + msg.value;
        require(
            totalBid > _idToAuctionData[positionId].highestBid &&
                totalBid >= _idToAuctionData[positionId].minBid,
            "SqwidMarket: Bid value invalid"
        );

        // Update AuctionData
        _idToAuctionData[positionId].highestBid = totalBid;
        _idToAuctionData[positionId].highestBidder = msg.sender;
        if (msg.value == totalBid) {
            _idToAuctionData[positionId].indexToAddress[
                _idToAuctionData[positionId].totalAddresses
            ] = payable(msg.sender);
            _idToAuctionData[positionId].totalAddresses += 1;
        }
        _idToAuctionData[positionId].addressToAmount[msg.sender] = totalBid;

        // Extend deadline if we are on last 10 minutes
        uint256 secsToDeadline = _idToAuctionData[positionId].deadline - block.timestamp;
        if (secsToDeadline < 600) {
            _idToAuctionData[positionId].deadline += (600 - secsToDeadline);
        }

        emit BidCreated(positionId, msg.sender, msg.value);
    }

    /**
     * Distributes NFTs and bidded amount after auction deadline is reached.
     */
    function endAuction(uint256 positionId)
        external
        positionInState(positionId, PositionState.Auction)
        nonReentrant
    {
        require(
            _idToAuctionData[positionId].deadline < block.timestamp,
            "SqwidMarket: Deadline not reached"
        );

        uint256 itemId = _idToPosition[positionId].itemId;
        address seller = _idToPosition[positionId].owner;
        address receiver;
        uint256 amount = _idToPosition[positionId].amount;

        // Check if there are bids
        if (_idToAuctionData[positionId].highestBid > 0) {
            receiver = _idToAuctionData[positionId].highestBidder;
            // Create transaction
            _createItemTransaction(
                positionId,
                receiver,
                _idToAuctionData[positionId].highestBid,
                amount
            );
            // Add sale to item
            _idToItem[itemId].sales.push(
                ItemSale(seller, receiver, _idToAuctionData[positionId].highestBid, amount)
            );
            // Send back bids to other bidders
            uint256 totalAddresses = _idToAuctionData[positionId].totalAddresses;
            for (uint256 i; i < totalAddresses; i++) {
                address addr = _idToAuctionData[positionId].indexToAddress[i];
                uint256 bidAmount = _idToAuctionData[positionId].addressToAmount[addr];
                if (addr != receiver) {
                    _updateBalance(addr, bidAmount);
                }
            }
            emit MarketItemSold(
                itemId,
                _idToItem[itemId].nftContract,
                _idToItem[itemId].tokenId,
                seller,
                receiver,
                _idToAuctionData[positionId].highestBid,
                amount
            );
        } else {
            receiver = seller;
            // Transfer ownership of the token back to seller
            ISqwidERC1155(_idToItem[itemId].nftContract).safeTransferFrom(
                address(this),
                seller,
                _idToItem[itemId].tokenId,
                amount,
                ""
            );
        }

        // Delete position and auction data
        delete _idToAuctionData[positionId];
        delete _idToPosition[positionId];
        emit PositionDelete(positionId);
        _idToItem[itemId].positionCount--;
        _stateToCounter[PositionState.Auction].decrement();

        _updateAvailablePosition(itemId, receiver);

        if (address(sqwidMigrator) != address(0)) {
            sqwidMigrator.positionClosed(itemId, receiver, receiver != seller);
        }
    }

}