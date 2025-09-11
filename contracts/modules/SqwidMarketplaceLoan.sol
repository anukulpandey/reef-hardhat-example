//SPDX-License-Identifier:MIT
pragma solidity ^0.8.4;

import "./SqwidMarketplaceBase.sol";

abstract contract SqwidMarketplaceLoan is SqwidMarketplaceBase{
    using Counters for Counters.Counter; 
    /////////////////////////////////////////////////////////////////////
    /////////////////////////// LOAN ////////////////////////////////////
    /////////////////////////////////////////////////////////////////////

    /**
     * Creates a loan from an existing market item.
     */
    function createItemLoan(
        uint256 itemId,
        uint256 loanAmount,
        uint256 feeAmount,
        uint256 tokenAmount,
        uint256 numMinutes
    ) public isLastVersion itemExists(itemId) {
        address nftContract = _idToItem[itemId].nftContract;
        uint256 tokenId = _idToItem[itemId].tokenId;
        require(
            tokenAmount <= ISqwidERC1155(nftContract).balanceOf(msg.sender, tokenId),
            "SqwidMarket: Address balance too low"
        );
        require(loanAmount > 0, "SqwidMarket: Loan amount cannot be 0");
        require(tokenAmount > 0, "SqwidMarket: Token amount cannot be 0");
        require(numMinutes >= 1 && numMinutes <= 525600, "SqwidMarket: Number of minutes invalid");
        // 1,440 min = 1 day - 525,600 min = 1 year

        // Transfer ownership of the token to this contract
        ISqwidERC1155(_idToItem[itemId].nftContract).safeTransferFrom(
            msg.sender,
            address(this),
            tokenId,
            tokenAmount,
            ""
        );

        // Map new Position
        Counters.increment(_positionIds);
        uint256 positionId = _positionIds.current();
        uint256 marketFee = marketFees[PositionState.Loan];
        _idToPosition[positionId] = Position(
            positionId,
            itemId,
            payable(msg.sender),
            tokenAmount,
            0,
            marketFee,
            PositionState.Loan
        );

        _idToItem[itemId].positionCount++;

        // Create LoanData
        _idToLoanData[positionId].loanAmount = loanAmount;
        _idToLoanData[positionId].feeAmount = feeAmount;
        _idToLoanData[positionId].numMinutes = numMinutes;

        _stateToCounter[PositionState.Loan].increment();

        emit PositionUpdate(
            positionId,
            itemId,
            msg.sender,
            tokenAmount,
            0,
            marketFee,
            PositionState.Loan
        );
    }

    /**
     * Lender funds a loan proposal.
     */
    function fundLoan(uint256 positionId)
        public
        payable
        positionInState(positionId, PositionState.Loan)
    {
        require(_idToLoanData[positionId].lender == address(0), "SqwidMarket: Loan already funded");
        require(
            msg.value == _idToLoanData[positionId].loanAmount,
            "SqwidMarket: Value sent invalid"
        );

        // Update LoanData
        _idToLoanData[positionId].lender = msg.sender;
        _idToLoanData[positionId].deadline =
            block.timestamp +
            _idToLoanData[positionId].numMinutes *
            1 minutes;

        // Allocate market fee into owner balance
        uint256 marketFeeAmount = (msg.value * _idToPosition[positionId].marketFee) / 10000;
        _updateBalance(owner(), marketFeeAmount);

        // Transfer funds to borrower
        (bool success, ) = _idToPosition[positionId].owner.call{
            value: msg.value - marketFeeAmount
        }("");
        require(success, "SqwidMarketplace: Error sending REEF");

        emit LoanFunded(positionId, msg.sender);
    }

    /**
     * Borrower repays loan.
     */
    function repayLoan(uint256 positionId)
        public
        payable
        positionInState(positionId, PositionState.Loan)
        nonReentrant
    {
        address lender = _idToLoanData[positionId].lender;
        require(lender != address(0), "SqwidMarket: Loan not funded");
        require(
            msg.value >= _idToLoanData[positionId].loanAmount + _idToLoanData[positionId].feeAmount,
            "SqwidMarket: Value sent invalid"
        );

        // Transfer funds to lender
        (bool success, ) = lender.call{ value: msg.value }("");
        if (!success) {
            _updateBalance(lender, msg.value);
        }

        uint256 itemId = _idToPosition[positionId].itemId;
        uint256 amount = _idToPosition[positionId].amount;
        address borrower = _idToPosition[positionId].owner;

        // Transfer tokens back to borrower
        ISqwidERC1155(_idToItem[itemId].nftContract).safeTransferFrom(
            address(this),
            borrower,
            _idToItem[itemId].tokenId,
            amount,
            ""
        );

        // Delete position and loan data
        delete _idToLoanData[positionId];
        delete _idToPosition[positionId];
        emit PositionDelete(positionId);
        _idToItem[itemId].positionCount--;
        _stateToCounter[PositionState.Loan].decrement();

        _updateAvailablePosition(itemId, borrower);

        if (address(sqwidMigrator) != address(0)) {
            sqwidMigrator.positionClosed(itemId, borrower, false);
        }
    }

    /**
     * Funder liquidates expired loan.
     */
    function liquidateLoan(uint256 positionId)
        public
        positionInState(positionId, PositionState.Loan)
    {
        require(
            msg.sender == _idToLoanData[positionId].lender,
            "SqwidMarket: Only lender can liquidate"
        );
        require(
            _idToLoanData[positionId].deadline < block.timestamp,
            "SqwidMarket: Deadline not reached"
        );

        uint256 itemId = _idToPosition[positionId].itemId;

        // Transfer tokens to lender
        ISqwidERC1155(_idToItem[itemId].nftContract).safeTransferFrom(
            address(this),
            msg.sender,
            _idToItem[itemId].tokenId,
            _idToPosition[positionId].amount,
            ""
        );

        // Delete position and loan data
        delete _idToLoanData[positionId];
        delete _idToPosition[positionId];
        emit PositionDelete(positionId);
        _idToItem[itemId].positionCount--;
        _stateToCounter[PositionState.Loan].decrement();

        _updateAvailablePosition(itemId, msg.sender);

        if (address(sqwidMigrator) != address(0)) {
            sqwidMigrator.positionClosed(itemId, msg.sender, false);
        }
    }

    /**
     * Unlist loan proposal sale.
     */
    function unlistLoanProposal(uint256 positionId)
        external
        positionInState(positionId, PositionState.Loan)
        nonReentrant
    {
        require(
            msg.sender == _idToPosition[positionId].owner,
            "SqwidMarket: Only borrower can unlist"
        );
        require(_idToLoanData[positionId].lender == address(0), "SqwidMarket: Loan already funded");

        uint256 itemId = _idToPosition[positionId].itemId;

        // Transfer tokens back to borrower
        ISqwidERC1155(_idToItem[itemId].nftContract).safeTransferFrom(
            address(this),
            msg.sender,
            _idToItem[itemId].tokenId,
            _idToPosition[positionId].amount,
            ""
        );

        // Delete position and loan data
        delete _idToLoanData[positionId];
        delete _idToPosition[positionId];
        emit PositionDelete(positionId);
        _idToItem[itemId].positionCount--;
        _stateToCounter[PositionState.Loan].decrement();

        _updateAvailablePosition(itemId, msg.sender);

        if (address(sqwidMigrator) != address(0)) {
            sqwidMigrator.positionClosed(itemId, msg.sender, false);
        }
    }
}