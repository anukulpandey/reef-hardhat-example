// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./interfaces/ISale.sol";
import "./interfaces/IRaffle.sol";
import "./interfaces/IAuction.sol";
import "./interfaces/ILoan.sol";
import "./interfaces/ISqwidMarketplaceBase.sol";

contract SqwidMarketplace {
    ISqwidMarketplaceSaleModule public saleModule;
    ISqwidMarketplaceRaffleModule public raffleModule;
    ISqwidMarketplaceAuctionModule public auctionModule;
    ISqwidMarketplaceLoanModule public loanModule;
    ISqwidMarketplaceBase public base;

    constructor(
        address _saleModule,
        address _raffleModule,
        address _auctionModule,
        address _loanModule,
        address _base
    ) {
        saleModule = ISqwidMarketplaceSaleModule(_saleModule);
        raffleModule = ISqwidMarketplaceRaffleModule(_raffleModule);
        auctionModule = ISqwidMarketplaceAuctionModule(_auctionModule);
        loanModule = ISqwidMarketplaceLoanModule(_loanModule);
        base = ISqwidMarketplaceBase(_base);
    }

    ////////////////////// BASE //////////////////////
    function mint(
        uint256 amount,
        string memory tokenURI,
        string calldata mimeType,
        address royaltyRecipient,
        uint256 royaltyValue
    ) external payable {
        base.mint(amount, tokenURI, mimeType, royaltyRecipient, royaltyValue);
    }

    function mintBatch(
        uint256[] memory amounts,
        string[] memory tokenURIs,
        string[] calldata mimeTypes,
        address[] memory royaltyRecipients,
        uint256[] memory royaltyValues
    ) external {
        base.mintBatch(
            amounts,
            tokenURIs,
            mimeTypes,
            royaltyRecipients,
            royaltyValues
        );
    }

    function createItem(uint256 tokenId) external returns (uint256) {
        return base.createItem(tokenId);
    }

    function addAvailableTokens(uint256 itemId) external {
        base.addAvailableTokens(itemId);
    }

    function withdraw() external {
        base.withdraw();
    }

    function currentItemId() external view returns (uint256) {
        return base.currentItemId();
    }

    function currentPositionId() external view returns (uint256) {
        return base.currentPositionId();
    }

    function fetchItem(uint256 itemId) external view returns (Item memory) {
        return base.fetchItem(itemId);
    }

    function fetchPosition(
        uint256 positionId
    ) external view returns (Position memory) {
        return base.fetchPosition(positionId);
    }

    function fetchStateCount(
        PositionState state
    ) external view returns (uint256) {
        return base.fetchStateCount(state);
    }

    function fetchAuctionData(
        uint256 positionId
    ) external view returns (AuctionDataResponse memory) {
        return base.fetchAuctionData(positionId);
    }

    function fetchBid(
        uint256 positionId,
        uint256 bidIndex
    ) external view returns (address, uint256) {
        return base.fetchBid(positionId, bidIndex);
    }

    function fetchRaffleData(
        uint256 positionId
    ) external view returns (RaffleDataResponse memory) {
        return base.fetchRaffleData(positionId);
    }

    function fetchRaffleEntry(
        uint256 positionId,
        uint256 entryIndex
    ) external view returns (address, uint256) {
        return base.fetchRaffleEntry(positionId, entryIndex);
    }

    function fetchLoanData(
        uint256 positionId
    ) external view returns (LoanData memory) {
        return base.fetchLoanData(positionId);
    }

    function getMarketFee(PositionState state) external view returns (uint256) {
        return base.getMarketFee(state);
    }

    function createItemTransaction(
        uint256 positionId,
        address tokenRecipient,
        uint256 saleValue,
        uint256 amount
    ) external {
        base.createItemTransaction(
            positionId,
            tokenRecipient,
            saleValue,
            amount
        );
    }

    ////////////////////// SALE //////////////////////
    function putItemOnSale(
        uint256 itemId,
        uint256 amount,
        uint256 price
    ) external {
        saleModule.putItemOnSale(itemId, amount, price);
    }

    function createSale(uint256 positionId, uint256 amount) external payable {
        saleModule.createSale{value: msg.value}(positionId, amount);
    }

    function unlistPositionOnSale(uint256 positionId) external {
        saleModule.unlistPositionOnSale(positionId);
    }

    ////////////////////// RAFFLE //////////////////////
    function createItemRaffle(
        uint256 itemId,
        uint256 amount,
        uint256 numMinutes
    ) external {
        raffleModule.createItemRaffle(itemId, amount, numMinutes);
    }

    function enterRaffle(uint256 positionId) external payable {
        raffleModule.enterRaffle{value: msg.value}(positionId);
    }

    function endRaffle(uint256 positionId) external {
        raffleModule.endRaffle(positionId);
    }

    ////////////////////// AUCTION //////////////////////
    function createItemAuction(
        uint256 itemId,
        uint256 amount,
        uint256 numMinutes,
        uint256 minBid,
        address nftContract,
        uint256 tokenId,
        address sender
    ) external {
        auctionModule.createItemAuction(
            itemId,
            amount,
            numMinutes,
            minBid,
            nftContract,
            tokenId,
            sender
        );
    }

    function createBid(uint256 positionId) external payable {
        auctionModule.createBid{value: msg.value}(positionId);
    }

    function endAuction(
        uint256 positionId,
        uint256 itemId,
        address seller,
        address nftContract,
        uint256 tokenId,
        uint256 amount
    ) external {
        auctionModule.endAuction(
            positionId,
            itemId,
            seller,
            nftContract,
            tokenId,
            amount
        );
    }

    ////////////////////// LOAN //////////////////////
    function createItemLoan(
        uint256 itemId,
        uint256 loanAmount,
        uint256 feeAmount,
        uint256 tokenAmount,
        uint256 numMinutes
    ) external {
        loanModule.createItemLoan(
            itemId,
            loanAmount,
            feeAmount,
            tokenAmount,
            numMinutes
        );
    }

    function fundLoan(uint256 positionId) external payable {
        loanModule.fundLoan{value: msg.value}(positionId);
    }

    function repayLoan(uint256 positionId) external payable {
        loanModule.repayLoan{value: msg.value}(positionId);
    }

    function liquidateLoan(uint256 positionId) external {
        loanModule.liquidateLoan(positionId);
    }

    function unlistLoanProposal(uint256 positionId) external {
        loanModule.unlistLoanProposal(positionId);
    }
}
