import {
  ThirdwebNftMedia,
  useAddress,
  useChainId,
  useContract,
  useContractRead,
  useMetamask,
  useNFTs,
  ConnectWallet,
  useStorageUpload
} from "@thirdweb-dev/react";
import { GelatoRelay, CallWithERC2771Request, TransactionStatusResponse } from "@gelatonetwork/relay-sdk";
import { Bytes, BytesLike, ethers } from "ethers";
import ReviewTokenABI from "../assets/abi/ReviewToken.json";

import styles from "../styles/Home.module.css";
import Image from "next/image";
import { NextPage } from "next";

import { useState, useEffect } from "react";

const Home: NextPage = () => {
  const { mutateAsync: upload } = useStorageUpload();
  const target = "0x2d3a765fF6326Fc365D58E3CbE9b0a7687528E67";
  const address = useAddress();
  const chainId = useChainId();
  const { contract } = useContract(target);
  const { data: reviewTokenId, isLoading, error } = useContractRead(contract, "getTokenId", [address]); // TODO: test with wallet switch!!!, and only if wallte is connected!!!

  const gelatoAPI = "IeTEZaCSVQtOSQbBCnQV8JxGBJiOgH_X_bMGwOJw5uY_";
  const relay = new GelatoRelay();
  relay.onTaskStatusUpdate((taskStatus: TransactionStatusResponse) => {
    console.log("Task status update", taskStatus);
    const pendingStates = ["CheckPending", "ExecPending", "WaitingForConfirmation"];

    if (!pendingStates.includes(taskStatus.taskState)) {
      setContractCallStatus(currentState => ({ ...currentState, working: false }));

      // update task id
      if (taskStatus.taskId === contractCallStatus.functionalityCallTaskId) {
        setContractCallStatus(currentState => ({ ...currentState, functionalityCallTaskId: null }));
      }

      // set status
      if (taskStatus.taskState === "ExecSuccess") {
        setContractCallStatus(currentState => ({ ...currentState, uiText: "idle, last job completed successfully" }));
      }
      else if (taskStatus.taskState === "Cancelled") {
        let msg = "idle, last job cancelled";
        if (taskStatus.lastCheckMessage) {
          msg += " with message : " + taskStatus.lastCheckMessage; //todo fix this!!
        }
        setContractCallStatus(currentState => ({ ...currentState, uiText: msg }));
      }
    }
  });

  const [review, setReview] = useState("");
  const [rating, setRating] = useState(0);

  interface ContractCallStatus {
    working: boolean;
    uiText: string;
    functionalityCallTaskId: any;
    ipfsCallTaskId: string | null;
    submitReviewTaskId: string | null;
  }
  const [contractCallStatus, setContractCallStatus] = useState<ContractCallStatus>(
    { working: false, uiText: "idle", functionalityCallTaskId: null, ipfsCallTaskId: null, submitReviewTaskId: null }
  );

  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [user, setUser] = useState<string | null>(null);
  const [g_contract, setGContract] = useState<ethers.Contract | null>(null);
  useEffect(() => {
    if (window.ethereum) {
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const web3Signer = web3Provider.getSigner();
      setProvider(web3Provider);
      setSigner(web3Signer);
      web3Signer.getAddress().then(setUser);
      const g_contract = new ethers.Contract(target, ReviewTokenABI.abi, web3Signer);
      setGContract(g_contract);

      // todo get existing token if it exists
      // getTokenId();
    
    } else {
      console.error("Please install MetaMask!");
    }
  }, []);

  const submitReview = async () => {
    if(g_contract) {
      setContractCallStatus(currentState => ({ ...currentState, working: true, uiText: "Sumbitting your review and minting soulbound token" }));
      const { data } = await g_contract.populateTransaction.writeReview(rating, "https://ipfs.io/ipfs/QmSUXEirCUGZrEMKkJ5jFdbR5oac5TmRTbmayaLicFGobe/0");

      const request: CallWithERC2771Request = {
        chainId: chainId,
        target: target,
        data: data as BytesLike,
        user: user
      };
      const relayResponse = await relay.sponsoredCallERC2771(request, provider, gelatoAPI);
      // todo set status
    }
  };

  const burnToken = async () => {
    if(g_contract) {
      setContractCallStatus(currentState => ({ ...currentState, working: true, uiText: "burning token" }));
      const { data } = await g_contract.populateTransaction.burn(reviewTokenId);

      const request: CallWithERC2771Request = {
        chainId: chainId,
        target: target,
        data: data as BytesLike,
        user: user
      };
      const relayResponse = await relay.sponsoredCallERC2771(request, provider, gelatoAPI);
      setContractCallStatus(currentState => ({ ...currentState, submitReviewTaskId: relayResponse.taskId })); // todo
    }
  };

  const useFunctionality = async () => {
    setContractCallStatus(currentState => ({ ...currentState, working: true, uiText: "Calling a feature!" }));
    if (g_contract) {
      const { data } = await g_contract.populateTransaction.coreFeature();
      const request: CallWithERC2771Request = {
        chainId: chainId,
        target: target,
        data: data as BytesLike,
        user: user
      };
      const relayResponse = await relay.sponsoredCallERC2771(request, provider, gelatoAPI);
      setContractCallStatus(currentState => ({ ...currentState, functionalityCallTaskId: relayResponse.taskId }));
    }
  };

  const uploadData = async () => {
    const dataToUpload = [JSON.stringify(
      {
        "description": "Review Token for MyApp",
        "image": "https://storage.googleapis.com/opensea-prod.appspot.com/puffs/3.png", // todo: put images here
        "name": "MyApp Raring #" + { rating },
        "attributes": [
          {
            "display_type": "number",
            "trait_type": "Rating",
            "value": { rating }
          },
          {
            "trait_type": "Review",
            "value": { review }
          },
          {
            "display_type": "number",
            "trait_type": "Generation",
            "value": 2
          },
          {
            "display_type": "boost_number",
            "trait_type": "Aqua Power",
            "value": 40
          },
          {
            "display_type": "boost_percentage",
            "trait_type": "Stamina Increase",
            "value": 10
          },
        ]
      }
    )];
    const uris = await upload({ data: dataToUpload });
    console.log(uris);
    const updatedString = uris[0].replace("://", "/");
    console.log("https://ipfs.io/" + updatedString);
    return "https://ipfs.io/" + updatedString;
  };
  const getTokenId = async () => {
    
    console.log(reviewTokenId);
    console.log(reviewTokenId._hex);
  };
  // const getTokenId = async () => useContractRead(contract, "getTokenId", [address]).data;

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            Welcome to{" "}
            <span className={styles.gradientText0}>
              My Actually Awesome App
            </span>
          </h1>

          <div>
            <h2>Reviews</h2>
          </div>

          <div className={styles.connect}>
            <ConnectWallet />
          </div>

          <div>
            <h2>Features!</h2>
            <button id="relayRequest" onClick={useFunctionality} disabled={contractCallStatus.working}>
              Use Some Feature
            </button>


            <div className="review-box">
              <h2>Write a Review</h2>
              {reviewTokenId == -1 ? (
                <div>
                  <p>Write a review and get rewared with 0.05 eth!</p>
                  <div>
                    <label htmlFor="review">
                      Rating:
                      <select value={rating !== null ? rating : ''} onChange={(e) => setRating(parseInt(e.target.value))} disabled={contractCallStatus.working}>
                        <option value="" disabled>Select Rating</option>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={4}>4</option>
                        <option value={5}>5</option>
                        <option value={6}>6</option>
                        <option value={7}>7</option>
                        <option value={8}>8</option>
                        <option value={9}>9</option>
                        <option value={10}>10</option>
                      </select>
                    </label>
                    <label htmlFor="reviewText">
                      Review:
                      <textarea id="reviewText" value={review} onChange={(e) => setReview(e.target.value)} disabled={contractCallStatus.working}/>
                    </label>
                  </div>
                  <div>
                    <button onClick={submitReview} disabled={contractCallStatus.working}>Submit Review</button>
                    <button onClick={uploadData} disabled={contractCallStatus.working}>Upload to IPFS</button>
                    <button onClick={getTokenId} disabled={contractCallStatus.working}>Check token</button> 
                  </div>
                </div>
              ) : (
                <div>
                  <p>review alreayd written with token id xxxx</p>
                  <button onClick={burnToken}>Burn</button>
                </div>
              )}
            </div>

            <div>
              <h2>App Status: </h2>
              <p>{contractCallStatus.uiText}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Home;
