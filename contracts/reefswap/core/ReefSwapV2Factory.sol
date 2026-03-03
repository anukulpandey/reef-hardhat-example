// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './interfaces/IReefSwapV2Factory.sol';
import './interfaces/IReefSwapV2Pair.sol';
import './ReefSwapV2Pair.sol';

contract ReefSwapV2Factory is IReefSwapV2Factory {
    address public override feeTo;
    address public override feeToSetter;

    mapping(address => mapping(address => address)) public override getPair;
    address[] public override allPairs;

    constructor(address _feeToSetter) {
        feeToSetter = _feeToSetter;
    }

    function allPairsLength() external view override returns (uint) {
        return allPairs.length;
    }

    function createPair(address tokenA, address tokenB) external override returns (address pair) {
        require(tokenA != tokenB, 'ReefSwapV2: IDENTICAL_ADDRESSES');
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'ReefSwapV2: ZERO_ADDRESS');
        require(getPair[token0][token1] == address(0), 'ReefSwapV2: PAIR_EXISTS');

        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        pair = address(new ReefSwapV2Pair{salt: salt}());
        IReefSwapV2Pair(pair).initialize(token0, token1);

        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    function setFeeTo(address _feeTo) external override {
        require(msg.sender == feeToSetter, 'ReefSwapV2: FORBIDDEN');
        feeTo = _feeTo;
    }

    function setFeeToSetter(address _feeToSetter) external override {
        require(msg.sender == feeToSetter, 'ReefSwapV2: FORBIDDEN');
        feeToSetter = _feeToSetter;
    }
}
