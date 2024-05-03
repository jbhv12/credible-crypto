import {
  ThirdwebNftMedia,
  useAddress,
  useChainId,
  useContract,
  useMetamask,
  useNFTs,
  ConnectWallet,
} from "@thirdweb-dev/react";
import { GelatoRelay, CallWithERC2771Request } from "@gelatonetwork/relay-sdk";
import { Bytes, BytesLike, ethers } from "ethers";
import ReviewTokenABI from "../assets/abi/ReviewToken.json";

import styles from "../styles/Home.module.css";
import Image from "next/image";
import { NextPage } from "next";

import { useState, useEffect } from "react";

const Home: NextPage = () => {
  const target = "0xb241B676818bd9EF4AFdb3Bc246c429aA3DF4dd1";
  const address = useAddress();
  const chainId = useChainId();
  const { contract } = useContract(target, ReviewTokenABI.abi);
  const relay = new GelatoRelay();
  const gelatoAPI = "IeTEZaCSVQtOSQbBCnQV8JxGBJiOgH_X_bMGwOJw5uY_";

  // const { data: nfts, isLoading: loading } = useNFTs(contract, {
  //   start: 0,
  //   count: 10,
  // });
  // test2


  const [owner, setOwner] = useState<string | null>(null);

  useEffect(() => {
    const fetchOwner = async () => {
      try {
        const ownerResult = await contract?.call("owner", []);
        setOwner(ownerResult);
      } catch (error) {
        console.error("Error fetching owner:", error);
      }
    };

    fetchOwner();
  }, [contract]);

  // console.log(contract?.call("owner", []));

  const truncateAddress = (address: string) => {
    return (
      address.substring(0, 6) + "..." + address.substring(address.length - 4)
    );
  };

  const sendRelayRequest = async () => {
    const provider = new ethers.providers.Web3Provider(window.ethereum as any);
    const signer = provider.getSigner();
    const user =  await signer.getAddress();

    const g_contract = new ethers.Contract(target, ReviewTokenABI.abi, signer);
    const {data} =  await g_contract.populateTransaction.owner();

    console.log(chainId);

    const request: CallWithERC2771Request = {
      // @ts-ignore
      chainId: chainId,
      target: target,
      // @ts-ignore
      data: data as BytesLike,
      user: user
    };
    // @ts-ignore
    const relayResponse = await relay.sponsoredCallERC2771(request, provider, gelatoAPI);
    console.log(relayResponse);
    
  };
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            Welcome to{" "}
            <span className={styles.gradientText0}>
                My Awesome App
            </span>
          </h1>
          <h2>100 people gave it avg rating of 9.8/10!</h2>
        </div>
      </div>
    </main>
  );
};

export default Home;
