const express = require('express');
const app = express();
// const mysql = require('mysql');
// const session = require('express-session');
// const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const Web3 = require('web3');
const BigNumber = require('bignumber.js');
const fs = require('fs');
// const io = require('socket.io')(app);

// Secret ID for session
// const secret_id = process.env.secret;



// IP and port
const port = process.env.PORT || 3300;



// Body-parser Middleware
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));



// Web3 connection
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:7545'));
console.log(`Talking with a geth server ${web3.version.api} \n`);

const abiArray = [{
        "constant": true,
        "inputs": [{
            "name": "_verify",
            "type": "bool"
        }],
        "name": "verifyRetail",
        "outputs": [{
            "name": "",
            "type": "bool"
        }],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [{
            "name": "_verify",
            "type": "bool"
        }],
        "name": "verifyTransport",
        "outputs": [{
            "name": "",
            "type": "bool"
        }],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [{
                "name": "_prod_id",
                "type": "uint256"
            },
            {
                "name": "_prod_name",
                "type": "string"
            },
            {
                "name": "_quantity",
                "type": "uint256"
            }
        ],
        "name": "createProd",
        "outputs": [{
            "name": "",
            "type": "uint256"
        }],
        "payable": true,
        "stateMutability": "payable",
        "type": "function"
    }
]

const address = '';

const Contract = new web3.eth.Contract(abiArray);
const contractInstance = new web3.eth.Contract(abiArray, address);

web3.eth.defaultAccount = web3.eth.coinbase;

// This function generates a QR code
function generateQRCode() {
    return crypto.randomBytes(20).toString('hex');
}


// Routes for webpages
app.use(express.static(__dirname + '/views'));


// Manufacturer generates a QR Code here
app.get('/Manu', (req, res) => {
    res.sendFile('views/Manu.html', { root: __dirname });
});


// Main website which has 2 routers - manufacturer & retailer
app.get('/', (req, res) => {
    res.sendFile('views/landing.html', { root: __dirname });
});



/**
 * Description: Add retailer to code
 * Request:     POST /addRetailerToCode
 * Send:        JSON object which contains code, email
 * Receive:     200 if successful, 400 otherwise
 */
app.post('/addRetailerToCode', (req, res) => {
    console.log('Request to /addRetailerToCode\n');
    let code = req.body.code;
    let ok = contractInstance.addRetailerToCode(code, hashedEmail);
    if (!ok) {
        return res.status(400).send('Error');
    }
    return res.status(200).send('Success');
});


/**
 * Description: Lists all the assets owned by the user
 * Request:     POST /myAssets
 * Send:        JSON object which contains email
 * Receive:     JSON array of objects which contain brand, model, description, status, manufacturerName,manufacturerLocation,
 *                                                  manufacturerTimestamp, retailerName, retailerLocation, retailerTimestamp
 */

// <=====================================================>

app.post('/myAssets', (req, res) => {
    console.log('Request to /myAssets\n');
    let myAssetsArray = [];
    let email = req.body.email;
    let hashedEmail = hashMD5(email);
    let arrayOfCodes = contractInstance.getCodes(hashedEmail);
    console.log(`Email ${email}`);
    console.log(`Customer has these product codes: ${arrayOfCodes} \n`);
    for (code in arrayOfCodes) {
        let ownedCodeDetails = contractInstance.getOwnedCodeDetails(arrayOfCodes[code]);
        let notOwnedCodeDetails = contractInstance.getNotOwnedCodeDetails(arrayOfCodes[code]);
        myAssetsArray.push({
            'code': arrayOfCodes[code],
            'brand': notOwnedCodeDetails[0],
            'model': notOwnedCodeDetails[1],
            'description': notOwnedCodeDetails[2],
            'status': notOwnedCodeDetails[3],
            'manufacturerName': notOwnedCodeDetails[4],
            'manufacturerLocation': notOwnedCodeDetails[5],
            'manufacturerTimestamp': notOwnedCodeDetails[6],
            'retailerName': ownedCodeDetails[0],
            'retailerLocation': ownedCodeDetails[1],
            'retailerTimestamp': ownedCodeDetails[2]
        });
    }
    res.status(200).send(JSON.parse(JSON.stringify(myAssetsArray)));
});


