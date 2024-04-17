import {
  ThirdwebNftMedia,
  useAddress,
  useChainId,
  useContract,
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
  const target = "0xEA4C26D469312A9BBC24bC89F6061ebC212fF37F";
  const address = useAddress();
  const chainId = useChainId();
  const { contract } = useContract(target, ReviewTokenABI.abi);
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
    }


  });
  const gelatoAPI = "IeTEZaCSVQtOSQbBCnQV8JxGBJiOgH_X_bMGwOJw5uY_";

  const [review, setReview] = useState("");
  const [rating, setRating] = useState(0);
  const [statusMsg, setStatusMsg] = useState(""); // todo remove
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
      const contract = new ethers.Contract(target, ReviewTokenABI.abi, web3Signer);
      setGContract(contract);
    } else {
      console.error("Please install MetaMask!");
    }
  }, []);
  // const [owner, setOwner] = useState<string | null>(null);

  // useEffect(() => {
  //   const fetchOwner = async () => {
  //     try {
  //       const ownerResult = await contract?.call("owner", []);
  //       setOwner(ownerResult);
  //     } catch (error) {
  //       console.error("Error fetching owner:", error);
  //     }
  //   };
  //   fetchOwner();
  // }, [contract]);

  // console.log(contract?.call("owner", []));

  const submitReview = async () => {
    setStatusMsg("Submitting review...");
    const provider = new ethers.providers.Web3Provider(window.ethereum as any);
    const signer = provider.getSigner();
    const user = await signer.getAddress();

    const g_contract = new ethers.Contract(target, ReviewTokenABI.abi, signer);
    const { data } = await g_contract.populateTransaction.writeReview(review, rating, "https://ipfs.io/ipfs/QmSUXEirCUGZrEMKkJ5jFdbR5oac5TmRTbmayaLicFGobe/0");

    console.log(chainId);

    const request: CallWithERC2771Request = {
      chainId: chainId,
      target: target,
      data: data as BytesLike,
      user: user
    };
    const relayResponse = await relay.sponsoredCallERC2771(request, provider, gelatoAPI);
    const taskStatus = await relay.getTaskStatus(relayResponse.taskId);
    console.log(relayResponse);
    console.log(taskStatus);
    setStatusMsg("Review submitted!"); // todo give link to check the minted token
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

  const { mutateAsync: upload } = useStorageUpload();

  const uploadData = async () => {
    setStatusMsg("uploading to IPFS...");
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
    setStatusMsg("IPFS upload complete!");
    return uris;
  };


  const handleClick = () => {
    throw new Error('This is a custom exception thrown on button click');
  };

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
              <div>
                <label htmlFor="review">
                  Rating:
                  <select value={rating !== null ? rating : ''} onChange={(e) => setRating(parseInt(e.target.value))}>
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
                  <textarea id="reviewText" value={review} onChange={(e) => setReview(e.target.value)} />
                </label>
              </div>
              <div>
                <button onClick={submitReview} disabled={rating == 0}>Submit Review</button>
                <button onClick={uploadData} disabled={rating == 0}>Upload to IPFS</button>
                <button onClick={handleClick}>exception</button>

                {statusMsg && (
                  <p>{statusMsg}</p>
                )}
              </div>
            </div>

            {/* {owner === address ? (
              <div>
                <h2>Admin Settings</h2>
                <div>
                  <p> setting 1 </p>
                </div>
              </div>
            ) : (
              <h2>Contract owner is {owner}. If you are the contract owner, switch account to manage admin settings.</h2>
            )} */}

          </div>
        </div>
      </div>
    </main>
  );
};

export default Home;
