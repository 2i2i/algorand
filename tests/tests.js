const algosdk = require("algosdk");

const token = '';
const server = 'https://testnet.algoexplorerapi.io';
const port = '';
const client = new algosdk.Algodv2(token, server, port);

const CREATOR_MNEMONIC = ''; // DO NOT ADD TO SOURCE CONTROL
const SYSTEM_ID = 32969536;
const SYSTEM_ACCOUNT = 'WUTGDFVYFLD7VMPDWOO2KOU2YCKIL4OSY43XSV4SBSDIXCRXIPOHUBBLOI'; // could calc

const MIN_TXN_FEE = 1000;
const MIN_ASA_BALANCE = 100000;
const LOCK_ALGO_FEE = 4 * MIN_TXN_FEE;
const LOCK_ASA_FEE = 5 * MIN_TXN_FEE;
const OPT_IN_ASA_FEE = 2 * MIN_ASA_BALANCE + MIN_TXN_FEE + LOCK_ASA_FEE;

const createAccounts = (creatorMnemonic) => {
  // create CREATOR account
  const creator = algosdk.mnemonicToSecretKey(creatorMnemonic);
  console.log('CREATOR', creator.addr);

  // create A
  const A = algosdk.generateAccount();
  console.log('A', A.addr);

  // create B
  const B = algosdk.generateAccount();
  console.log('B', B.addr);

  return {
    A, B, creator
  };
};

const sendAlgo = async (from, to, amount) => {
  const suggestedParams = await client.getTransactionParams().do();
  const roundTimeout = 5;
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: from.addr,
    to: to.addr,
    amount,
    suggestedParams,
  });
  const txnSigned = txn.signTxn(from.sk);

  try {
    const { txId } = await client.sendRawTransaction(txnSigned).do();
    await waitForConfirmation(client, txId, roundTimeout);
    console.log(`Sent ${amount} ALGO to ${to.addr} - `, txId);
    return txId;
  }
  catch (e) {
    console.log('error', e);
    throw 'e';
  }
};

const optInApp = async (appIndex, account) => {
  const suggestedParams = await client.getTransactionParams().do();
  const roundTimeout = 5;
  const txn = algosdk.makeApplicationOptInTxnFromObject({
    appIndex,
    from: account.addr,
    suggestedParams,
  });
  const txnSigned = txn.signTxn(account.sk);

  try {
    const { txId } = await client.sendRawTransaction(txnSigned).do();
    await waitForConfirmation(client, txId, roundTimeout);
    console.log(`Opted-in ${account.addr} to app ${appIndex} - `, txId);
    return txId;
  }
  catch (e) {
    console.log('error', e);
    throw 'e';
  }
};

const sendASA = async (assetIndex, from, to, amount) => {
  const suggestedParams = await client.getTransactionParams().do();
  const roundTimeout = 5;
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: from.addr,
    to: to.addr,
    amount,
    assetIndex,
    suggestedParams,
  });
  const txnSigned = txn.signTxn(from.sk);
  try {
    const { txId } = await client.sendRawTransaction(txnSigned).do();
    await waitForConfirmation(client, txId, roundTimeout);
    console.log(`Sent ${amount} of ${assetIndex} from ${from.addr} to ${to.addr} - `, txId);
    return txId;
  }
  catch (e) {
    console.log('error', e);
    throw 'e';
  }
};
const optInASA = (assetIndex, account) => {
  return sendASA(assetIndex, account, account, 0);
};
const createAsset = async (creator) => {
  const suggestedParams = await client.getTransactionParams().do();
  const roundTimeout = 5;
  const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    from: creator.addr,
    total: 1000000000,
    decimals: 0,
    suggestedParams,
  });
  const txnSigned = txn.signTxn(creator.sk);

  try {
    const { txId } = await client.sendRawTransaction(txnSigned).do();
    const result = await waitForConfirmation(client, txId, roundTimeout);
    const assetIndex = result['asset-index'];
    console.log(`created asset`, assetIndex);
    return assetIndex;
  }
  catch (e) {
    console.log('error', e);
    throw 'e';
  }
};

const init = async () => {
  // create accounts
  const accounts = createAccounts(CREATOR_MNEMONIC);

  // send 2 ALGO
  const f1 = sendAlgo(accounts.creator, accounts.A, 2000000);
  const f2 = sendAlgo(accounts.creator, accounts.B, 2000000);
  await Promise.all([f1, f2]);

  // opt-in to SYSTEM
  const f3 = optInApp(SYSTEM_ID, accounts.A);
  const f4 = optInApp(SYSTEM_ID, accounts.B);
  await Promise.all([f3, f4]);

  return accounts;
};

