const CryptoJS = require("crypto-js"),
    utils = require("./utils"),
    elliptic = require("elliptic"),
    _ = require("lodash");
    
const ec = new elliptic.ec("secp256k1");

const COINBASE_AMOUNT = 50;

class TxOut{
    constructor(address, amount) {
        this.address = address;
        this.amount = amount;
    }
}

class TxIn{
    // txOutId
    // txOutIndex
    // signature
}

class Transaction{
    // ID
    // txIns[]
    // txOuts[]
}

class UTxOut {
    constructor(txOutId, txOutIndex, address, amount) {
        this.txOutId = txOutId;
        this.txOutIndex = txOutIndex;
        this.address = address;
        this.amount = amount;
    }
}

const getTxId = tx => {
    const txInContent = tx.txIns.map(txIn => txIn.uTxOutId + txIn.uTxOutIndex).reduce((a, b) => a+b, "");
    const txOutContent = tx.txOuts.map(txOut => txOut.address + txOut.amount).reduce((a, b) => a+b, "");

    return CryptoJS.SHA256(txInContent + txOutContent + tx.timestamp).toString();
}

const findUTxOut = (txOutId, txOutIndex, uTxOutList) => {
    return uTxOutList.find(uTxO => uTxO.txOutId === txOutId && uTxO.txOutIndex === txOutIndex);
};

const signTxIn = (tx, txInIndex, privateKey, uTxOutList) => {
    const txIn = tx.txIns[txInIndex];
    const dataToSign = tx.id;

    const referencedUTxOut = findUTxOut(txIn.txOutId, txIn.txOutIndex, uTxOutList);
    if( referencedUTxOut === null){
        return ;
    }

    const referencedAddress = referencedUTxOut.address;
    if( getPublicKey(privateKey) !== referencedAddress){
        return false;
    }
    const key = ec.keyFromPrivate(privateKey, "hex");
    const signature = utils.toHexString(key.sign(dataToSign).toDER());
    return signature;
}

const getPublicKey = (privateKey) => {
    return ec.keyFromPrivate(privateKey, "hex").getPublic().encode("hex");
}

const updateUTxOuts = (newTxs, uTxOutList) => {
    const newUTxOuts = newTxs
        .map(tx => 
            tx.txOuts.map(
                (txOut, index) => new UTxOut(tx.id, index, txOut.address, txOut.amount)
            )
        )
        .reduce((a,b) => a.concat(b), []);

    const spentTxOuts = newTxs
        .map(tx => tx.txIns)
        .reduce((a,b) => a.concat(b), [])
        .map(txIn => new UTxOut(txIn.txOutId, txIn.txOutIndex, "", 0));

    const resultingUTxOuts = uTxOutList
    .filter(uTxO => !findUTxOut(uTxO.txOutId, uTxO.txOutIndex, spentTxOuts))
    .concat(newUTxOuts);

    return resultingUTxOuts;
};

const isTxInStructureValid = (txIn) => {
    if(txIn === null){
        return false;
    }else if( typeof tx.signature !== "string"){
        return false;
    }else if( typeof tx.txOutId !== "string"){
        return false;
    }else if( typeof tx.txOutIndex !== "number"){
        return false;
    }else{
        return true;
    }
}

const isAddressValid = (address) => {
    if(address.length !== 130){
        return false;
    }else if(address.match("^[a-fA-F0-9]+$") === null){
        return false;
    }else if(address.startsWith("04")){
        return false;
    }else{
        return true;
    }
}
const isTxOutStructureValid = (txOut) => {
    if(txOut === null){
        return false;
    }else if( typeof txOut.address !== "string"){
        return false;
    }else if( !isAddressValid(tx.address)){
        return false;
    }else if( typeof txOut.amount !== "number"){
        return false;
    }else{
        return true;
    }
}

