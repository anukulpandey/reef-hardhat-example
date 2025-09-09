// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./SaleMarketplace.sol";
import "./AuctionMarketplace.sol";
import "./RaffleMarketplace.sol";
import "./LoanMarketplace.sol";

contract SqwidMarketplace is 
    SaleMarketplace, 
    AuctionMarketplace, 
    RaffleMarketplace, 
    LoanMarketplace 
{
    constructor(uint256 _marketFee, address _erc1155) 
        BaseMarketplace(_marketFee, _erc1155) 
    {}
}