// lock ALGO
const lockAlgo = async (speed, energy, A, B) => {
  const suggestedParams = await client.getTransactionParams().do();
  const roundTimeout = 5;
  const txSendAlgoToSystem = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: A.addr,
    to: SYSTEM_ACCOUNT,
    amount: energy + LOCK_ALGO_FEE,
    suggestedParams,
  });
  const appArg0 = new TextEncoder().encode("LOCK");
  const appArg1 = algosdk.encodeUint64(speed);
  const appArgs = [appArg0, appArg1];
  const txAppCall = algosdk.makeApplicationNoOpTxnFromObject({
    from: A.addr,
    appIndex: SYSTEM_ID,
    appArgs,
    accounts: [B.addr],
    suggestedParams,
  });
  const txns = [txSendAlgoToSystem, txAppCall];
  algosdk.assignGroupID(txns);
  const txnsSigned = txns.map((tx) => { return tx.signTxn(A.sk) });
  try {
    const { txId } = await client.sendRawTransaction(txnsSigned).do();
    await waitForConfirmation(client, txId, roundTimeout);
    console.log('Locked ALGO', txId);
  }
  catch (e) {
    console.log('error', e);
    throw 'e';
  }
};

// unlock ALGO
const unlockAlgo = async (duration, A, B, creator) => {
  const suggestedParams = await client.getTransactionParams().do();
  const roundTimeout = 5;
  const appArg0 = new TextEncoder().encode("UNLOCK");
  const appArg1 = algosdk.encodeUint64(duration);
  const appArgs = [appArg0, appArg1];
  const txAppCall = algosdk.makeApplicationNoOpTxnFromObject({
    from: creator.addr,
    appIndex: SYSTEM_ID,
    appArgs,
    accounts: [A.addr, B.addr],
    suggestedParams,
  });
  const txAppCallSigned = txAppCall.signTxn(creator.sk);
  try {
    const { txId } = await client.sendRawTransaction(txAppCallSigned).do();
    await waitForConfirmation(client, txId, roundTimeout);
    console.log('Unlocked ALGO', txId);
  }
  catch (e) {
    console.log('error', e);
    throw 'e';
  }
};

// 996999 +1 -> 3000
// 992000 +5000 -> 3000
// tried to spend 1056000

// lock ASA
const lockASA = async (speed, energy, assetIndex, lockASATotalFee, A, B, creator) => {

  const suggestedParams = await client.getTransactionParams().do();
  const roundTimeout = 5;

  const txSendAlgoToSystem = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: A.addr,
    to: SYSTEM_ACCOUNT,
    amount: lockASATotalFee,
    suggestedParams,
  });

  const appArg0 = new TextEncoder().encode("LOCK");
  const appArg1 = algosdk.encodeUint64(speed);
  const appArgs = [appArg0, appArg1];
  const suggestedParamsAppCall = JSON.parse(JSON.stringify(suggestedParams));
  suggestedParamsAppCall.fee = 3 * MIN_TXN_FEE;
  suggestedParamsAppCall.flatFee = true;
  const txAppCall = algosdk.makeApplicationNoOpTxnFromObject({
    from: A.addr,
    appIndex: SYSTEM_ID,
    appArgs,
    accounts: [B.addr, SYSTEM_ACCOUNT, creator.addr],
    foreignAssets: [assetIndex],
    suggestedParams: suggestedParamsAppCall,
  });

  const txSendASAToSystem = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: A.addr,
    to: SYSTEM_ACCOUNT,
    amount: energy,
    assetIndex,
    suggestedParams,
  });

  const txns = [txSendAlgoToSystem, txAppCall, txSendASAToSystem];
  algosdk.assignGroupID(txns);
  const txnsSigned = txns.map((tx) => { return tx.signTxn(A.sk) });

  try {
    const { txId } = await client.sendRawTransaction(txnsSigned).do();
    await waitForConfirmation(client, txId, roundTimeout);
    console.log('Locked ASA', txId);
  }
  catch (e) {
    console.log('error', e);
    throw 'e';
  }
};

// unlock ASA
const unlockASA = async (duration, assetIndex, A, B, creator) => {
  const suggestedParams = await client.getTransactionParams().do();
  const roundTimeout = 5;
  const appArg0 = new TextEncoder().encode("UNLOCK");
  const appArg1 = algosdk.encodeUint64(duration);
  const appArgs = [appArg0, appArg1];
  const txAppCall = algosdk.makeApplicationNoOpTxnFromObject({
    from: creator.addr,
    appIndex: SYSTEM_ID,
    appArgs,
    accounts: [A.addr, B.addr],
    foreignAssets: [assetIndex],
    suggestedParams,
  });
  const txAppCallSigned = txAppCall.signTxn(creator.sk);
  try {
    const { txId } = await client.sendRawTransaction(txAppCallSigned).do();
    await waitForConfirmation(client, txId, roundTimeout);
    console.log('Unlocked ASA', txId);
  }
  catch (e) {
    console.log('error', e);
    throw 'e';
  }
};

