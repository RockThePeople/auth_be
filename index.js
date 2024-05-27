const express = require('express');
const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');
const EthrDID = require('ethr-did');
const jose = require('jose');
const nodejose = require('node-jose');
const mysql = require('mysql2/promise');
const config = require('./config.js');

app.use(cors());
app.use(bodyParser.json());

//admin keypair
const keypair_1 = {
    address: '0x9021361C5226099AA99370DfeD181c9E31469d3B',
    privateKey: '0x1de50334b47bc59027ecb6450637c333a57566941e29e51859c030de1261662b',
    publicKey: '0x0361e0984afc0e6dbb76a2fc2f7f1e86d63613f42ce032a8e26a812c82bd9bc1e3',
    identifier: '0x0361e0984afc0e6dbb76a2fc2f7f1e86d63613f42ce032a8e26a812c82bd9bc1e3'
}
const ethrdid = new EthrDID.EthrDID({ ...keypair_1 });
app.use(bodyParser.json());

// @user, 생성된 DID 보여주기
async function showDIDList(account) {
    const pool = mysql.createPool(config);
    console.log(account);
    const query = `SELECT * FROM generatedDID where account = '${account}';`
    const [rows] = await pool.query(query);
    console.log(rows);
    return rows;
}

// @user. 생성된 DID 저장하기
app.get('/checkbyvendingmachine', async (req, res) => {
    const account = req.query.account;
    const pool = mysql.createPool(config);
    if (!account) {
        return res.status(400).json({ error: 'Account parameter is required' });
    }
    const query = `SELECT role FROM accounts WHERE account = '${account}';`;
    const [rows] = await pool.query(query);
    if (rows.length === 0) {
        return res.json({ result: false });
    }
    const role = results[0].role;
    const isCompany = role === 'Company';
    return res.json({ result: isCompany });
});

// @user, 생성된 DID 보여주기
async function showDIDList(account) {
    const pool = mysql.createPool(config);
    console.log(account);
    const query = `SELECT * FROM generatedDID where account = '${account}';`
    const [rows] = await pool.query(query);
    console.log(rows);
    return rows;
}

// @user. 생성된 DID 저장하기
app.post('/showDIDList', async (req, res) => {
    const userAccount = req.body.account;
    const resData = await showDIDList(userAccount);
    console.log(resData);
    if (resData) {
        res.status(200).send(resData);
    } else {
        res.status(200).send(null);
    }
})


// @admin 요청 승인 시, 요청 목록에서 삭제
async function deleteFromRequests(account) {
    const pool = mysql.createPool(config);
    const query = `DELETE FROM requests WHERE account = ?`;
    const [result] = await pool.query(query, [account]);
    return result;
}

// @admin 승인된 계정에 따른 DID 생성 후 집어넣기
async function insertIntoGeneratedDID(account) {
    const pool = mysql.createPool(config);
    const query = `SELECT * FROM requests WHERE account = '${account}';`;
    const [result] = await pool.query(query);
    const did = await ethrdid.signJWT({ claims: { name: result[0].name, position: result[0].position, Email: result[0].email, account: result[0].account } });
    console.log("generated! : ", did);
    const query1 = `INSERT IGNORE INTO generatedDID (account, did) VALUES ('${account}', '${did}');`;
    try {
        await pool.query(query1);
    } catch (error) {
        console.error('Error : ', error);
    }
    deleteFromRequests(account);
    return;
}

// @admin 계정 확인, DID 생성 API
app.post('/approveRequest', async (req, res) => {
    const account = req.body.account;
    try {
        await insertIntoGeneratedDID(account);
        res.status(200).send({ message: '승인이 정상적으로 이뤄졌습니다.' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// @admin, 요청 목록 보여주기
async function showRequestList(account) {
    const pool = mysql.createPool(config);
    const query = `SELECT role FROM accounts where account = '${account}';`
    const [rows] = await pool.query(query);
    console.log(rows);
    if(rows.length == 0) return null;
    if (rows[0].role == 'admin') {
        const query1 = `SELECT * FROM requests`;
        const [rows] = await pool.query(query1);
        return rows;
    }
    return null;
}

// @admin. 요청 목록 조회 API
app.post('/requestList', async (req, res) => {
    const userAccount = req.body.account;
    const resData = await showRequestList(userAccount);
    console.log(resData);
    if (resData) {
        res.status(200).send(resData);
    } else {
        res.status(200).send({msg : "관리자 계정이 아닙니다"});
    }
})

async function appendOnRequestList(name, account, email, position) {
    const pool = mysql.createPool(config);
    const query = `INSERT IGNORE INTO requests (account, name, position, email, timestamp) 
                    VALUES ('${account}', '${name}', '${position}', '${email}', CURRENT_TIMESTAMP());`
    const [rows] = await pool.query(query);
    return rows;
}
//from admin page
app.post('/didrequest', async (req, res) => {
    const userAccount = req.body.account;
    const userEmail = req.body.email;
    const userPosition = req.body.position;
    const userName = req.body.name;
    const resData = await appendOnRequestList(userName, userAccount, userEmail, userPosition);
    console.log(resData);
    if (resData) {
        res.status(200).send(resData);
    }
    else {
        res.status(200).send(null);
    }
})

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log('server is running on 8080');
});
