// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../interfaces/ISqwidMigrator.sol";
import "../interfaces/INftRoyalties.sol";
import "../interfaces/ISqwidERC1155.sol";
import "../types/MarketplaceTypes.sol";
import "../types/MarketplaceStructs.sol";

interface ISqwidMarketplaceBase {
    // Admin
    function setMarketFee(uint16 marketFee_, PositionState typeFee) external;
    function setNftContractAddress(ISqwidERC1155 sqwidERC1155_) external;
    function setMigratorAddress(ISqwidMigrator sqwidMigrator_) external;

    // User functions
    function withdraw() external;

    function mint(
        uint256 amount,
        string memory tokenURI,
        string calldata mimeType,
        address royaltyRecipient,
        uint256 royaltyValue
    ) external payable;

    function mintBatch(
        uint256[] memory amounts,
        string[] memory tokenURIs,
        string[] calldata mimeTypes,
        address[] memory royaltyRecipients,
        uint256[] memory royaltyValues
    ) external;

    function createItem(uint256 tokenId) external returns (uint256);
    function addAvailableTokens(uint256 itemId) external;

  function updateAvailablePosition(uint256 itemId, address tokenOwner) external;
function updateBalance(address addr, uint256 value) external;



    // Getters
    function currentItemId() external view returns (uint256);
    function currentPositionId() external view returns (uint256);
    function fetchItem(uint256 itemId) external view returns (Item memory);
    function fetchPosition(uint256 positionId) external view returns (Position memory);
    function fetchStateCount(PositionState state) external view returns (uint256);

    function fetchAuctionData(uint256 positionId) 
        external 
        view 
        returns (AuctionDataResponse memory);

    function fetchBid(uint256 positionId, uint256 bidIndex) 
        external 
        view 
        returns (address, uint256);

    function fetchRaffleData(uint256 positionId) 
        external 
        view 
        returns (RaffleDataResponse memory);

    function fetchRaffleEntry(uint256 positionId, uint256 entryIndex) 
        external 
        view 
        returns (address, uint256);

    function fetchLoanData(uint256 positionId) 
        external 
        view 
        returns (LoanData memory);

    function pseudoRand() external view returns (uint256);
    function getMarketFee(PositionState state) external view returns (uint256);

    // External wrapper for internal _createItemTransaction
    function createItemTransaction(
        uint256 positionId,
        address tokenRecipient,
        uint256 saleValue,
        uint256 amount
    ) external;
}
