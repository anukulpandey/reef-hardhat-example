// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./SqwidMarketplaceBase.sol";

abstract contract SqwidMarketplaceSale is SqwidMarketplaceBase{   
    using Counters for Counters.Counter;  
    
    //////////////////////////////////////////////////////////////////////////
    /////////////////////////// REGULAR SALE /////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    /**
     * Puts on sale existing market item.
     */
    function putItemOnSale(
        uint256 itemId,
        uint256 amount,
        uint256 price
    ) public isLastVersion itemExists(itemId) {
        require(price > 0, "SqwidMarket: Price cannot be 0");
        require(amount > 0, "SqwidMarket: Amount cannot be 0");
        require(
            amount <=
                ISqwidERC1155(_idToItem[itemId].nftContract).balanceOf(
                    msg.sender,
                    _idToItem[itemId].tokenId
                ),
            "SqwidMarket: Address balance too low"
        );

        // Transfer ownership of the token to this contract
        ISqwidERC1155(_idToItem[itemId].nftContract).safeTransferFrom(
            msg.sender,
            address(this),
            _idToItem[itemId].tokenId,
            amount,
            ""
        );

        // Map new Position
        _positionIds.increment();
        uint256 positionId = _positionIds.current();
        uint256 marketFee = marketFees[PositionState.RegularSale];
        _idToPosition[positionId] = Position(
            positionId,
            itemId,
            payable(msg.sender),
            amount,
            price,
            marketFee,
            PositionState.RegularSale
        );

        _idToItem[itemId].positionCount++;
        _stateToCounter[PositionState.RegularSale].increment();

        emit PositionUpdate(
            positionId,
            itemId,
            msg.sender,
            amount,
            price,
            marketFee,
            PositionState.RegularSale
        );
    }

    /**
     * Creates a new sale for a existing market item.
     */
    function createSale(uint256 positionId, uint256 amount)
        external
        payable
        positionInState(positionId, PositionState.RegularSale)
        nonReentrant
    {
        require(_idToPosition[positionId].amount >= amount, "SqwidMarket: Amount too large");
        uint256 price = _idToPosition[positionId].price;
        require(msg.value == (price * amount), "SqwidMarket: Value sent is not valid");

        uint256 itemId = _idToPosition[positionId].itemId;
        address seller = _idToPosition[positionId].owner;

        // Process transaction
        _createItemTransaction(positionId, msg.sender, msg.value, amount);

        // Update item and item position
        _idToItem[itemId].sales.push(ItemSale(seller, msg.sender, msg.value, amount));
        if (amount == _idToPosition[positionId].amount) {
            // Sale ended
            delete _idToPosition[positionId];
            emit PositionDelete(positionId);
            _idToItem[itemId].positionCount--;
            _stateToCounter[PositionState.RegularSale].decrement();
        } else {
            // Partial sale
            _idToPosition[positionId].amount -= amount;
        }

        emit MarketItemSold(
            itemId,
            _idToItem[itemId].nftContract,
            _idToItem[itemId].tokenId,
            seller,
            msg.sender,
            msg.value,
            amount
        );

        _updateAvailablePosition(itemId, msg.sender);

        if (address(sqwidMigrator) != address(0)) {
            sqwidMigrator.positionClosed(itemId, msg.sender, true);
        }
    }

    /**
     * Unlist item from regular sale.
     */
    function unlistPositionOnSale(uint256 positionId)
        external
        positionInState(positionId, PositionState.RegularSale)
    {
        require(
            msg.sender == _idToPosition[positionId].owner,
            "SqwidMarket: Only seller can unlist item"
        );

        uint256 itemId = _idToPosition[positionId].itemId;

        // Transfer ownership back to seller
        ISqwidERC1155(_idToItem[itemId].nftContract).safeTransferFrom(
            address(this),
            msg.sender,
            _idToItem[itemId].tokenId,
            _idToPosition[positionId].amount,
            ""
        );

        // Delete item position
        delete _idToPosition[positionId];
        emit PositionDelete(positionId);
        _idToItem[itemId].positionCount--;
        _stateToCounter[PositionState.RegularSale].decrement();

        _updateAvailablePosition(itemId, msg.sender);

        if (address(sqwidMigrator) != address(0)) {
            sqwidMigrator.positionClosed(itemId, msg.sender, false);
        }
    }

}
