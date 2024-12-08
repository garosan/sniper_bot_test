const fs = require("fs");
const { WebSocketProvider, Contract } = require("ethers");
require("dotenv").config();
const blockchain = require("./blockchain.json");
const { runInContext } = require("vm");

const provider = new WebSocketProvider(process.env.LOCAL_RPC_URL_WS);
const wallet = Wallet.fromPhrase(process.env.FOUNDRY_MNEMONIC, provider);
const factory = new Contract(
  blockchain.factoryAddress,
  blockchain.factoryAbi,
  provider
);

const SNIPE_LIST_FILE = "snipeList.csv";

const init = () => {
  // Setup an event listener for new liquidity pool
  factory.on("PairCreated", (token0, token1, pairAddress) => {
    console.log(
      `New pair detected
      ==================
      pairAddress: ${pairAddress}
      token0: ${token0}
      token1: ${token1}`
    );
    // Save pool info into a file
    if (token0 !== blockchain.WETHAddress && token1 !== blockchain.WETHAddress)
      return;
    const t0 = token0 === blockchain.WETHAddress ? token0 : token1;
    const t1 = token0 === blockchain.WETHAddress ? token1 : token0;
    fs.appendFileSync(SNIPE_LIST_FILE, `${pairAddress}, ${t0}, ${t1}\n`);
  });
};

const snipe = async () => {
  console.log("Snipe loop");
  let snipeList = fs.readFileSync(SNIPE_LIST_FILE);
  snipeList = snipeList
    .toString()
    .split("\n")
    .filter((snipe) => snipe !== "");
  if (snipeList.length === 0) return;
  for (const snipe of snipeList) {
    const [pairAddress, wethAddress, tokenAddress] = snipe.split(",");
    console.log(`Trying to snipe ${tokenAddress} on ${pairAddress}`);

    const pair = new Contract(pairAddress, blockchain.pairAbi, wallet);

    const totalSupply = await pair.totalSupply();
    if (totalSupply === 0n) {
      console.log("Pool is empty, snipe cancelled");
      continue;
    }
    // There is some liquidity, go on with sniping
    const tokenIn = wethAddress;
    const tokenOut = tokenAddress;

    // For this example, we buy 0.1 ETH of new token
    const amountIn = parseEther("0.1");
    const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
    // Let's define our price tolerance
    const amountOutMin = amounts[1] - (amount[1] * 5n) / 100n;
    console.log(`
      Buying new token
      ================
      tokenIn: ${amountIn.toString()} ${tokenIn} (WETH)
      tokenOut: ${amountOutMin.toString()} ${tokenOut}
      `);
    const tx = await router.swapExactTokensForTokens(
      amountIn,
      amountOutMin,
      [tokenIn, tokenOut],
      blockchain.recipient,
      Date.now() + 1000 * +60 * 10
    );

    const receipt = await tx.wait();
    console.log("Transaction receipt: ", receipt);
  }
};

const timeout = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const main = async () => {
  console.log("Trading bot starting...");
  init();
  while (true) {
    console.log("Hearbeat");
    await snipe();
    await timeout(3000);
  }
};

main();
