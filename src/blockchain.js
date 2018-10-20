const cryptoJS = require("crypto-js"),
    hexToBinary = require("hex-to-binary");

const BLOCK_GENERATION_INTERVAL = 10;
const DIFFICULTY_ADJUSTMENT_INTERVAL = 10; //Bitcoin is 2016

class Block {
    constructor(index, hash, previousHash, timestamp, data, difficulty, nonce) {
        this.index = index;
        this.hash = hash;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.difficulty = difficulty;
        this.nonce = nonce;
    }
}

const genesisBlock = new Block(
    0,
    "FB5B7B6C73D35DABECFB84B26239D1DB97ACDD78D16FE2056DE31A1FB8037AFC",
    null,
    1539752978,
    "This is the genesis!",
    0,
    0
);

let blockchain = [genesisBlock];

const getBlockchain = () => blockchain;
const getNewestBlock = () => blockchain[blockchain.length - 1];
const getTimestamp = () => Math.round(new Date().getTime() / 1000);
const createHash = (index, previousHash, timestamp, data, difficulty, nonce) => 
    cryptoJS.SHA256(
        index + previousHash + timestamp + JSON.stringify(data) + difficulty + nonce
    ).toString();

const getBlockhash = (block) => createHash(block.index, block.previousHash, block.timestamp, block.data, block.difficulty, block.nonce);

const isTimestampValid = (newBlock, oldBlock) => {
    return (
        oldBlock.timestamp - 60 < newBlock.timestamp &&
        newBlock.timestamp - 60 < getTimestamp()
    );
}

const createNewBlock = data => {
    const previousBlock = getNewestBlock();
    const newBlockIndex = previousBlock.index + 1;
    const newTimestamp = getTimestamp();
    const difficulty = findDifficulty();
    
    const newBlock = findBlock(
        newBlockIndex,
        previousBlock.hash,
        newTimestamp,
        data,
        difficulty
    );

    addBlockToChain(newBlock);
    require("./p2p").broadcastNewBlock();
    return newBlock;
}

const findDifficulty = () => {
    const newestBlock = getNewestBlock();
    if( 
        newestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 &&
        newestBlock.index !== 0
    ){
        return calculateNewDifficulty(newestBlock, getBlockchain());
    }else{
        return newestBlock.difficulty;
    }
}

const calculateNewDifficulty = (newestBlock, blockchain) => {
    const lastCalculatedBlock = blockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
    const timeExpected = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
    const timeTaken = newestBlock.timestamp - lastCalculatedBlock.timestamp;

    if(timeTaken < timeExpected / 2){
        return lastCalculatedBlock.difficulty + 1;
    }else if(timeTaken > timeExpected * 2){
        return lastCalculatedBlock.difficulty - 1;
    }else{
        lastCalculatedBlock.difficulty;
    }
}

const findBlock = (index, previousHash, timestamp, data, difficulty) => {
    let nonce = 0;
    while (true) {
        console.log("Current nonce:", nonce);

        const hash = createHash(
            index,
            previousHash, 
            timestamp, 
            data, 
            difficulty, 
            nonce
        );

        if(hashMatchesDifficulty(hash, difficulty)){
            return new Block(index, hash, previousHash, timestamp, data, difficulty, nonce);
        }
        nonce++;
    }
}

const hashMatchesDifficulty = (hash, difficulty) => {
    const hashInBinary = hexToBinary(hash);
    const requiredZeros = "0".repeat(difficulty);

    console.log("Trying difficulty:", difficulty,"with hash", hashInBinary);

    return hashInBinary.startsWith(requiredZeros);
}

const isBlockValid = (candidateBlock, latestBlock) => {
    if (!isBlockStructureValid(candidateBlock)) {
        console.log("The candidate block sturucture is not valid.");
        return false;
    } else if (latestBlock.index + 1 !== candidateBlock.index) {
        console.log("The candidateBlock doesnt have a valid index.");
        return false;
    } else if (latestBlock.hash !== candidateBlock.previousHash) {
        console.log("The previousHash of candidate block is not the hash of latest block.");
        return false;
    } else if (candidateBlock.hash !== getBlockhash(candidateBlock)) {
        console.log("The hash of this block is invalid.");
        return false;
    }else if(!isTimestampValid(candidateBlock, latestBlock)){
        console.log("The timestamp of this block is dodgy!");
        return false;
    }
    return true;
}

const isBlockStructureValid = block => {
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

    if (!isGenesisValid(candidateChain[0])) {
        console.log("The candidateChain's genesisBlock is not the same as our genesisBlock.");
        return false;
    }

    for (let i = 1; i < candidateChain.length; i++) {
        if (!isBlockValid(candidateChain[i], candidateChain[1 - 1])) {
            //console.log()
            return false;
        }
        return true;
    }
}

const sumDifficulty = anyblockchain => 
    anyblockchain
        .map(block => block.difficulty)
        .map(difficult => Math.pow(2, difficult))
        .reduce((a, b) => a+b);

const replaceChain = candidateChain => {
    if (isChainValid(candidateChain) && 
        sumDifficulty(candidateChain) > sumDifficulty(getBlockchain())
    ) {
        blockchain = candidateChain;
        return true;
    } else {
        return false;
    }
}

const addBlockToChain = candidateBlock => {
    if (isBlockValid(candidateBlock, getNewestBlock())) {
        console.log("Added new block!");
        blockchain.push(candidateBlock);
        return true;
    } else {
        return false;
    }
}

module.exports = {
    getBlockchain,
    createNewBlock,
    getNewestBlock,
    isBlockStructureValid,
    addBlockToChain,
    replaceChain
}