// This array keeps track of all the QR Codes in use
const QRCodes = [];

/**
 * Description: Sell a product from myAssets (aka your inventory)
 * Request:     POST /sell
 * Send:        JSON object which contains code, sellerEmail
 * Receive:     List of QR Codes owned by the seller if successful, 400 otherwise
 */
app.post('/sell', (req, res) => {
    console.log('Request to /sell\n');
    let code = req.body.code;
    let sellerEmail = req.body.email;
    console.log(`Email ${sellerEmail} \n`);
    hashedSellerEmail = hashMD5(sellerEmail);
    let currentTime = Date.now(); // Date.now() gets the current time in milliseconds
    let QRCode = generateQRCode();
    let QRCodeObj = {
        'QRCode': QRCode,
        'currentTime': currentTime,
        'sellerEmail': sellerEmail,
        'buyerEmail': '',
        'code': code,
        'confirm': '0',
        'retailer': '0'
    };
    QRCodes.push(QRCodeObj);
    console.log(`Session created ${(JSON.stringify(QRCode))} \n`);
    res.status(200).send(JSON.parse(JSON.stringify(QRCode)));
});


/**
 * Description: Buy a product
 * Request:     POST /buy
 * Send:        JSON object which contains QRCode, email
 * Receive:     200 if successful, 400 otherwise
 */
app.post('/buy', (req, res) => {
    console.log('Request to /buy\n');
    let QRCode = req.body.QRCode;
    let buyerEmail = req.body.email;
    let currentTime = Date.now(); // Date.now() gets the current time in milliseconds
    console.log(`Email: ${buyerEmail} \n`);
    for (let i = 0; i < QRCodes.length; i++) {
        if (QRCode === QRCodes[i]['QRCode']) {
            let timeElapsed = Math.floor((currentTime - QRCodes[i]['currentTime']) / 1000);
            // QR Codes are valid only for 600 secs
            if (timeElapsed <= 600) {
                QRCodes[i]['buyerEmail'] = buyerEmail;
                console.log(`QRCode matches, Session updated ${(JSON.stringify(QRCode))} \n`);
                return res.status(200).send('Validated!');
            }
            console.log('Time out error\n');
            return res.status(400).send('Timed out!');
        }
    }
    console.log('Could not find QRCode\n');
    return res.status(400).send('Could not find QRCode');
});


/**
 * Description: Get product details
 * Request:     POST /getProductDetails
 * Send:        JSON object which contains code
 * Receive:     JSON object whcih contains brand, model, description, status, manufacturerName, manufacturerLocation,
 *                                         manufacturerTimestamp, retailerName, retailerLocation, retailerTimestamp
 */
app.post('/getProductDetails', (req, res) => {
    console.log('Request to /getProductDetails\n');
    let code = req.body.code;
    let QRCode = req.body.QRCode;
    let currentTime = Date.now(); // Date.now() gets the current time in milliseconds
    for (let i = 0; i < QRCodes.length; i++) {
        if (QRCode === QRCodes[i]['QRCode']) {
            let timeElapsed = Math.floor((currentTime - QRCodes[i]['currentTime']) / 1000);
            // QR Codes are valid only for 600 secs
            if (timeElapsed <= 600) {
                let ownedCodeDetails = contractInstance.getOwnedCodeDetails(code);
                let notOwnedCodeDetails = contractInstance.getNotOwnedCodeDetails(code);
                if (!ownedCodeDetails || !notOwnedCodeDetails) {
                    return res.status(400).send('Could not retrieve product details.');
                }
                let productDetails = {
                    'brand': notOwnedCodeDetails[0],
                    'model': notOwnedCodeDetails[1],
                    'description': notOwnedCodeDetails[2],
                    'status': notOwnedCodeDetails[3],
                    'manufacturerName': notOwnedCodeDetails[4],
                    'manufacturerLocation': notOwnedCodeDetails[5],
                    'manufacturerTimestamp': notOwnedCodeDetails[6],
                    'retailerName': ownedCodeDetails[0],
                    'retailerLocation': ownedCodeDetails[1],
                    'retailerTimestamp': ownedCodeDetails[2]
                };
                console.log('QRCode matched\n');
                return res.status(200).send(JSON.parse(JSON.stringify(productDetails)));
            }
            console.log('Time out error\n');
            return res.status(400).send('Timed out!');
        }
    }
});



