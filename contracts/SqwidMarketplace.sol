// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./modules/SqwidMarketplaceBase.sol";
import "./modules/SqwidMarketplaceAuction.sol";
import "./modules/SqwidMarketplaceRaffle.sol";
import "./modules/SqwidMarketplaceLoan.sol";
import "./modules/SqwidMarketplaceSale.sol";

contract SqwidMarketplace is 
    SqwidMarketplaceBase,
    SqwidMarketplaceAuction,
    SqwidMarketplaceRaffle,
    SqwidMarketplaceLoan,
    SqwidMarketplaceSale 
{
    constructor(uint256 marketFee_, ISqwidERC1155 sqwidERC1155_)
        SqwidMarketplaceBase(marketFee_, sqwidERC1155_)
    {}
}
