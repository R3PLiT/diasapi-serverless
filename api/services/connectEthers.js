import "dotenv/config";
import fs from "fs";
import createError from "http-errors";
import { ethers } from "ethers";

let provider;
let signer;
let contract;

export const connectEthereum = async () => {
  try {
    if (!provider) {
      const rpcURL = process.env.SEPOLIA_ALCHEMY;
      provider = new ethers.providers.JsonRpcProvider(rpcURL);
      console.log("provider created");
    }

    if (!signer) {
      const privateKey = process.env.SINGER_KEY;
      signer = new ethers.Wallet(privateKey, provider);
      console.log("signer created");
    }

    if (!contract) {
      const contractABI = JSON.parse(
        fs.readFileSync(process.env.CONTRACT_FILE)
      );
      const contractAddress = process.env.CONTRACT_ADDR;
      contract = new ethers.Contract(contractAddress, contractABI, signer);
      console.log("contract created");
    }
  } catch (error) {
    console.error("Error initializing Ethereum:", error);
    throw new Error("Failed to initialize Ethereum");
  }
};

export const getProvider = async () => {
  if (!provider) {
    await connectEthereum();
  }
  return provider;
};

export const getSigner = async () => {
  if (!signer) {
    await connectEthereum();
  }
  return signer;
};

export const getContract = async () => {
  if (!contract) {
    await connectEthereum();
  }
  return contract;
};

export const readContractData = async (functionName, ...args) => {
  try {
    const contract = await getContract();
    const result = await contract.callStatic[functionName](...args);

    return result;
  } catch (error) {
    console.error("==== readContractData ====\n", error);
    throw createError(
      error.reason ? 400 : 500,
      error.reason || "Internal Server Error"
    );
  }
};

export const sendContractTransaction = async (functionName, ...args) => {
  try {
    const contract = await getContract();
    const signer = await getSigner();

    const gasLimit = await signer.estimateGas({
      to: contract.address,
      data: contract.interface.encodeFunctionData(functionName, [...args]),
    });

    const tx = await signer.sendTransaction({
      to: contract.address,
      data: contract.interface.encodeFunctionData(functionName, [...args]),
      gasLimit,
    });

    const receipt = await tx.wait();
    if (receipt.status === 0) {
      throw createError(500, "transaction Error");
    }

    return receipt.transactionHash;
  } catch (error) {
    console.error("==== sendContractTransaction ====\n", error);
    throw createError(
      error.reason ? 400 : 500,
      error.reason || "Internal Server Error"
    );
  }
};
