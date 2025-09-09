// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./BaseMarketplace.sol";

abstract contract LoanMarketplace is BaseMarketplace {
    struct Loan {
        uint256 amount;
        uint256 repayBy;
        address lender;
        address borrower;
        bool active;
    }

    mapping(uint256 => Loan) public loans;

    event LoanCreated(uint256 indexed id, address lender, address borrower, uint256 amount);
    event LoanRepaid(uint256 indexed id);

    function createLoan(uint256 id, address borrower, uint256 amount, uint256 duration) external onlyExisting(id) {
        loans[id] = Loan(amount, block.timestamp + duration, msg.sender, borrower, true);
        emit LoanCreated(id, msg.sender, borrower, amount);
    }

    function repayLoan(uint256 id) external payable {
        Loan storage l = loans[id];
        require(l.active, "No active loan");
        require(msg.value == l.amount, "Wrong amount");

        l.active = false;
        payable(l.lender).transfer(msg.value);
        emit LoanRepaid(id);
    }
}
