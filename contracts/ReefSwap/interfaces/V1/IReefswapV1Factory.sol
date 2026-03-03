// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IReefswapV1Factory {
    function getExchange(address) external view returns (address);
}