/**
 * utility function to wait on a transaction to be confirmed
 * the timeout parameter indicates how many rounds do you wish to check pending transactions for
 */
async function waitForConfirmation(algodclient, txId, timeout) {
  // Wait until the transaction is confirmed or rejected, or until 'timeout'
  // number of rounds have passed.
  //     Args:
  // txId(str): the transaction to wait for
  // timeout(int): maximum number of rounds to wait
  // Returns:
  // pending transaction information, or throws an error if the transaction
  // is not confirmed or rejected in the next timeout rounds
  if (algodclient == null || txId == null || timeout < 0) {
    throw new Error('Bad arguments.');
  }
  const status = await algodclient.status().do();
  if (typeof status === 'undefined')
    throw new Error('Unable to get node status');
  const startround = status['last-round'] + 1;
  let currentround = startround;

  /* eslint-disable no-await-in-loop */
  while (currentround < startround + timeout) {
    const pendingInfo = await algodclient
      .pendingTransactionInformation(txId)
      .do();
    if (pendingInfo !== undefined) {
      if (
        pendingInfo['confirmed-round'] !== null &&
        pendingInfo['confirmed-round'] > 0
      ) {
        // Got the completed Transaction
        return pendingInfo;
      }

      if (
        pendingInfo['pool-error'] != null &&
        pendingInfo['pool-error'].length > 0
      ) {
        // If there was a pool error, then the transaction has been rejected!
        throw new Error(
          `Transaction Rejected pool error${pendingInfo['pool-error']}`
        );
      }
    }
    await algodclient.statusAfterBlock(currentround).do();
    currentround += 1;
  }
  /* eslint-enable no-await-in-loop */
  throw new Error(`Transaction not confirmed after ${timeout} rounds!`);
}
const getAssetHolding = async (algodclient, account, assetid) => {
  // note: if you have an indexer instance available it is easier to just use this
  //     let accountInfo = await indexerClient.searchAccounts()
  //    .assetID(assetIndex).do();
  // and in the loop below use this to extract the asset for a particular account
  // accountInfo['accounts'][idx][account]);
  const accountInfo = await algodclient.accountInformation(account).do();
  // console.log(accountInfo);

  if (assetid === 0) return accountInfo['amount'];

  for (idx = 0; idx < accountInfo['assets'].length; idx++) {
    const scrutinizedAsset = accountInfo['assets'][idx];
    if (scrutinizedAsset['asset-id'] == assetid) {
      return scrutinizedAsset.amount;
    }
  }

  return 0;
};


