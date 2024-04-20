// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {ReviewToken} from "./Contract.sol";

contract MyApp is ReviewToken {
    constructor()
        ReviewToken(
            0xd8253782c45a12053594b9deB72d8e8aB2Fca54c,
            "ReviewCollection",
            "REVIEW",
            1,
            5000000000000000
        )
    {}

    function coreFeature() public reviewEligible referralEligible returns (string memory hw) {
        return "hello";
    }
}


// test