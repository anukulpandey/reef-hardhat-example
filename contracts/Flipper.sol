// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

contract Flipper {
    bool private value;

    event Flipped(bool indexed oldValue, bool indexed newValue);

    constructor(bool _initialValue) {
        value = _initialValue;
    }

    function flip() external {
        bool old = value;
        value = !old;
        emit Flipped(old, value);
    }

    function get() external view returns (bool) {
        return value;
    }
}
