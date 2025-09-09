// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./BaseMarketplace.sol";

abstract contract SaleMarketplace is BaseMarketplace {
    struct Sale {
        uint256 price;
        uint256 amount;
        address seller;
    }

    mapping(uint256 => Sale) public sales;

    event SaleCreated(uint256 indexed id, address indexed seller, uint256 price, uint256 amount);
    event SaleExecuted(uint256 indexed id, address indexed buyer);

    function createSale(uint256 id, uint256 price, uint256 amount) external onlyExisting(id) {
        require(amount > 0, "Invalid amount");
        sales[id] = Sale(price, amount, msg.sender);
        emit SaleCreated(id, msg.sender, price, amount);
    }

    function buy(uint256 id) external payable nonReentrant {
        Sale storage s = sales[id];
        require(msg.value == s.price * s.amount, "Incorrect value");

        address seller = s.seller;
        delete sales[id];

        sqwidERC1155.safeTransferFrom(seller, msg.sender, id, s.amount, "");
        emit SaleExecuted(id, msg.sender);
    }
}
