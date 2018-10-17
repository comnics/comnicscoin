const cryptoJS = require("crypto-js");

class Block {
    constructor(index, hash, previousHash, timestamp, data){
        this.index = index;
        this.hash = hash;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
    }
}

const genesisBlock = new Block(
    0,
    "FB5B7B6C73D35DABECFB84B26239D1DB97ACDD78D16FE2056DE31A1FB8037AFC",
    null,
    1539752978063,
    "This is the genesis!"
);

let blockchain = [genesisBlock];

const getBlockchain = () => blockchain;
const getLastBlock = () => blockchain[blockchain.length - 1];
const getTimestamp = () => new Date().getTime() / 1000;
const createHash = (index, previousHash, timestamp, data) => cryptoJS.SHA256(index + previousHash + timestamp + JSON.stringify(data)).toString();
const getBlockhash = (block) => createHash(block.index, block.previousHash, block.timestamp, block.data);

const createNewBlock = data => {
    const previousBlock = getLastBlock();
    const newBlockIndex = previousBlock.index + 1;
    const newTimestamp = getTimestamp();
    const newHash = createHash(newBlockIndex, previousBlock.hash, newTimestamp, data);
    const newBlock = new Block(
        newBlockIndex,
        newHash,
        previousBlock.hash,
        newTimestamp,
        data
    );

    return newBlock;
}

const isNewBlockValid = (candidateBlock, latestBlock) =>{
    if(!isNewStructureValid(candidateBlock)){
        console.log("The candidate block sturucture is not valid.");
        return false;
    }else if(latestBlock.index + 1 !== candidateBlock.index){
        console.log("The candidateBlock doesnt have a valid index.");
        return false;
    }else if(latestBlock.hash !== candidateBlock.previousHash){
        console.log("The previousHash of candidate block is not the hash of latest block.");
        return false;
    }else if(candidateBlock.hash !== getBlockhash(candidateBlock)){
        console.log("The hash of this block is invalid.");
        return false;
    }
    return true;
}

const isNewStructureValid = block =>{
    return (
        typeof block.index === 'number' &&
        typeof block.hash === 'string' &&
        typeof block.previousHash === 'string' &&
        typeof block.timestamp === 'number' &&
        typeof block.data === 'string'
    );
};

const isChainValid = candidateChain => {
    const isGenesisValid = block => {
        return JSON.stringify(block) === JSON.stringify(genesisBlock);
    };

    if(!isGenesisValid(candidateChain[0])){
        console.log("The candidateChain's genesisBlock is not the same as our genesisBlock.");
        return false;
    }

    for(let i = 1; i < candidateChain.length; i++){
        if(!isNewBlockValid(candidateChain[i], candidateChain[1 - 1])){
            //console.log()
            return false;
        }
        return true;
    }
}

const replaceChain = candidateChain => {
    if(isChainValid(candidateChain) && candidateChain.length > getBlockchain().length()){
        blockchain = candidateChain;
        return true;
    }else{
        return false;
    }
}

const addBlockToChain = candidateBlock => {
    if(isNewBlockValid(candidateBlock, getLastBlock())){
        getBlockchain().push(candidateBlock);
        return true;
    }else{
        return false;
    }
}

console.log(blockchain);