/**
 * Description: Gives product details if the scannee is not the owner of the product
 * Request:     POST /scan
 * Send:        JSON object which contains code
 * Receive:     JSON object which has productDetails
 */
app.post('/scan', (req, res) => {
    console.log('Request made to /scan\n');
    let code = req.body.code;
    let productDetails = contractInstance.getNotOwnedCodeDetails(code);
    let productDetailsObj = {
        'name': productDetails[0],
        'model': productDetails[1],
        'status': productDetails[2],
        'description': productDetails[3],
        'manufacturerName': productDetails[4],
        'manufacturerLocation': productDetails[5],
        'manufacturerTimestamp': productDetails[6]
    };
    console.log(`Code ${code} \n`);
    res.status(200).send(JSON.stringify(productDetailsObj));
});


/**
 * Description: Generates QR codes for the manufacturers
 * Request:     POST /QRCodeForManufacturer
 * Send:        JSON object which contains brand, model, status, description, manufacturerName, manufacturerLocation
 * Receive:     200 if QR code was generated, 400 otherwise.
 */
app.post('/QRCodeForManufacturer', (req, res) => {
    console.log('Request to /QRCodeForManufacturer\n');
    let brand = req.body.brand;
    let model = req.body.model;
    let status = 0;
    let description = req.body.description;
    let manufacturerName = req.body.manufacturerName;
    let manufacturerLocation = req.body.manufacturerLocation;
    let manufacturerTimestamp = new Date(); // Date() gives current timestamp
    manufacturerTimestamp = manufacturerTimestamp.toISOString().slice(0, 10);
    let salt = crypto.randomBytes(20).toString('hex');
    let code = hashMD5(brand + model + status + description + manufacturerName + manufacturerLocation + salt);
    let ok = contractInstance.createCode(code, brand, model, status, description, manufacturerName, manufacturerLocation,
        manufacturerTimestamp, { from: web3.eth.accounts[0], gas: 3000000 });
    console.log(`Brand: ${brand} \n`);
    if (!ok) {
        return res.status(400).send('ERROR! QR Code for manufacturer could not be generated.');
    }
    console.log(`The QR Code generated is: ${code} \n`);
    let QRcode = code + '\n' + brand + '\n' + model + '\n' + description + '\n' + manufacturerName + '\n' + manufacturerLocation;
    fs.writeFile('views/davidshimjs-qrcodejs-04f46c6/code.txt', QRcode, (err, QRcode) => {
        if (err) {
            console.log(err);
        }
        console.log('Successfully written QR code to file!\n');
    });
    res.sendFile('views/davidshimjs-qrcodejs-04f46c6/index.html', { root: __dirname });
});


/**
 * Description: Gives all the customer details
 * Request:     GET /getCustomerDetails
 * Send:        JSON object which contains email
 * Receive:     JSON object which contains name, phone
 */
app.get('/getCustomerDetails', (req, res) => {
    console.log('Request to /getCustomerDetails\n');
    let email = req.body.email;
    let hashedEmail = hash(email);
    let customerDetails = contractInstance.getCustomerDetails(hashedEmail);
    console.log(`Email: ${email} \n`);
    let customerDetailsObj = {
        'name': customerDetails[0],
        'phone': customerDetails[1]
    };
    res.status(200).send(JSON.parse(JSON.stringify(customerDetailsObj)));
});

// Server start
app.listen(port, (req, res) => {
    console.log(`Listening to port ${port}...\n`);
});