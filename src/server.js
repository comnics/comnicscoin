const express = require("express"),
    bodyParser = require("body-parser"),
    morgan = require("morgan"),
    cors = require("cors"),
    Blockchain = require("./blockchain"),
    P2P = require("./p2p"),
    wallet = require("./wallet"),
    mempool = require("./mempool"),
    _ = require("lodash");

    const { getBlockchain, createNewBlock, getAccountBalance, sendTx, getUTxOutList } = Blockchain;
    const { startP2PServer, connectToPeers } = P2P;
    const { initWallet, getPublicFromWallet, getBalance } = wallet;
    const { getMempool } = mempool;


    const PORT = process.env.HTTP_PORT || 3000;

    const app = express();
    app.use(bodyParser.json());
    app.use(cors());
    app.use(morgan("combined"));

    app.route("/blocks")
    .get((req, res) => {
        res.send(getBlockchain());
    })
    .post((req, res) => {
        //const { body: { data } } = req;
        const newBlock = createNewBlock();
        res.send(newBlock);
    });

    app.get("/blocks/:hash", (req, res) => {
        const { params: { hash } } = req;
        const block = _.find(getBlockchain(), {hash});
        if(block === undefined){
            res.status(400).send("Block is not Found.");
        }else{
            res.send(block);
        }
        
    });

    app.get("/transactions/:id", (req, res) => {
        const tx = _(getBlockchain())
          .map(blocks => blocks.data)
          .flatten()
          .find({ id: req.params.id });
        if (tx === undefined) {
          res.status(400).send("Transaction not found");
        }
        res.send(tx);
    });

    app.get("/address/:address", (req, res) => {
        const { params: { address } } = req;
        const balance = getBalance(address, getUTxOutList());
        res.send({ balance });
    });

    app.post("/peers", (req, res) => {
        const { body: { peer }} = req;
        console.log(peer);
        connectToPeers(peer);
        res.send();
    });

    app.get("/me/balance", (req, res) => {
        const balance = getAccountBalance();
        res.send({balance});
    });

    app.get("/me/address", (req, res) => {
        res.send(getPublicFromWallet());
    });

    app.get("/utxo", (req, res) => {
        res.send(getUTxOutList());
    });

    app.get("/mempool", (req, res) => {
        res.send(getMempool());
    });

    app.route("/transactions")
        .get((req, res) => {
            res.send(getMempool());
        })
        .post((req, res) => {
            try {
                const { body: {address, amount}} = req;
                if(address === undefined || amount === undefined){
                    throw Error("Please specify an address or an amount.");
                }else{
                    const result = sendTx(address, amount);
                    res.send(result);
                }
            } catch (e) {
                res.status(400).send(e.message);
            }
        })

    const server = app.listen(PORT, () => console.log(`comnicscoin Server is running on ${PORT}`));

    initWallet();
    startP2PServer(server);
