// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "../interfaces/ISqwidMigrator.sol";
import "../interfaces/INftRoyalties.sol";
import "../interfaces/ISqwidERC1155.sol";
import "../types/MarketplaceTypes.sol";
import "../types/MarketplaceStructs.sol";

contract SqwidMarketplaceBase is ERC1155Holder, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;

    Counters.Counter internal _itemIds;
    Counters.Counter internal _positionIds;

    mapping(uint256 => Item) internal _idToItem;
    mapping(uint256 => Position) internal _idToPosition;
    mapping(PositionState => Counters.Counter) internal _stateToCounter;
    mapping(uint256 => AuctionData) internal _idToAuctionData;
    mapping(uint256 => RaffleData) internal _idToRaffleData;
    mapping(uint256 => LoanData) internal _idToLoanData;
    // contractAddress => (tokenId => isRegistered)
    mapping(address => mapping(uint256 => bool)) internal _registeredTokens;
    // itemId => (ownerAddress => availablePositionId)
    mapping(uint256 => mapping(address => uint256)) internal _itemAvailablePositions;

    mapping(address => uint256) public addressBalance;
    mapping(PositionState => uint256) public marketFees;
    ISqwidERC1155 public sqwidERC1155;
    ISqwidMigrator public sqwidMigrator;

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

    event BidCreated(uint256 indexed positionId, address indexed bidder, uint256 indexed value);

    event RaffleEntered(uint256 indexed positionId, address indexed addr, uint256 indexed value);

    event LoanFunded(uint256 indexed positionId, address indexed funder);

    event BalanceUpdated(address indexed addr, uint256 indexed value);

    // modifiers=====================

    modifier itemExists(uint256 itemId) {
        require(_idToItem[itemId].itemId > 0, "SqwidMarket: Item not found");
        _;
    }

    modifier positionInState(uint256 positionId, PositionState expectedState) {
        require(_idToPosition[positionId].positionId > 0, "SqwidMarket: Position not found");
        require(
            _idToPosition[positionId].state == expectedState,
            "SqwidMarket: Position on wrong state"
        );
        _;
    }

    modifier isLastVersion() {
        require(address(sqwidMigrator) == address(0), "SqwidMarket: Not last market version");
        _;
    }

    // constructor==================

    constructor(uint256 marketFee_, ISqwidERC1155 sqwidERC1155_) {
        marketFees[PositionState.RegularSale] = marketFee_;
        marketFees[PositionState.Auction] = marketFee_;
        marketFees[PositionState.Raffle] = marketFee_;
        marketFees[PositionState.Loan] = marketFee_;
        sqwidERC1155 = sqwidERC1155_;
    }

    /**
     * Sets market fee percentage with two decimal points.
     * E.g. 250 --> 2.5%
     */
    function setMarketFee(uint16 marketFee_, PositionState typeFee) external onlyOwner {
        require(marketFee_ <= 1000, "SqwidMarket: Fee higher than 1000");
        require(typeFee != PositionState.Available, "SqwidMarket: Invalid fee type");
        marketFees[typeFee] = marketFee_;
    }

    /**
     * Sets new NFT contract address.
     */
    function setNftContractAddress(ISqwidERC1155 sqwidERC1155_) external onlyOwner {
        sqwidERC1155 = sqwidERC1155_;
    }

    /**
     * Sets new Marketplace contract address.
     */
    function setMigratorAddress(ISqwidMigrator sqwidMigrator_) external onlyOwner {
        sqwidMigrator = sqwidMigrator_;
    }

    /**
     * Withdraws available balance from sender.
     */
    function withdraw() external {
        uint256 amount = addressBalance[msg.sender];
        require(amount > 0, "SqwidMarket: No Reef to be claimed");

        addressBalance[msg.sender] = 0;
        (bool success, ) = msg.sender.call{ value: amount }("");
        require(success, "SqwidMarket: Error sending REEF");

        emit BalanceUpdated(msg.sender, 0);
    }

    /**
     * Mints new SqwidERC1155 token and adds it to the marketplace.
     */
    function mint(
        uint256 amount,
        string memory tokenURI,
        string calldata mimeType,
        address royaltyRecipient,
        uint256 royaltyValue
    ) external payable {
        uint256 tokenId = sqwidERC1155.mint(
            msg.sender,
            amount,
            tokenURI,
            mimeType,
            royaltyRecipient,
            royaltyValue
        );
        createItem(tokenId);
    }

    /**
     * Mints batch of new SqwidERC1155 tokens and adds them to the marketplace.
     */
    function mintBatch(
        uint256[] memory amounts,
        string[] memory tokenURIs,
        string[] calldata mimeTypes,
        address[] memory royaltyRecipients,
        uint256[] memory royaltyValues
    ) external {
        uint256[] memory tokenIds = sqwidERC1155.mintBatch(
            msg.sender,
            amounts,
            tokenURIs,
            mimeTypes,
            royaltyRecipients,
            royaltyValues
        );

        for (uint256 i; i < tokenIds.length; i++) {
            createItem(tokenIds[i]);
        }
    }

    /**
     * Creates new market item.
     */
    function createItem(uint256 tokenId) public isLastVersion returns (uint256) {
        require(
            sqwidERC1155.balanceOf(msg.sender, tokenId) > 0,
            "SqwidMarket: Address balance too low"
        );
        require(
            !_registeredTokens[address(sqwidERC1155)][tokenId],
            "SqwidMarketplace: Item already exists"
        );

        // Map new Item
        _itemIds.increment();
        uint256 itemId = _itemIds.current();
        _idToItem[itemId].itemId = itemId;
        _idToItem[itemId].nftContract = address(sqwidERC1155);
        _idToItem[itemId].tokenId = tokenId;
        _idToItem[itemId].creator = msg.sender;

        _updateAvailablePosition(itemId, msg.sender);

        _registeredTokens[address(sqwidERC1155)][tokenId] = true;

        emit ItemCreated(itemId, address(sqwidERC1155), tokenId, msg.sender);

        return itemId;
    }

    //////////////////////////////////////////////////////////////////////////
    /////////////////////////// AVAILABLE ////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////

    /**
     * Registers in the marketplace the ownership of an existing item.
     */
    function addAvailableTokens(uint256 itemId) public isLastVersion itemExists(itemId) {
        require(
            ISqwidERC1155(_idToItem[itemId].nftContract).balanceOf(
                msg.sender,
                _idToItem[itemId].tokenId
            ) > 0,
            "SqwidMarket: Address balance too low"
        );
        require(
            _itemAvailablePositions[itemId][msg.sender] == 0,
            "SqwidMarket: Item already registered"
        );

        _updateAvailablePosition(itemId, msg.sender);
    }


    ////////////////////////////////////////////////////////////////////////
    /////////////////////////// GETTERS ////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////

    function currentItemId() external view returns (uint256) {
        return _itemIds.current();
    }

    function currentPositionId() external view returns (uint256) {
        return _positionIds.current();
    }

    function fetchItem(uint256 itemId) external view returns (Item memory) {
        return _idToItem[itemId];
    }

    function fetchPosition(uint256 positionId) external view returns (Position memory) {
        return _idToPosition[positionId];
    }

    function fetchStateCount(PositionState state) external view returns (uint256) {
        return _stateToCounter[state].current();
    }

    function fetchAuctionData(uint256 positionId)
        external
        view
        returns (AuctionDataResponse memory)
    {
        return
            AuctionDataResponse(
                _idToAuctionData[positionId].deadline,
                _idToAuctionData[positionId].minBid,
                _idToAuctionData[positionId].highestBidder,
                _idToAuctionData[positionId].highestBid,
                _idToAuctionData[positionId].totalAddresses
            );
    }

    function fetchBid(uint256 positionId, uint256 bidIndex)
        external
        view
        returns (address, uint256)
    {
        address addr = _idToAuctionData[positionId].indexToAddress[bidIndex];
        return (addr, _idToAuctionData[positionId].addressToAmount[addr]);
    }

    function fetchRaffleData(uint256 positionId) external view returns (RaffleDataResponse memory) {
        return
            RaffleDataResponse(
                _idToRaffleData[positionId].deadline,
                _idToRaffleData[positionId].totalValue,
                _idToRaffleData[positionId].totalAddresses
            );
    }

    function fetchRaffleEntry(uint256 positionId, uint256 entryIndex)
        external
        view
        returns (address, uint256)
    {
        address addr = _idToRaffleData[positionId].indexToAddress[entryIndex];
        return (addr, _idToRaffleData[positionId].addressToAmount[addr]);
    }

    function fetchLoanData(uint256 positionId) external view returns (LoanData memory) {
        return _idToLoanData[positionId];
    }

    //////////////////////////////////////////////////////////////////////
    /////////////////////////// UTILS ////////////////////////////////////
    //////////////////////////////////////////////////////////////////////

    /**
     * Pays royalties to the address designated by the NFT contract and returns the sale place
     * minus the royalties payed.
     */
    function _deduceRoyalties(
        address _nftContract,
        uint256 _tokenId,
        uint256 _grossSaleValue,
        address payable _seller
    ) internal returns (uint256 netSaleAmount) {
        // Get amount of royalties to pay and recipient
        (address royaltiesReceiver, uint256 royaltiesAmount) = INftRoyalties(_nftContract)
            .royaltyInfo(_tokenId, _grossSaleValue);

        // If seller and royalties receiver are the same, royalties will not be deduced
        if (_seller == royaltiesReceiver) {
            return _grossSaleValue;
        }

        // Deduce royalties from sale value
        uint256 netSaleValue = _grossSaleValue - royaltiesAmount;

        // Transfer royalties to rightholder if amount is not 0
        if (royaltiesAmount > 0) {
            (bool success, ) = royaltiesReceiver.call{ value: royaltiesAmount }("");
            if (!success) {
                _updateBalance(royaltiesReceiver, royaltiesAmount);
            }
        }

        return netSaleValue;
    }

    /**
     * Gets a pseudo-random number
     */
    function _pseudoRand() internal view returns (uint256) {
        uint256 seed = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp +
                        block.prevrandao +
                        ((uint256(keccak256(abi.encodePacked(block.coinbase)))) /
                            (block.timestamp)) +
                        block.gaslimit +
                        ((uint256(keccak256(abi.encodePacked(msg.sender)))) / (block.timestamp)) +
                        block.number
                )
            )
        );

        return seed;
    }

    /**
     * Creates transaction of token and selling amount
     */
    function _createItemTransaction(
        uint256 positionId,
        address tokenRecipient,
        uint256 saleValue,
        uint256 amount
    ) internal {
        uint256 itemId = _idToPosition[positionId].itemId;
        // Pay royalties
        address nftContract = _idToItem[itemId].nftContract;
        uint256 tokenId = _idToItem[itemId].tokenId;
        address payable seller = _idToPosition[positionId].owner;
        if (IERC165(nftContract).supportsInterface(type(INftRoyalties).interfaceId)) {
            saleValue = _deduceRoyalties(nftContract, tokenId, saleValue, seller);
        }

        // Allocate market fee into owner balance
        uint256 marketFeeAmount = (saleValue * _idToPosition[positionId].marketFee) / 10000;
        _updateBalance(owner(), marketFeeAmount);

        uint256 netSaleValue = saleValue - marketFeeAmount;

        // Transfer value of the transaction to the seller
        (bool success, ) = seller.call{ value: netSaleValue }("");
        if (!success) {
            _updateBalance(seller, netSaleValue);
        }

        // Transfer ownership of the token to buyer
        ISqwidERC1155(nftContract).safeTransferFrom(
            address(this),
            tokenRecipient,
            tokenId,
            amount,
            ""
        );
    }

    /**
     * Creates new position or updates amount in exising one for receiver of tokens.
     */
    function _updateAvailablePosition(uint256 itemId, address tokenOwner) internal {
        uint256 receiverPositionId;
        uint256 amount = ISqwidERC1155(_idToItem[itemId].nftContract).balanceOf(
            tokenOwner,
            _idToItem[itemId].tokenId
        );
        uint256 positionId = _itemAvailablePositions[itemId][tokenOwner];

        if (positionId != 0) {
            receiverPositionId = positionId;
            _idToPosition[receiverPositionId].amount = amount;
        } else {
            _positionIds.increment();
            receiverPositionId = _positionIds.current();
            _idToPosition[receiverPositionId] = Position(
                receiverPositionId,
                itemId,
                payable(tokenOwner),
                amount,
                0,
                0,
                PositionState.Available
            );

            _stateToCounter[PositionState.Available].increment();
            _idToItem[itemId].positionCount++;
            _itemAvailablePositions[itemId][tokenOwner] = receiverPositionId;
        }

        emit PositionUpdate(
            receiverPositionId,
            _idToPosition[receiverPositionId].itemId,
            _idToPosition[receiverPositionId].owner,
            _idToPosition[receiverPositionId].amount,
            _idToPosition[receiverPositionId].price,
            _idToPosition[receiverPositionId].marketFee,
            _idToPosition[receiverPositionId].state
        );
    }

    /**
     * Increments balance of address and emits event.
     */
    function _updateBalance(address addr, uint256 value) internal {
        addressBalance[addr] += value;
        emit BalanceUpdated(addr, addressBalance[addr]);
    }
}
