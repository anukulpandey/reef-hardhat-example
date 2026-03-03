// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IReefswapV2Migrator {
    function migrate(address token, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external;
}
