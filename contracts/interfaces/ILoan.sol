// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface ISqwidMarketplaceLoanModule {
    /**
     * Creates a loan from an existing market item
     */
    function createItemLoan(
        uint256 itemId,
        uint256 loanAmount,
        uint256 feeAmount,
        uint256 tokenAmount,
        uint256 numMinutes
    ) external;

    /**
     * Lender funds a loan proposal
     */
    function fundLoan(uint256 positionId) external payable;

    /**
     * Borrower repays loan
     */
    function repayLoan(uint256 positionId) external payable;

    /**
     * Funder liquidates expired loan
     */
    function liquidateLoan(uint256 positionId) external;

    /**
     * Borrower unlists a loan proposal before it is funded
     */
    function unlistLoanProposal(uint256 positionId) external;
}