// tests
const test1 = async (A, B, creator) => {
  // ALGO, all normal
  const testName = 'test1';

  const speed = 2;
  const energy = 100;
  const duration = 5;

  // const before_A_Algo = await getAssetHolding(client, A.addr, 0)
  const before_B_Algo = await getAssetHolding(client, B.addr, 0)
  const before_SYSTEM_Algo = await getAssetHolding(client, SYSTEM_ACCOUNT, 0)
  const before_CREATOR_Algo = await getAssetHolding(client, creator.addr, 0)

  await lockAlgo(speed, energy, A, B);
  await unlockAlgo(duration, A, B, creator);

  // const after_A_Algo = await getAssetHolding(client, A.addr, 0)
  const after_B_Algo = await getAssetHolding(client, B.addr, 0)
  const after_SYSTEM_Algo = await getAssetHolding(client, SYSTEM_ACCOUNT, 0)
  const after_CREATOR_Algo = await getAssetHolding(client, creator.addr, 0)

  console.log(testName, 'before_SYSTEM_Algo, after_SYSTEM_Algo', before_SYSTEM_Algo, after_SYSTEM_Algo);
  console.log(testName, 'before_CREATOR_Algo, after_CREATOR_Algo', before_CREATOR_Algo, after_CREATOR_Algo);
  console.log(testName, 'before_B_Algo, after_B_Algo', before_B_Algo, after_B_Algo);

  if (after_SYSTEM_Algo - before_SYSTEM_Algo === 0) console.log(testName, 'SYSTEM PASSED');
  else {
    console.log(testName, 'SYSTEM FAILED');
    return false;
  }

  if (after_CREATOR_Algo - before_CREATOR_Algo === 1) console.log(testName, 'CREATOR PASSED');
  else {
    console.log(testName, 'CREATOR FAILED');
    return false;
  }

  if (after_B_Algo - before_B_Algo === 9) console.log(testName, 'B PASSED');
  else {
    console.log(testName, 'B FAILED');
    return false;
  }

  return true;
};
const test2 = async (A, B, creator) => {
  // ALGO, too long duration
  const testName = 'test2';

  const speed = 2;
  const energy = 100;
  const duration = 60;

  // const before_A_Algo = await getAssetHolding(client, A.addr, 0)
  const before_B_Algo = await getAssetHolding(client, B.addr, 0)
  const before_SYSTEM_Algo = await getAssetHolding(client, SYSTEM_ACCOUNT, 0)
  const before_CREATOR_Algo = await getAssetHolding(client, creator.addr, 0)

  await lockAlgo(speed, energy, A, B);
  await unlockAlgo(duration, A, B, creator);

  // const after_A_Algo = await getAssetHolding(client, A.addr, 0)
  const after_B_Algo = await getAssetHolding(client, B.addr, 0)
  const after_SYSTEM_Algo = await getAssetHolding(client, SYSTEM_ACCOUNT, 0)
  const after_CREATOR_Algo = await getAssetHolding(client, creator.addr, 0)

  console.log(testName, 'before_SYSTEM_Algo, after_SYSTEM_Algo', before_SYSTEM_Algo, after_SYSTEM_Algo);
  console.log(testName, 'before_CREATOR_Algo, after_CREATOR_Algo', before_CREATOR_Algo, after_CREATOR_Algo);
  console.log(testName, 'before_B_Algo, after_B_Algo', before_B_Algo, after_B_Algo);

  if (after_SYSTEM_Algo - before_SYSTEM_Algo === MIN_TXN_FEE) console.log(testName, 'SYSTEM PASSED');
  else {
    console.log(testName, 'SYSTEM FAILED');
    return false;
  }

  if (after_CREATOR_Algo - before_CREATOR_Algo === 10) console.log(testName, 'CREATOR PASSED');
  else {
    console.log(testName, 'CREATOR FAILED');
    return false;
  }

  if (after_B_Algo - before_B_Algo === 90) console.log(testName, 'B PASSED');
  else {
    console.log(testName, 'B FAILED');
    return false;
  }

  return true;
};
const test3 = async (A, B, creator) => {
  // ALGO, zero duration
  const testName = 'test3';

  const speed = 2;
  const energy = 100;
  const duration = 0;

  // const before_A_Algo = await getAssetHolding(client, A.addr, 0)
  const before_B_Algo = await getAssetHolding(client, B.addr, 0)
  const before_SYSTEM_Algo = await getAssetHolding(client, SYSTEM_ACCOUNT, 0)
  const before_CREATOR_Algo = await getAssetHolding(client, creator.addr, 0)

  await lockAlgo(speed, energy, A, B);
  await unlockAlgo(duration, A, B, creator);

  // const after_A_Algo = await getAssetHolding(client, A.addr, 0)
  const after_B_Algo = await getAssetHolding(client, B.addr, 0)
  const after_SYSTEM_Algo = await getAssetHolding(client, SYSTEM_ACCOUNT, 0)
  const after_CREATOR_Algo = await getAssetHolding(client, creator.addr, 0)

  console.log(testName, 'before_SYSTEM_Algo, after_SYSTEM_Algo', before_SYSTEM_Algo, after_SYSTEM_Algo);
  console.log(testName, 'before_CREATOR_Algo, after_CREATOR_Algo', before_CREATOR_Algo, after_CREATOR_Algo);
  console.log(testName, 'before_B_Algo, after_B_Algo', before_B_Algo, after_B_Algo);

  if (after_SYSTEM_Algo - before_SYSTEM_Algo === MIN_TXN_FEE) console.log(testName, 'SYSTEM PASSED');
  else {
    console.log(testName, 'SYSTEM FAILED');
    return false;
  }

  if (after_CREATOR_Algo - before_CREATOR_Algo === 0) console.log(testName, 'CREATOR PASSED');
  else {
    console.log(testName, 'CREATOR FAILED');
    return false;
  }

  if (after_B_Algo - before_B_Algo === 0) console.log(testName, 'B PASSED');
  else {
    console.log(testName, 'B FAILED');
    return false;
  }

  return true;
};
const test4 = async (A, B, creator) => {
  // ASA, B not opted-in, normal amount
  const testName = 'test4';

  const speed = 2;
  const energy = 100;
  const duration = 5;
  const lockASATotalFee = LOCK_ASA_FEE;

  // existing asset
  const assetIndex = 430512768;

  // opt-in A
  await optInASA(assetIndex, A);
  await sendASA(assetIndex, creator, A, 1000);

  const before_B_Algo = await getAssetHolding(client, B.addr, 0);
  const before_SYSTEM_Algo = await getAssetHolding(client, SYSTEM_ACCOUNT, 0);
  const before_CREATOR_Algo = await getAssetHolding(client, creator.addr, 0);
  const before_B_ASA = await getAssetHolding(client, B.addr, assetIndex);
  const before_SYSTEM_ASA = await getAssetHolding(client, SYSTEM_ACCOUNT, assetIndex);
  const before_CREATOR_ASA = await getAssetHolding(client, creator.addr, assetIndex);

  await lockASA(speed, energy, assetIndex, lockASATotalFee, A, B, creator);
  await unlockASA(duration, assetIndex, A, B, creator);

  const after_B_Algo = await getAssetHolding(client, B.addr, 0);
  const after_SYSTEM_Algo = await getAssetHolding(client, SYSTEM_ACCOUNT, 0);
  const after_CREATOR_Algo = await getAssetHolding(client, creator.addr, 0);
  const after_B_ASA = await getAssetHolding(client, B.addr, assetIndex);
  const after_SYSTEM_ASA = await getAssetHolding(client, SYSTEM_ACCOUNT, assetIndex);
  const after_CREATOR_ASA = await getAssetHolding(client, creator.addr, assetIndex);

  console.log(testName, 'before_SYSTEM_Algo, after_SYSTEM_Algo', before_SYSTEM_Algo, after_SYSTEM_Algo);
  console.log(testName, 'before_SYSTEM_ASA, after_SYSTEM_ASA', before_SYSTEM_ASA, after_SYSTEM_ASA);
  console.log(testName, 'before_CREATOR_Algo, after_CREATOR_Algo', before_CREATOR_Algo, after_CREATOR_Algo);
  console.log(testName, 'before_CREATOR_ASA, after_CREATOR_ASA', before_CREATOR_ASA, after_CREATOR_ASA);
  console.log(testName, 'before_B_Algo, after_B_Algo', before_B_Algo, after_B_Algo);
  console.log(testName, 'before_B_ASA, after_B_ASA', before_B_ASA, after_B_ASA);

  if (after_SYSTEM_Algo - before_SYSTEM_Algo === MIN_TXN_FEE) console.log(testName, 'SYSTEM ALGO PASSED');
  else {
    console.log(testName, 'SYSTEM ALGO FAILED');
    return false;
  }
  if (after_SYSTEM_ASA - before_SYSTEM_ASA === 9) console.log(testName, 'SYSTEM ASA PASSED');
  else {
    console.log(testName, 'SYSTEM ASA FAILED');
    return false;
  }

  if (after_CREATOR_Algo - before_CREATOR_Algo === 0) console.log(testName, 'CREATOR ALGO PASSED');
  else {
    console.log(testName, 'CREATOR ALGO FAILED');
    return false;
  }
  if (after_CREATOR_ASA - before_CREATOR_ASA === 1) console.log(testName, 'CREATOR ASA PASSED');
  else {
    console.log(testName, 'CREATOR ASA FAILED');
    return false;
  }

  if (after_B_Algo - before_B_Algo === 0) console.log(testName, 'B ALGO PASSED');
  else {
    console.log(testName, 'B ALGO FAILED');
    return false;
  }
  if (after_B_ASA - before_B_ASA === 0) console.log(testName, 'B ASA PASSED');
  else {
    console.log(testName, 'B ASA FAILED');
    return false;
  }

  return true;
};
const test5 = async (A, B, creator) => {
  // ASA, all opted-in, normal amount
  const testName = 'test5';

  const speed = 2;
  const energy = 100;
  const duration = 5;
  const lockASATotalFee = LOCK_ASA_FEE;

  // existing asset
  const assetIndex = 430512768;

  // opt-in A and B - A already opted-in from prev test
  // const f1 = optInASA(assetIndex, A);
  await optInASA(assetIndex, B);
  // await Promise.all([f1, f2]);
  // await sendASA(assetIndex, creator, A, 1000);

  const before_B_Algo = await getAssetHolding(client, B.addr, 0);
  const before_SYSTEM_Algo = await getAssetHolding(client, SYSTEM_ACCOUNT, 0);
  const before_CREATOR_Algo = await getAssetHolding(client, creator.addr, 0);
  const before_B_ASA = await getAssetHolding(client, B.addr, assetIndex);
  const before_SYSTEM_ASA = await getAssetHolding(client, SYSTEM_ACCOUNT, assetIndex);
  const before_CREATOR_ASA = await getAssetHolding(client, creator.addr, assetIndex);

  await lockASA(speed, energy, assetIndex, lockASATotalFee, A, B, creator);
  await unlockASA(duration, assetIndex, A, B, creator);

  const after_B_Algo = await getAssetHolding(client, B.addr, 0);
  const after_SYSTEM_Algo = await getAssetHolding(client, SYSTEM_ACCOUNT, 0);
  const after_CREATOR_Algo = await getAssetHolding(client, creator.addr, 0);
  const after_B_ASA = await getAssetHolding(client, B.addr, assetIndex);
  const after_SYSTEM_ASA = await getAssetHolding(client, SYSTEM_ACCOUNT, assetIndex);
  const after_CREATOR_ASA = await getAssetHolding(client, creator.addr, assetIndex);

  console.log(testName, 'before_SYSTEM_Algo, after_SYSTEM_Algo', before_SYSTEM_Algo, after_SYSTEM_Algo);
  console.log(testName, 'before_SYSTEM_ASA, after_SYSTEM_ASA', before_SYSTEM_ASA, after_SYSTEM_ASA);
  console.log(testName, 'before_CREATOR_Algo, after_CREATOR_Algo', before_CREATOR_Algo, after_CREATOR_Algo);
  console.log(testName, 'before_CREATOR_ASA, after_CREATOR_ASA', before_CREATOR_ASA, after_CREATOR_ASA);
  console.log(testName, 'before_B_Algo, after_B_Algo', before_B_Algo, after_B_Algo);
  console.log(testName, 'before_B_ASA, after_B_ASA', before_B_ASA, after_B_ASA);

  if (after_SYSTEM_Algo - before_SYSTEM_Algo === 0) console.log(testName, 'SYSTEM ALGO PASSED');
  else {
    console.log(testName, 'SYSTEM ALGO FAILED');
    return false;
  }
  if (after_SYSTEM_ASA - before_SYSTEM_ASA === 0) console.log(testName, 'SYSTEM ASA PASSED');
  else {
    console.log(testName, 'SYSTEM ASA FAILED');
    return false;
  }

  if (after_CREATOR_Algo - before_CREATOR_Algo === 0) console.log(testName, 'CREATOR ALGO PASSED');
  else {
    console.log(testName, 'CREATOR ALGO FAILED');
    return false;
  }
  if (after_CREATOR_ASA - before_CREATOR_ASA === 1) console.log(testName, 'CREATOR ASA PASSED');
  else {
    console.log(testName, 'CREATOR ASA FAILED');
    return false;
  }

  if (after_B_Algo - before_B_Algo === 0) console.log(testName, 'B ALGO PASSED');
  else {
    console.log(testName, 'B ALGO FAILED');
    return false;
  }
  if (after_B_ASA - before_B_ASA === 9) console.log(testName, 'B ASA PASSED');
  else {
    console.log(testName, 'B ASA FAILED');
    return false;
  }

  return true;
};
const test6 = async (A, B, creator) => {
  // ASA, all opted-in, too much amount
  const testName = 'test6';

  const speed = 2;
  const energy = 100;
  const duration = 60;
  const lockASATotalFee = LOCK_ASA_FEE;

  // existing asset
  const assetIndex = 430512768;

  // opt-in A and B - already opted-in from prev tests
  // const f1 = optInASA(assetIndex, A);
  // const f2 = optInASA(assetIndex, B);
  // await Promise.all([f1, f2]);
  // await sendASA(assetIndex, creator, A, 1000);

  const before_B_Algo = await getAssetHolding(client, B.addr, 0);
  const before_SYSTEM_Algo = await getAssetHolding(client, SYSTEM_ACCOUNT, 0);
  const before_CREATOR_Algo = await getAssetHolding(client, creator.addr, 0);
  const before_B_ASA = await getAssetHolding(client, B.addr, assetIndex);
  const before_SYSTEM_ASA = await getAssetHolding(client, SYSTEM_ACCOUNT, assetIndex);
  const before_CREATOR_ASA = await getAssetHolding(client, creator.addr, assetIndex);

  await lockASA(speed, energy, assetIndex, lockASATotalFee, A, B, creator);
  await unlockASA(duration, assetIndex, A, B, creator);

  const after_B_Algo = await getAssetHolding(client, B.addr, 0);
  const after_SYSTEM_Algo = await getAssetHolding(client, SYSTEM_ACCOUNT, 0);
  const after_CREATOR_Algo = await getAssetHolding(client, creator.addr, 0);
  const after_B_ASA = await getAssetHolding(client, B.addr, assetIndex);
  const after_SYSTEM_ASA = await getAssetHolding(client, SYSTEM_ACCOUNT, assetIndex);
  const after_CREATOR_ASA = await getAssetHolding(client, creator.addr, assetIndex);

  console.log(testName, 'before_SYSTEM_Algo, after_SYSTEM_Algo', before_SYSTEM_Algo, after_SYSTEM_Algo);
  console.log(testName, 'before_SYSTEM_ASA, after_SYSTEM_ASA', before_SYSTEM_ASA, after_SYSTEM_ASA);
  console.log(testName, 'before_CREATOR_Algo, after_CREATOR_Algo', before_CREATOR_Algo, after_CREATOR_Algo);
  console.log(testName, 'before_CREATOR_ASA, after_CREATOR_ASA', before_CREATOR_ASA, after_CREATOR_ASA);
  console.log(testName, 'before_B_Algo, after_B_Algo', before_B_Algo, after_B_Algo);
  console.log(testName, 'before_B_ASA, after_B_ASA', before_B_ASA, after_B_ASA);

  if (after_SYSTEM_Algo - before_SYSTEM_Algo === MIN_TXN_FEE) console.log(testName, 'SYSTEM ALGO PASSED');
  else {
    console.log(testName, 'SYSTEM ALGO FAILED');
    return false;
  }
  if (after_SYSTEM_ASA - before_SYSTEM_ASA === 0) console.log(testName, 'SYSTEM ASA PASSED');
  else {
    console.log(testName, 'SYSTEM ASA FAILED');
    return false;
  }

  if (after_CREATOR_Algo - before_CREATOR_Algo === 0) console.log(testName, 'CREATOR ALGO PASSED');
  else {
    console.log(testName, 'CREATOR ALGO FAILED');
    return false;
  }
  if (after_CREATOR_ASA - before_CREATOR_ASA === 10) console.log(testName, 'CREATOR ASA PASSED');
  else {
    console.log(testName, 'CREATOR ASA FAILED');
    return false;
  }

  if (after_B_Algo - before_B_Algo === 0) console.log(testName, 'B ALGO PASSED');
  else {
    console.log(testName, 'B ALGO FAILED');
    return false;
  }
  if (after_B_ASA - before_B_ASA === 90) console.log(testName, 'B ASA PASSED');
  else {
    console.log(testName, 'B ASA FAILED');
    return false;
  }

  return true;
};
const test7 = async (A, B, creator) => {
  // ASA, SYSTEM not opted-in, normal amount
  const testName = 'test7';

  const speed = 2;
  const energy = 100;
  const duration = 5;
  const lockASATotalFee = OPT_IN_ASA_FEE;
  
  // create new asset
  const assetIndex = await createAsset(creator);

  // opt-in A and B
  const f1 = optInASA(assetIndex, A);
  const f2 = optInASA(assetIndex, B);
  await Promise.all([f1, f2]);
  const f3 = sendASA(assetIndex, creator, A, 1000);
  const f4 = sendASA(assetIndex, creator, B, 1000);
  await Promise.all([f3, f4]);

  const before_B_Algo = await getAssetHolding(client, B.addr, 0);
  const before_SYSTEM_Algo = await getAssetHolding(client, SYSTEM_ACCOUNT, 0);
  const before_CREATOR_Algo = await getAssetHolding(client, creator.addr, 0);
  const before_B_ASA = await getAssetHolding(client, B.addr, assetIndex);
  const before_SYSTEM_ASA = await getAssetHolding(client, SYSTEM_ACCOUNT, assetIndex);
  const before_CREATOR_ASA = await getAssetHolding(client, creator.addr, assetIndex);

  await lockASA(speed, energy, assetIndex, lockASATotalFee, A, B, creator);
  await unlockASA(duration, assetIndex, A, B, creator);

  const after_B_Algo = await getAssetHolding(client, B.addr, 0);
  const after_SYSTEM_Algo = await getAssetHolding(client, SYSTEM_ACCOUNT, 0);
  const after_CREATOR_Algo = await getAssetHolding(client, creator.addr, 0);
  const after_B_ASA = await getAssetHolding(client, B.addr, assetIndex);
  const after_SYSTEM_ASA = await getAssetHolding(client, SYSTEM_ACCOUNT, assetIndex);
  const after_CREATOR_ASA = await getAssetHolding(client, creator.addr, assetIndex);

  console.log(testName, 'before_SYSTEM_Algo, after_SYSTEM_Algo', before_SYSTEM_Algo, after_SYSTEM_Algo);
  console.log(testName, 'before_SYSTEM_ASA, after_SYSTEM_ASA', before_SYSTEM_ASA, after_SYSTEM_ASA);
  console.log(testName, 'before_CREATOR_Algo, after_CREATOR_Algo', before_CREATOR_Algo, after_CREATOR_Algo);
  console.log(testName, 'before_CREATOR_ASA, after_CREATOR_ASA', before_CREATOR_ASA, after_CREATOR_ASA);
  console.log(testName, 'before_B_Algo, after_B_Algo', before_B_Algo, after_B_Algo);
  console.log(testName, 'before_B_ASA, after_B_ASA', before_B_ASA, after_B_ASA);

  if (after_SYSTEM_Algo - before_SYSTEM_Algo === MIN_ASA_BALANCE) console.log(testName, 'SYSTEM ALGO PASSED');
  else {
    console.log(testName, 'SYSTEM ALGO FAILED');
    return false;
  }
  if (after_SYSTEM_ASA - before_SYSTEM_ASA === 0) console.log(testName, 'SYSTEM ASA PASSED');
  else {
    console.log(testName, 'SYSTEM ASA FAILED');
    return false;
  }

  if (after_CREATOR_Algo - before_CREATOR_Algo === MIN_ASA_BALANCE + MIN_TXN_FEE) console.log(testName, 'CREATOR ALGO PASSED');
  else {
    console.log(testName, 'CREATOR ALGO FAILED');
    return false;
  }
  if (after_CREATOR_ASA - before_CREATOR_ASA === 1) console.log(testName, 'CREATOR ASA PASSED');
  else {
    console.log(testName, 'CREATOR ASA FAILED');
    return false;
  }

  if (after_B_Algo - before_B_Algo === 0) console.log(testName, 'B ALGO PASSED');
  else {
    console.log(testName, 'B ALGO FAILED');
    return false;
  }
  if (after_B_ASA - before_B_ASA === 9) console.log(testName, 'B ASA PASSED');
  else {
    console.log(testName, 'B ASA FAILED');
    return false;
  }

  return true;
};
const test8 = async (A, B, creator) => {
  // ASA, SYSTEM and B not opted-in, normal amount
  const testName = 'test8';

  const speed = 2;
  const energy = 100;
  const duration = 5;
  const lockASATotalFee = OPT_IN_ASA_FEE;
  
  // create new asset - did manually now
  const assetIndex = await createAsset(creator);

  // opt-in A and B
  await optInASA(assetIndex, A);
  await sendASA(assetIndex, creator, A, 1000);

  const before_B_Algo = await getAssetHolding(client, B.addr, 0);
  const before_SYSTEM_Algo = await getAssetHolding(client, SYSTEM_ACCOUNT, 0);
  const before_CREATOR_Algo = await getAssetHolding(client, creator.addr, 0);
  const before_B_ASA = await getAssetHolding(client, B.addr, assetIndex);
  const before_SYSTEM_ASA = await getAssetHolding(client, SYSTEM_ACCOUNT, assetIndex);
  const before_CREATOR_ASA = await getAssetHolding(client, creator.addr, assetIndex);

  await lockASA(speed, energy, assetIndex, lockASATotalFee, A, B, creator);
  await unlockASA(duration, assetIndex, A, B, creator);

  const after_B_Algo = await getAssetHolding(client, B.addr, 0);
  const after_SYSTEM_Algo = await getAssetHolding(client, SYSTEM_ACCOUNT, 0);
  const after_CREATOR_Algo = await getAssetHolding(client, creator.addr, 0);
  const after_B_ASA = await getAssetHolding(client, B.addr, assetIndex);
  const after_SYSTEM_ASA = await getAssetHolding(client, SYSTEM_ACCOUNT, assetIndex);
  const after_CREATOR_ASA = await getAssetHolding(client, creator.addr, assetIndex);

  console.log(testName, 'before_SYSTEM_Algo, after_SYSTEM_Algo', before_SYSTEM_Algo, after_SYSTEM_Algo);
  console.log(testName, 'before_SYSTEM_ASA, after_SYSTEM_ASA', before_SYSTEM_ASA, after_SYSTEM_ASA);
  console.log(testName, 'before_CREATOR_Algo, after_CREATOR_Algo', before_CREATOR_Algo, after_CREATOR_Algo);
  console.log(testName, 'before_CREATOR_ASA, after_CREATOR_ASA', before_CREATOR_ASA, after_CREATOR_ASA);
  console.log(testName, 'before_B_Algo, after_B_Algo', before_B_Algo, after_B_Algo);
  console.log(testName, 'before_B_ASA, after_B_ASA', before_B_ASA, after_B_ASA);

  if (after_SYSTEM_Algo - before_SYSTEM_Algo === MIN_ASA_BALANCE + MIN_TXN_FEE) console.log(testName, 'SYSTEM ALGO PASSED');
  else {
    console.log(testName, 'SYSTEM ALGO FAILED');
    return false;
  }
  if (after_SYSTEM_ASA - before_SYSTEM_ASA === 9) console.log(testName, 'SYSTEM ASA PASSED');
  else {
    console.log(testName, 'SYSTEM ASA FAILED');
    return false;
  }

  if (after_CREATOR_Algo - before_CREATOR_Algo === MIN_ASA_BALANCE + MIN_TXN_FEE) console.log(testName, 'CREATOR ALGO PASSED');
  else {
    console.log(testName, 'CREATOR ALGO FAILED');
    return false;
  }
  if (after_CREATOR_ASA - before_CREATOR_ASA === 1) console.log(testName, 'CREATOR ASA PASSED');
  else {
    console.log(testName, 'CREATOR ASA FAILED');
    return false;
  }

  if (after_B_Algo - before_B_Algo === 0) console.log(testName, 'B ALGO PASSED');
  else {
    console.log(testName, 'B ALGO FAILED');
    return false;
  }
  if (after_B_ASA - before_B_ASA === 0) console.log(testName, 'B ASA PASSED');
  else {
    console.log(testName, 'B ASA FAILED');
    return false;
  }

  return true;
};

const run = async () => {

  const { A, B, creator } = await init();
  if (!await test1(A, B, creator)) return;
  if (!await test2(A, B, creator)) return;
  if (!await test3(A, B, creator)) return;
  if (!await test4(A, B, creator)) return;
  if (!await test5(A, B, creator)) return;
  if (!await test6(A, B, creator)) return;
  if (!await test7(A, B, creator)) return;
  if (!await test8(A, B, creator)) return;

};
run();