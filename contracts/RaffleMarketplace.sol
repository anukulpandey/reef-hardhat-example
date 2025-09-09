// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./BaseMarketplace.sol";

abstract contract RaffleMarketplace is BaseMarketplace {
    struct Raffle {
        uint256 ticketPrice;
        address[] participants;
        bool active;
    }

    mapping(uint256 => Raffle) public raffles;

    event RaffleCreated(uint256 indexed id, uint256 ticketPrice);
    event RaffleEntered(uint256 indexed id, address indexed participant);
    event RaffleWinner(uint256 indexed id, address winner);

    function createRaffle(uint256 id, uint256 ticketPrice) external onlyExisting(id) {
        raffles[id].ticketPrice = ticketPrice;
        raffles[id].active = true;
        emit RaffleCreated(id, ticketPrice);
    }

    function enterRaffle(uint256 id) external payable {
        Raffle storage r = raffles[id];
        require(r.active, "Not active");
        require(msg.value == r.ticketPrice, "Wrong ticket price");

        r.participants.push(msg.sender);
        emit RaffleEntered(id, msg.sender);
    }

    function drawWinner(uint256 id) external onlyOwner {
        Raffle storage r = raffles[id];
        require(r.active, "Not active");

        uint256 winnerIndex = uint256(keccak256(abi.encodePacked(block.timestamp, id))) % r.participants.length;
        address winner = r.participants[winnerIndex];

        r.active = false;
        emit RaffleWinner(id, winner);
    }
}
