
const uint8ArrayListFromStringList = (stringList) => {
  const uint8ArrayList = [];
  const textEndocer = new TextEncoder();
  for (s of stringList) {
    const uint8Array = textEndocer.encode(s);
    uint8ArrayList.push(uint8Array);
  }
  return uint8ArrayList;
}

const main_now_working = () => {
  // accounts
  const ownerMnemonic = "...";
  const accountOwner = algosdk.mnemonicToSecretKey(ownerMnemonic);
  const addressFee = "...";
  const A_addr = "...";
  const B_addr = "...";
  const appIndex = 123;
  const duration = 5;
  const escrowTEAL = "...";

  const suggestedParams = await algodclient.getTransactionParams().do();

  // state
  const stateTxn = algosdk.makeApplicationNoOpTxnFromObject({
    from: accountOwner.addr,
    appIndex,
    appArgs: uint8ArrayListFromStringList(["str:UNLOCK", `int:${duration}`]),
    accounts: [A_addr, B_addr],
    suggestedParams,
  });
  console.log('stateTxn', stateTxn);

  // logic sig
  const compiledProgram = await algodclient.compile(escrowTEAL).do();
  const programBytes = new Uint8Array(
    Buffer.from(compiledProgram.result, "base64"),
  );
  const logicSigAccount = new algosdk.LogicSigAccount(programBytes);
  const logicSigAddr = logicSigAccount.address();

  // payment txns
  const ATxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: logicSigAddr,
    to: A_addr,
    amount: 1000,
    suggestedParams,
  });
  const feeTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: logicSigAddr,
    to: addressFee,
    amount: 1000,
    suggestedParams,
  });
  const BTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: logicSigAddr,
    to: B_addr,
    amount: 1000,
    suggestedParams,
  });

  // group
  algosdk.assignGroupID([stateTxn, ATxn, feeTxn, BTxn]);

  // sign
  const stateTxnSigned = stateTxn.signTxn(accountOwner.sk);
  const ATxnSigned = algosdk.signLogicSigTransactionObject(
    ATxn,
    logicSigAccount,
  );
  const feeTxnSigned = algosdk.signLogicSigTransactionObject(
    feeTxn,
    logicSigAccount,
  );
  const BTxnSigned = algosdk.signLogicSigTransactionObject(
    BTxn,
    logicSigAccount,
  );

  // send - gives ERROR: TypeError: Array elements must be byte arrays\n    at new SendRawTransaction
  const { txId } = await algodclient.sendRawTransaction([
    stateTxnSigned,
    ATxnSigned.blob,
    feeTxnSigned.blob,
    BTxnSigned.blob,
  ]).do();
}
