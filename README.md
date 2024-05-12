# Credible Crypto - Soulbound Non Fungible Testimonials (SNFTs)

Credible Crypto offers a groundbreaking solution for authentic and verifiable testimonials through blockchain technology. Below is a comparison between traditional web2 testimonials and their challenges versus how Credible Crypto SNFTs address them.


| Web2 Testimonials                              | Credible Crypto SNFTs                               |
| ---------------------------------------------- | --------------------------------------------------- |
| Difficult or impossible to verify testimonials | Testimonials can be verified on chain               |
| Many fake/paid testimonials                    | Only app users can write testimonials               |
| User has no control over their data            | User owns the NFT, and can choose to burn the token |

Credible Crypto achieves these functionalities by deploying an Ethereum ERC721 smart contract. Only users granted access to specific core features (functions marked with the modifier reviewEligible) are eligible to submit testimonials. With each testimonial, a soulbound NFT is minted. Users are unable to transfer these tokens but have the option to voluntarily burn them. All data is securely stored on the blockchain, and a function is available to calculate the average rating of the application.

## Demo App Links

- A demo app is deployed on Lisk L2 testnet and web app is hosted here: https://credible-crypto.jay.is-savvy.dev/
- Video walkthrough of demo app: https://youtu.be/EI5ae5PnJVc
- Lisk Testnet Explorer Link: https://sepolia-blockscout.lisk.com/token/0x9C384C6676f60e7a6Ad4E13655aD1894a8453287?


## Getting Started with your contract

1. Install npm package in your project 

    `npm i credible-crypto`

2. Import and extend your solidity contract

## Setting up local development environment

This repository consists of two main directories:

1. `contract`: This directory hosts the Hardhat project for the Solidity smart contract.
2. `web-app`: Within this directory, you'll find the React frontend application designed to interact with the smart contract.


### Working with smart contract
1. Notice how in `MyApp.sol:9`, a Gelato Realay address is passed as a parameter. This is used to support gasless transactions. You need to sign up for [Gelato Relay](https://www.gelato.network/relay) to get your address.
1. Run `npm run build` to compile and built the project. You will find a new file `Flatten.sol` created.
2. Next, to make our token soulbound, we need to remove all the token transfer functionality. Remove these functions manually:
- `safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data)`
- `safeTransferFrom(address from, address to, uint256 tokenId)`
- `transferFrom(address from, address to, uint256 tokenId)`
4. Deploy your contract with `npm run deploy`. 
5. Add some funds to your contract to support rewards. 

### Working with web app
1. Run `npm i` to install packages and then `npm run dev` to run the app in dev mode.
2. Alternatively, we can use this command to build and run with docker: `docker build -t cc-web-app . && docker run -p 3000:3000 cc-web-app`