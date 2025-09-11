// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./interfaces/ISale.sol";
import "./interfaces/IRaffle.sol";
import "./interfaces/IAuction.sol";
import "./interfaces/ILoan.sol";

contract SqwidMarketplace {
    ISqwidMarketplaceSaleModule public saleModule;
    ISqwidMarketplaceRaffleModule public raffleModule;
    ISqwidMarketplaceAuctionModule public auctionModule;
    ISqwidMarketplaceLoanModule public loanModule;

    constructor(
        address _saleModule,
        address _raffleModule,
        address _auctionModule,
        address _loanModule
    ) {
        saleModule = ISqwidMarketplaceSaleModule(_saleModule);
        raffleModule = ISqwidMarketplaceRaffleModule(_raffleModule);
        auctionModule = ISqwidMarketplaceAuctionModule(_auctionModule);
        loanModule = ISqwidMarketplaceLoanModule(_loanModule);
    }

    ////////////////////// SALE //////////////////////
    function putItemOnSale(uint256 itemId, uint256 amount, uint256 price) external {
        saleModule.putItemOnSale(itemId, amount, price);
    }

    function createSale(uint256 positionId, uint256 amount) external payable {
        saleModule.createSale{value: msg.value}(positionId, amount);
    }

    function unlistPositionOnSale(uint256 positionId) external {
        saleModule.unlistPositionOnSale(positionId);
    }

    ////////////////////// RAFFLE //////////////////////
    function createItemRaffle(uint256 itemId, uint256 amount, uint256 numMinutes) external {
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
        auctionModule.createItemAuction(itemId, amount, numMinutes, minBid, nftContract, tokenId, sender);
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
        auctionModule.endAuction(positionId, itemId, seller, nftContract, tokenId, amount);
    }

    ////////////////////// LOAN //////////////////////
    function createItemLoan(
        uint256 itemId,
        uint256 loanAmount,
        uint256 feeAmount,
        uint256 tokenAmount,
        uint256 numMinutes
    ) external {
        loanModule.createItemLoan(itemId, loanAmount, feeAmount, tokenAmount, numMinutes);
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