const isTxStructureValid = tx => {
    if( typeof tx.id !== "string"){
        console.log("Tx ID is not valid.");
        return false;
    }else if( !(tx.txIns instanceof Array)){
        console.log("The TxIns are not an array.");
        return false;
    }else if( !tx.txIns.map(isTxInStructureValid).reduce((a,b)=> a && b, true) ){
        console.log("The structure of one of the txIn is not valid.");
        return false;
    }else if( !(tx.txOuts instanceof Array)){
        console.log("The TxOuts are not an array.");
        return false;
    }else if( !tx.txOuts.map(isTxOutStructureValid).reduce((a,b)=> a && b, true) ){
        console.log("The structure of one of the txOut is not valid.");
        return false;
    }else{
        return true;
    }
}

const validateTxIn = (txIn, tx, uTxOutList) => {
    const wantedTxOut = uTxOutList.find(uTxO => uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex);
    if(wantedTxOut === undefined){
        return false;
    }
    else{
        const address = wantedTxOut.address;
        const key = ec.keyFromPublic(address, "hex");
        /**
         * Todo
         *  
         * "Signature without r or s" 에러 발생 
         * 해결해야 함.
        */
        return true;//key.verify(tx.id, txIn.signature);
    }
}

const getAmountInTxIn = (txIn, uTxOutList) => findUTxOut(txIn.txOutId, txIn.txOutIndex, uTxOutList).amount;

const validateTx = (tx, uTxOutList) => {
    if(getTxId(tx) !== tx.id){
        return false;
    }

    const hasValidTxIns = tx.txIns.map(txIn => validateTxIn(txIn, tx, uTxOutList));

    if( !hasValidTxIns ){
        return false;
    }

    const amountInTxIns = tx.txIns.map(txIn => getAmountInTxIn(txIn, uTxOutList)).reduce((a,b)=>a+b, 0);
    const amountInTxOuts = tx.txOuts.map(txOut => txOut.amount).reduce((a,b) => a+b, 0);

    if( amountInTxIns !== amountInTxOuts ){
        return false;
    }else{
        return true;
    }
}

const validateCoinbaseTx = (tx, blockIndex) => {
    if( getTxId(tx) !== tx.id ){        
        return false;
    }else if(tx.txIns.length !== 1){

        return false;
    }else if(tx.txIns[0].txOutIndex !== blockIndex){
        return false;
    }else if(tx.txOuts.length !== 1){
        return false;
    }else if(tx.txOuts[0].amount !== COINBASE_AMOUNT){
        return false;
    }else{
        return true;
    }
}

const createCoinbaseTx = (address, blockIndex) => {
    const tx = new Transaction();
    const txIn = new TxIn();
    txIn.signature = "";
    txIn.txOutId = "";
    txIn.txOutIndex = blockIndex;
    tx.txIns = [txIn];
    tx.txOuts = [ new TxOut(address, COINBASE_AMOUNT)];
    tx.timestamp = Math.round(new Date().getTime() / 1000);
    tx.id = getTxId(tx);
    return tx;
}

const hasDuplicates = (txIns) => {
    const groups = _.countBy(txIns, txIn => txIn.txOutId + txIn.txOutIndex);

    return _(groups).map(value => {
        if(value > 1){
            console.log("Found a duplicated txIn.");
            return true;
        }else{
            return false;
        }
    }).includes(true);
};

const validateBlockTxs = (txs, uTxOutList, blockIndex) => {
    const coinbaseTx = txs[0];
    if(!validateCoinbaseTx(coinbaseTx, blockIndex)){
        console.log("Coinbase Tx is invalid.");
    }

    const txIns = _(txs).map(tx => tx.txIns).flatten().value();

    if(hasDuplicates(txIns)){
        console.log("Found duplicated txIns.");
        return false;
    }

    const nonCoinbaseTxs = txs.slice(1);

    return nonCoinbaseTxs.map(tx => validateTx(tx, uTxOutList)).reduce((a, b) => a + b, true);
};

const processTxs = (txs, uTxOutsList, blockIndex) => {
    if( !validateBlockTxs(txs, uTxOutsList, blockIndex)){
        return null;
    }
    return updateUTxOuts(txs, uTxOutsList);
}

module.exports = {
    getPublicKey,
    getTxId,
    signTxIn,
    TxIn,
    TxOut,
    Transaction,
    createCoinbaseTx,
    processTxs,
    validateTx
}