# 2i2i algorand

Facilitate energy transfer from A to B via Algorand.

In the first step, lock coins and set state using the Smart Contract. This step is initiated by A.

In the second step, the Smart Contract unlocks the coins und unsets the state, sends B what they earned, a fee to the Creator and the rest back to A. This step is initiated by the Creator/server.

Energy transfer can be in any COIN/sec, where COIN is any ASA (Algorand Standard Asset).


Terminology
===========
A: User A that creates a bid to talk to B. User A will initiate the video call. User A will have their coins locked during the call. And the correct amount of their coins will be sent to B once the video call is finished.
B: User B sees and accepts bids from A (or not). B will receive coins from A.
Energy: Coins are a form of energy and essentially we can say that A will transfer energy (or coins) to B.
Info: Information in the form of a live video call is what B provides to A in exchange for getting energy.
Speed: The speeed of the energy transfer from A to B. A1 might bid 3 ALGO/sec, A2 might bid 10 ALGO/sec to talk to B. B would probably choose the highest bid (but can choose any bid).


Diagram
=======
https://imgur.com/a/RijwrX9


In Detail:
==========

In the 2i2i app, user A bids to have a live video call with user B.
E.g. user A bids to pay 3 ALGO/sec to talk with user B.

User B accepts the bid, which starts the Algorand process.

On the device of user A, there is an Algorand account, created by the 2i2i app.
When user B accepts the bid, user As device starts the following transactions on Algorand:

Lock transaction
================
Send an atomic (group) transaction with 2 transactions:
1. Send all ALGOs from the account to be locked in the Smart Contract.
2. Run the Smart Contract to check and set local state for user As' Algorand account.

2. checks whether that A does not already have state set (not already in a call).
2. sets various states on A, such as the bid speed, total coins locked, address of B.

Unlock transaction
================
Once the call ends, the server (which is the Smart Contract Creator) initiates the unlock transaction.
Calculate how many coins are due to B (speed * duration = energy).
Send that many coins from the Smart Contract to B, minus 10%.
Send 10% of what B would have gotten to the Creator account.
Send the leftover coins back to A.

The unlock transaction also checks that the states were set correctly before unlocking.
After that the transaction unsets the state (cleaning).


No loss system
==============
The system is designed such that no loss can be caused to the system. All fees that the Smart Contract will incur to unlock need to be prepaid by A.
If A is bidding in ALGO, A needs to send an extra 4 * MIN_TXT_FEE (currently 0.004 ALGO) to the system.
If A is bidding in any other COIN (ASA), A needs to send an extra 5*MIN_TXT_FEE (currently 0.005 ALGO) to the system.
This results in a net 0 cost to the system.

Auto opt-in to any ASA
======================
Although any ASA can be used, the Smart Contract and Creator accounts might not be opted-into the ASA in question.
Any user can start an opt-in process to any ASA of their choosing.
The Smart Contract will use inner transactions to opt itself into the ASA. The Creator account will be opted-in from the server.
The user needs to prepay the opt-in fees and min balance increases of the Smart Contract and Creator.

Hence, to opt-in the system to a new ASA, the users need to pay: 2 * MIN_ASA_BALANCE + 2 * MIN_TXN_FEE, currently 0.202 ALGO.

Thus, this scheme allows the system to be opted-into any ASA without incurring loss due to e.g. spamming.
Some user has to care enough about this ASA to spend 0.202 ALGO for the system to add it.

Any user A can then bid any ASA. If user B is not opted-into this ASA, the coins will remain in the Smart Contract for user B to pick as soon as user B opts-into this ASA. If the coins have any value, user B will do that. This pick-up is currently manual.
