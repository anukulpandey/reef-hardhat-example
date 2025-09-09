// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

abstract contract BaseMarketplace is Ownable, ReentrancyGuard {
    IERC1155 public sqwidERC1155;
    uint256 public marketFee;

    struct Item {
        uint256 id;
        uint256 supply;
        address creator;
    }

    mapping(uint256 => Item) internal items;

    event ItemCreated(uint256 indexed id, address indexed creator, uint256 supply);

    constructor(uint256 _marketFee, address _erc1155) {
        marketFee = _marketFee;
        sqwidERC1155 = IERC1155(_erc1155);
    }

    modifier onlyExisting(uint256 id) {
        require(items[id].creator != address(0), "Item does not exist");
        _;
    }

    function _createItem(uint256 id, uint256 supply) internal {
        items[id] = Item(id, supply, msg.sender);
        emit ItemCreated(id, msg.sender, supply);
    }
}
