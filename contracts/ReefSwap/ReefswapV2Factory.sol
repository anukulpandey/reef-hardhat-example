// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import './interfaces/IReefswapV2Factory.sol';
import './ReefswapV2Pair.sol';

contract ReefswapV2Factory is IReefswapV2Factory {
    address public feeTo;
    address public feeToSetter;

    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    constructor(address _feeToSetter) {
        feeToSetter = _feeToSetter;
    }

    function allPairsLength() external view returns (uint) {
        return allPairs.length;
    }

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, 'ReefswapV2: IDENTICAL_ADDRESSES');
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'ReefswapV2: ZERO_ADDRESS');
        require(getPair[token0][token1] == address(0), 'ReefswapV2: PAIR_EXISTS'); // single check is sufficient
        ReefswapV2Pair pairContract = new ReefswapV2Pair();
        pair = address(pairContract);
        IReefswapV2Pair(pair).initialize(token0, token1);
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair; // populate mapping in the reverse direction
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }
    function setFeeTo(address _feeTo) external {
        require(msg.sender == feeToSetter, 'ReefswapV2: FORBIDDEN');
        feeTo = _feeTo;
    }

    function setFeeToSetter(address _feeToSetter) external {
        require(msg.sender == feeToSetter, 'ReefswapV2: FORBIDDEN');
        feeToSetter = _feeToSetter;
    }
}
