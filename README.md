# 2i2i algorand

Facilitate energy transfer from A to B via Algorand.

In the first step, a stateless SC to lock funds and a stateful SC to set state.

In the second step, a stateless SC to unlock funds depending on state check using a stateful SC.

Energy transfer can be in ALGO/sec or any COIN/sec, where COIN is any ASA (Algorand Standard Asset).


Terminology
===========
A: User A that creates a bid to talk to B. User A will initiate the call. User A will have their coins locked during the call. And the correct amount of their coins will be sent to B once the call is finished.
B: User B sees and accepts bids from A (or not). B will receive coins from A.
Energy: Coins are a form of energy and essentially we can say that A will transfer energy (or coins) to B.
Info: Information in the form of a live video call is what B provides to A in exchange for getting energy.
Speed: The speeed of the energy transfer from A to B. A1 might bid 3 ALGO/sec, A2 might bid 10 ALGO/sec to talk to B. B would probably choose the highest bid (but can choose any bid).


In Detail:
==========

In the 2i2i app, user A bids to have a video call with user B.
E.g. user A bids to pay 3 ALGO/sec to talk with user B.

User B accepts the bid, which starts the Algorand process.

On the device of user A, there is an Algorand account, created by the 2i2i app.
When user B accepts the bid, user As device starts the following transactions on Algorand:

Lock transaction
================
Send an atomic (group) transaction with 2 transactions:
1. Send all ALGOs from the account to be locked in the Escrow (stateless contract).
2. Run the stateful contract to check and set local state for user As Algorand account.

2. checks whether that A does not already have state set (not already in a call).
2. sets various states on A, such as the bid speed, total coins locked, address of B.

Unlock transaction
================
Once the call ends, the server (which is the smart contract creator) initiates the unlock transaction.
Calculate how many coins are due to B (speed * duration = energy).
Send that many coins from Escrow (stateless contract) to B, minus 10%.
Send 10% of what B would have gotten to the 2i2i fee account.
Send the leftover coins back to A.

The unlock transaction also checks that the states were set correctly before unlocking.
After that the transaction unsets the state (cleaning).


No loss system
==============
The system is designed to cause no loss to the system. All fees that the smart contracts will incur to unlock need to be prepaid by A.
If A is bidding in ALGO, A needs to send an extra 4*MIN_TXT_FEE (currently 0.004 ALGO) to the system.
If A is bidding in any other COIN (ASA), A needs to send an extra 5*MIN_TXT_FEE (currently 0.005 ALGO) to the system.
This results in a net 0 cost to the system.

