// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Counters.sol";
import "../types/MarketplaceStructs.sol";
import "../interfaces/ISqwidERC1155.sol";

contract MarketplaceVars {
    using Counters for Counters.Counter;

    Counters.Counter internal _positionIds;
    Counters.Counter internal _itemIds;


    mapping(PositionState => Counters.Counter) internal _stateToCounter;
    mapping(uint256 => AuctionData) internal _idToAuctionData;
    mapping(uint256 => RaffleData) internal _idToRaffleData;
    mapping(uint256 => LoanData) internal _idToLoanData;
    // contractAddress => (tokenId => isRegistered)
    mapping(address => mapping(uint256 => bool)) internal _registeredTokens;
    // itemId => (ownerAddress => availablePositionId)
    mapping(uint256 => mapping(address => uint256))
        internal _itemAvailablePositions;

    mapping(address => uint256) public addressBalance;
    mapping(PositionState => uint256) public marketFees;
    ISqwidERC1155 public sqwidERC1155;

}
