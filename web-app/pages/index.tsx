import {
  useAddress,
  useChainId,
  useContract,
  useContractRead,
  useContractWrite,
  ConnectWallet,
  useStorageUpload
} from "@thirdweb-dev/react";
import { GelatoRelay, CallWithERC2771Request, TransactionStatusResponse } from "@gelatonetwork/relay-sdk";
import { Bytes, BytesLike, ethers } from "ethers";
import ReviewTokenABI from "../assets/abi/ReviewToken.json";

import styles from "../styles/Home.module.css";
import { NextPage } from "next";

import { useState, useEffect } from "react";

const Home: NextPage = () => {
  const { mutateAsync: upload } = useStorageUpload();
  const target = "0x1B329aaB594AC443A85694D0FBA441022e3d352f";
  const contractTokenId = "0xEA4C26D469312A9BBC24bC89F6061ebC212fF37F";
  const address = useAddress();
  const chainId = useChainId();
  const { contract } = useContract(target);
  const { data: reviewTokenId } = useContractRead(contract, "getTokenId", [address]); // TODO: test with wallet switch!!!, and only if wallte is connected!!!
  const { data: avgRatings } = useContractRead(contract, "getAvgRating", []); // TODO: test with wallet switch!!!, and only if wallte is connected!!!
  const { mutateAsync: referUserMutateAsync, isLoading, error } = useContractWrite(contract, "referUser");

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
      else if (taskStatus.taskId === contractCallStatus.submitReviewTaskId) {
        setContractCallStatus(currentState => ({ ...currentState, submitReviewTaskId: null }));
      } 
      else if (taskStatus.taskId === contractCallStatus.burnTaskId) {
        setContractCallStatus(currentState => ({ ...currentState, burnTaskId: null }));
        window.location.reload();
      }
      else if (taskStatus.taskId === contractCallStatus.referUserTaskId) {
        setContractCallStatus(currentState => ({ ...currentState, referUserTaskId: null }));
  
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
  const [numberOfUsers, setNumberOfUsers] = useState(-1);
  const [refferedUserAddress, setRefferedUserAddress] = useState("");

  interface ContractCallStatus {
    working: boolean;
    uiText: string;
    functionalityCallTaskId: any;
    ipfsCallTaskId: string | null;
    submitReviewTaskId: string | null;
    burnTaskId: string | null;
    referUserTaskId: string | null;
  }
  const [contractCallStatus, setContractCallStatus] = useState<ContractCallStatus>(
    { working: false, uiText: "idle", functionalityCallTaskId: null, ipfsCallTaskId: null, submitReviewTaskId: null, burnTaskId: null, referUserTaskId: null }
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
    } else {
      console.error("Please install MetaMask!");
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('https://sepolia-blockscout.lisk.com/api/v2/tokens/' + contractTokenId); // todo
        const { holders } = await response.json();
        setNumberOfUsers(holders);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    const intervalId = setInterval(fetchData, 5000); // Poll every 5 seconds

    return () => clearInterval(intervalId);

  }, []);

  const uploadData = async () => {
    const dataToUpload = [JSON.stringify(
      {
        "description": "Review Token for MyApp",
        "image": "https://raw.githubusercontent.com/jbhv12/web3-testimonials/main/web-app/assets/nft-images/" + rating + ".png",
        "name": "MyApp Raring #" + rating,
        "attributes": [
          {
            "display_type": "number",
            "trait_type": "Rating",
            "value": rating
          },
          {
            "trait_type": "Review",
            "value": review
          }
        ]
      }
    )];
    const uris = await upload({ data: dataToUpload });
    return "https://ipfs.io/" + uris[0].replace("://", "/");
  };

  const submitReview = async () => {
    if (g_contract) {
      setContractCallStatus(currentState => ({ ...currentState, working: true, uiText: "Uploading to IPFS..." }));
      const ipfs_url = await uploadData();
      console.log(ipfs_url);
      const { data } = await g_contract.populateTransaction.writeReview(rating, ipfs_url);

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
      setContractCallStatus(currentState => ({ ...currentState, submitReviewTaskId: relayResponse.taskId, uiText: "Minting soulbound token..." }));
    }
  };

  const burnToken = async () => {
    if (g_contract) {
      setContractCallStatus(currentState => ({ ...currentState, working: true, uiText: "burning token..." }));
      const { data } = await g_contract.populateTransaction.burn(reviewTokenId);

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
      setContractCallStatus(currentState => ({ ...currentState, burnTaskId: relayResponse.taskId }));
    }
  };

  const useFunctionality = async () => {
    setContractCallStatus(currentState => ({ ...currentState, working: true, uiText: "Calling a feature..." }));
    if (g_contract) {
      const { data } = await g_contract.populateTransaction.coreFeature();
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
      setContractCallStatus(currentState => ({ ...currentState, functionalityCallTaskId: relayResponse.taskId }));
    }
  };

  const referUser = async () => {
    if (g_contract) {
      setContractCallStatus(currentState => ({ ...currentState, working: true, uiText: "Trying to refer your friend..." }));
      const { data } = await g_contract.populateTransaction.referUser(refferedUserAddress);

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
      setContractCallStatus(currentState => ({ ...currentState, referUserTaskId: relayResponse.taskId, uiText: "Trying to refer your friend using gelato relay..." }));
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title} style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            Welcome to{" "}
            <span className={styles.gradientText0}>
              My Actually Awesome App
            </span>
          </h1>

          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2>Reviews</h2>
            <p>{numberOfUsers} people say so with an avg rating of {avgRatings ? avgRatings.toNumber() / 1000 : "no reviews yet"}</p>
          </div>

          <div className={styles.connect} style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <ConnectWallet />
          </div>

          <div>
            <div id="main" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: '20px', marginLeft: '20px', marginRight: '20px' }}>
              {address && (
                <div id="feat" style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <h2>Features</h2>
                  <button id="relayRequest" onClick={useFunctionality} disabled={contractCallStatus.working}>
                    Use Some Feature
                  </button>
                </div>
              )}

              {address && (
                <div id="review" className="review-box" style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <h2>Write a Review</h2>
                  {!reviewTokenId || reviewTokenId == -1 ? (
                    <div>
                      <p>Write a review and get rewared with 0.05 eth!</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <label htmlFor="review" style={{ width: '100px' }}>
                            Rating:
                          </label>
                          <select
                            value={rating !== null ? rating : ''}
                            onChange={(e) => setRating(parseInt(e.target.value))}
                            disabled={contractCallStatus.working}
                            style={{ flexGrow: 1, maxWidth: '200px' }} // Adjusted width here
                          >
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
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                          <label htmlFor="reviewText" style={{ width: '100px' }}>
                            Review:
                          </label>
                          <textarea
                            id="reviewText"
                            value={review}
                            onChange={(e) => setReview(e.target.value)}
                            disabled={contractCallStatus.working}
                            style={{ flexGrow: 1, resize: 'vertical', maxWidth: '200px' }} // Adjusted width here
                          />
                        </div>
                      </div>

                      <div>
                        <button onClick={submitReview} disabled={contractCallStatus.working}>Submit Review</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <p>
                        You have already written a review with {" "}
                        <a
                          href={`https://sepolia-blockscout.lisk.com/token/${target}/instance/${reviewTokenId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          token id {reviewTokenId ? reviewTokenId.toNumber() : -1}
                        </a>
                      </p>

                      <button onClick={burnToken} disabled={contractCallStatus.working} >Burn</button>
                    </div>
                  )}
                </div>
              )}

              {address && (
                <div id="refer" style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <h2>Refer a friend</h2>
                  <p>When your friend uses the core functionaliyt of the app, you get rewared with 0.05 eth</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                      <label htmlFor="cryptoAddress" style={{ width: '100px' }}>
                        Address:
                      </label>
                      <input
                        type="text"
                        id="cryptoAddress"
                        value={refferedUserAddress}
                        onChange={(e) => setRefferedUserAddress(e.target.value)}
                        disabled={contractCallStatus.working}
                        pattern="[0-9a-zA-Z]{42}"
                        style={{ flexGrow: 1, maxWidth: '200px' }}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <button onClick={referUser} disabled={contractCallStatus.working}>Refer</button>
                  </div>
                </div>
              )}
            </div>
            <div id="status" style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '30px'}}>
              <h2>App Status: </h2>
              <p>{address ? contractCallStatus.uiText : "Connect walltet to get started."}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Home;
