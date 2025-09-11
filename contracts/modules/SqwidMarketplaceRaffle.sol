//SPDX-License-Identifier:MIT
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

contract SqwidMarketplaceRaffleModule is MarketplaceModifiers,ReentrancyGuard,MarketplaceVars,MarketplaceEvents{
    using Counters for Counters.Counter; 

    ISqwidMarketplaceBase public base;

    constructor(address baseAddress) {
        base = ISqwidMarketplaceBase(baseAddress);
    }

    ///////////////////////////////////////////////////////////////////////
    /////////////////////////// RAFFLE ////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////

    /**
     * Creates a raffle from an existing market item.
     */
    function createItemRaffle(
        uint256 itemId,
        uint256 amount,
        uint256 numMinutes
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
        ISqwidERC1155(_idToItem[itemId].nftContract).safeTransferFrom(
            msg.sender,
            address(this),
            tokenId,
            amount,
            ""
        );

        // Map new Position
        _positionIds.increment();
        uint256 positionId = _positionIds.current();
        uint256 marketFee = marketFees[PositionState.Raffle];
        _idToPosition[positionId] = Position(
            positionId,
            itemId,
            payable(msg.sender),
            amount,
            0,
            marketFee,
            PositionState.Raffle
        );

        _idToItem[itemId].positionCount++;

        // Create RaffleData
        uint256 deadline = (block.timestamp + numMinutes * 1 minutes);
        _idToRaffleData[positionId].deadline = deadline;

        _stateToCounter[PositionState.Raffle].increment();

        emit PositionUpdate(
            positionId,
            itemId,
            msg.sender,
            amount,
            0,
            marketFee,
            PositionState.Raffle
        );
    }

    /**
     * Adds entry to an active raffle.
     * @notice Takes amounts received with an accuracy of 1 REEF, so the fractional part of the
     *         amount received will be discarded.
     */
    function enterRaffle(uint256 positionId)
        external
        payable
        positionInState(positionId, PositionState.Raffle)
    {
        require(
            _idToRaffleData[positionId].deadline >= block.timestamp,
            "SqwidMarket: Raffle has ended"
        );
        require(msg.value >= 1 * 1e18, "SqwidMarket: Value sent invalid");

        uint256 value = msg.value / 1e18;

        // Update RaffleData
        if (!(_idToRaffleData[positionId].addressToAmount[msg.sender] > 0)) {
            _idToRaffleData[positionId].indexToAddress[
                _idToRaffleData[positionId].totalAddresses
            ] = payable(msg.sender);
            _idToRaffleData[positionId].totalAddresses += 1;
        }
        _idToRaffleData[positionId].addressToAmount[msg.sender] += value;
        _idToRaffleData[positionId].totalValue += value;

        emit RaffleEntered(positionId, msg.sender, msg.value);
    }

    /**
     * Ends open raffle.
     */
    function endRaffle(uint256 positionId)
        external
        positionInState(positionId, PositionState.Raffle)
        nonReentrant
    {
        require(
            _idToRaffleData[positionId].deadline < block.timestamp,
            "SqwidMarket: Deadline not reached"
        );

        uint256 itemId = _idToPosition[positionId].itemId;
        address seller = _idToPosition[positionId].owner;
        address receiver;
        uint256 amount = _idToPosition[positionId].amount;

        // Check if there are participants in the raffle
        uint256 totalAddresses = _idToRaffleData[positionId].totalAddresses;
        if (totalAddresses > 0) {
            // Choose winner for the raffle
            uint256 totalValue = _idToRaffleData[positionId].totalValue;
            uint256 indexWinner = base.pseudoRand() % totalValue;
            uint256 lastIndex = 0;
            for (uint256 i; i < totalAddresses; i++) {
                address currAddress = _idToRaffleData[positionId].indexToAddress[i];
                lastIndex += _idToRaffleData[positionId].addressToAmount[currAddress];
                if (indexWinner < lastIndex) {
                    receiver = currAddress;
                    // Create transaction to winner
                    base.createItemTransaction(positionId, receiver, totalValue * 1e18, amount);
                    // Add sale to item
                    _idToItem[itemId].sales.push(
                        ItemSale(seller, receiver, totalValue * 1e18, amount)
                    );
                    emit MarketItemSold(
                        itemId,
                        _idToItem[itemId].nftContract,
                        _idToItem[itemId].tokenId,
                        seller,
                        receiver,
                        totalValue,
                        amount
                    );
                    break;
                }
            }
        } else {
            receiver = seller;
            // Transfer ownership back to seller
            ISqwidERC1155(_idToItem[itemId].nftContract).safeTransferFrom(
                address(this),
                receiver,
                _idToItem[itemId].tokenId,
                amount,
                ""
            );
        }

        // Delete position and raffle data
        delete _idToRaffleData[positionId];
        delete _idToPosition[positionId];
        emit PositionDelete(positionId);
        _idToItem[itemId].positionCount--;
        _stateToCounter[PositionState.Raffle].decrement();

        base.updateAvailablePosition(itemId, receiver);

        if (address(sqwidMigrator) != address(0)) {
            sqwidMigrator.positionClosed(itemId, receiver, receiver != seller);
        }
    }

}