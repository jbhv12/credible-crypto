// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721Burnable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {ERC2771Context} from "@gelatonetwork/relay-context/contracts/vendor/ERC2771Context.sol";

abstract contract ReviewToken is
    ERC721,
    ERC721URIStorage,
    ERC721Burnable,
    ERC2771Context
{
    uint256 private _nextTokenId;
    uint256 private _reviewRewardAmount;
    uint256 private _referenceRewardAmount;
    uint256 private _ratingsSum;
    uint256 private _ratingsCount;

    struct Review {
        uint256 tokenId;
        uint256 rating;
        address writer;
    }
    mapping(address => bool) private _reviewEligibleUsers;
    mapping(address => bool) private _paidReviewReward;
    mapping(uint256 => Review) private _reviews;

    struct Reference {
        address referredBy;
        bool paid;
    }
    mapping(address => Reference) private _referredUsers;

    constructor(
        address trustedForwarder,
        string memory collectionName,
        string memory collectionSymbol,
        uint256 rewardAmount
    )
        ERC721(collectionName, collectionSymbol)
        ERC2771Context(trustedForwarder)
    {
        _reviewRewardAmount = rewardAmount;
    }

    receive() external payable {}

    modifier reviewEligible() {
        _reviewEligibleUsers[_msgSender()] = true;
        _paidReviewReward[_msgSender()] = false;
        _;
    }

    modifier referralEligible() {
        address user = _msgSender();
        if (
            _referredUsers[user].referredBy != address(0) &&
            !_referredUsers[user].paid
        ) {
            processPayment(
                _referredUsers[user].referredBy,
                _referenceRewardAmount
            );
            _referredUsers[user].paid = true;
        }
        _;
    }

    function writeReview(uint256 rating, string memory uri) public payable {
        require(senderOwnedToken() == -1, "You have already written a review");
        require(
            _reviewEligibleUsers[_msgSender()],
            "You aren't eligible for writing a review, you must use some functionality"
        );
        require(rating >= 1 && rating <= 10, "Rating must be between 1 and 10");

        uint256 tokenId = safeMint(_msgSender(), uri);
        _reviews[tokenId] = Review(tokenId, rating, _msgSender());

        if(!_paidReviewReward[_msgSender()]) { // only pay reward once
            processPayment(_msgSender(), _reviewRewardAmount);
            _paidReviewReward[_msgSender()] = true;
        }

        // update the average ratings
        _ratingsSum += rating;
        _ratingsCount += 1;
    }

    function processPayment(address to, uint256 amount) private {
        require(
            address(this).balance >= _reviewRewardAmount,
            "Contract balance is insufficient"
        );
        payable(to).transfer(amount);
    }

    function getTokenId(address userAddress) public view returns (int256) {
        uint256 balance = balanceOf(userAddress);
        if (balance > 0) {
            for (uint256 i = 0; i <= _nextTokenId; i++) {
                try this.ownerOf(i) {
                    if (ownerOf(i) == userAddress) {
                        return int256(i);
                    }
                } catch {
                    continue;
                }
            }
        }
        return -1;
    }

    function senderOwnedToken() public view returns (int256) {
        return getTokenId(_msgSender());
    }

    function burn(uint256 tokenId) public virtual override {
        // update the avg rating
        _ratingsSum -= _reviews[tokenId].rating;
        _ratingsCount -= 1;

        super.burn(tokenId);
    }

    function getAvgRating() public view returns (uint256) {
        require(_ratingsCount > 0, "No reviews yet");
        return (_ratingsSum * 1000) / _ratingsCount;
    }

    function safeMint(address to, string memory uri) private returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        return tokenId;
    }

    // soulbound functionality

    // function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) public override {}
    // function safeTransferFrom(address from, address to, uint256 tokenId) public override {}
    // function transferFrom(address from, address to, uint256 tokenId) public override {}

    // overrdies for gelato relay

    function _msgSender()
        internal
        view
        virtual
        override(ERC2771Context, Context)
        returns (address sender)
    {
        return ERC2771Context._msgSender();
    }

    function _msgData()
        internal
        view
        virtual
        override(ERC2771Context, Context)
        returns (bytes calldata)
    {
        return ERC2771Context._msgData();
    }

    // The following functions are overrides required by Solidity.

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}