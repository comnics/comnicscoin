const cryptoJS = require("crypto-js"),
    hexToBinary = require("hex-to-binary"),
    Wallet = require("./wallet"),
    Transactions = require("./transactions"),
    Mempool = require("./mempool"),
    _ = require("lodash");

const { getBalance, getPublicFromWallet, getPrivateFromWallet, createTx } = Wallet;
const { createCoinbaseTx, processTxs } = Transactions;
const { addToMempool, getMempool, updateMempool } = Mempool;

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
const genesisTx = {
    txIns: [{signature: "", txOutId: "", txOutIndex: 0 }],
    txOuts: [
        {
            address: "04dee6423504d47f6ff18e1470f874507f3aa75d22997e9bbf9124456372d24cd83ee9d4c323b5ce37914a1a28114467e3d94d95a60033fe5bf176be4b5c040322",
            amount: 50
        }
    ],
    id: "dc1c5c956ca674360ce47b663ccb9494b4488ba5dcd238f3fcf814faec462b3c"
};

const genesisBlock = new Block(
    0,
    "87f342243e4a8c61d4311a091cc1fa5528357b706f91cbff8dccf5b7bb6ea5ba",
    null,
    1539752978,
    [genesisTx],
    0,
    0
);

let blockchain = [genesisBlock];
let uTxOuts = processTxs(blockchain[0].data, [], 0);

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

const createNewBlock = () => {
    const coinbaseTx = createCoinbaseTx(getPublicFromWallet(), getNewestBlock().index + 1);
    const blockData = [coinbaseTx].concat(getMempool());
    return createNewRawBlock(blockData);
};

const createNewRawBlock = data => {
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
        typeof block.data === 'object'
    );
};

const isChainValid = candidateChain => {
    const isGenesisValid = block => {
        return JSON.stringify(block) === JSON.stringify(genesisBlock);
    };

    if (!isGenesisValid(candidateChain[0])) {
        console.log("The candidateChain's genesisBlock is not the same as our genesisBlock.");
        return null;
    }

    let foreignUTxOuts = [];

    for (let i = 0; i < candidateChain.length; i++) {
        const currentBlock = candidateChain[i];
        if (i !== 0 && !isBlockValid(candidateChain[i], candidateChain[1 - 1])) {
            //console.log()
            return null;
        }

        foreignUTxOuts = processTxs(
            currentBlock.data,
            foreignUTxOuts,
            currentBlock.index
        );

        if (foreignUTxOuts === null) {
            return null;
        }
        return foreignUTxOuts;
    }
}

const sumDifficulty = anyblockchain => 
    anyblockchain
        .map(block => block.difficulty)
        .map(difficult => Math.pow(2, difficult))
        .reduce((a, b) => a+b);

const replaceChain = candidateChain => {
    const foreignUTxOuts = isChainValid(candidateChain);
    const validChain = foreignUTxOuts !== null;
  
    if (validChain && 
        sumDifficulty(candidateChain) > sumDifficulty(getBlockchain())
    ) {
        blockchain = candidateChain;
        uTxOuts = foreignUTxOuts;
        updateMempool(uTxOuts);
        require("./p2p").broadcastNewBlock();
        return true;
    } else {
        return false;
    }
}

const addBlockToChain = candidateBlock => {
    if (isBlockValid(candidateBlock, getNewestBlock())) {
        const processedTxs = processTxs(candidateBlock.data, uTxOuts, candidateBlock.index);
        if(processedTxs === null){
            console.log("Couldnt process txs.");
            return false;
        }else{
            blockchain.push(candidateBlock);
            uTxOuts = processedTxs;
            updateMempool(uTxOuts);
            return true;
        }
        
        return true;
    } else {
        return false;
    }
}

const getAccountBalance = () => getBalance(getPublicFromWallet(), uTxOuts);

const getUTxOutList = () => _.cloneDeep(uTxOuts);

const sendTx = (address, amount) => {
    const tx = createTx(address, amount, getPrivateFromWallet(), getUTxOutList(), getMempool());
    addToMempool(tx, getUTxOutList());
    require("./p2p").broadcastMempool();

    return tx;
};

const handleIncomingTx = tx => {
    addToMempool(tx, getUTxOutList());
};

module.exports = {
    getBlockchain,
    createNewBlock,
    getNewestBlock,
    isBlockStructureValid,
    addBlockToChain,
    replaceChain,
    getAccountBalance,
    sendTx,
    getUTxOutList,
    handleIncomingTx
}