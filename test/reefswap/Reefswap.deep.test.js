const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

const INITIAL_SUPPLY = ethers.parseEther("1000000");

function sqrt(value) {
  if (value < 2n) {
    return value;
  }

  let z = value;
  let x = (value / 2n) + 1n;
  while (x < z) {
    z = x;
    x = ((value / x) + x) / 2n;
  }
  return z;
}

function getAmountOut(amountIn, reserveIn, reserveOut) {
  const amountInWithFee = amountIn * 997n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = (reserveIn * 1000n) + amountInWithFee;
  return numerator / denominator;
}

function sortAddresses(a, b) {
  return BigInt(a) < BigInt(b) ? [a, b] : [b, a];
}

async function deadlineAfter(seconds = 3600) {
  const block = await ethers.provider.getBlock("latest");
  return BigInt(block.timestamp + seconds);
}

async function deployCore() {
  const [owner, alice, bob, feeTo] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("ReefswapV2Factory");
  const Wrapped = await ethers.getContractFactory("WrappedREEF");
  const Router = await ethers.getContractFactory("ReefswapV2Router02");

  const factory = await Factory.deploy(owner.address);
  const wrapped = await Wrapped.deploy();
  const router = await Router.deploy(await factory.getAddress(), await wrapped.getAddress());

  const Token = await ethers.getContractFactory("Token");
  const LotrToken = await ethers.getContractFactory("LotrToken");
  const SwToken = await ethers.getContractFactory("SwToken");

  const tokenA = await Token.deploy(INITIAL_SUPPLY);
  const tokenB = await LotrToken.deploy(INITIAL_SUPPLY);
  const tokenC = await SwToken.deploy(INITIAL_SUPPLY);

  await tokenA.transfer(alice.address, ethers.parseEther("50000"));
  await tokenB.transfer(alice.address, ethers.parseEther("50000"));
  await tokenC.transfer(alice.address, ethers.parseEther("50000"));

  const approvals = [
    tokenA.approve(await router.getAddress(), ethers.MaxUint256),
    tokenB.approve(await router.getAddress(), ethers.MaxUint256),
    tokenC.approve(await router.getAddress(), ethers.MaxUint256),
    tokenA.connect(alice).approve(await router.getAddress(), ethers.MaxUint256),
    tokenB.connect(alice).approve(await router.getAddress(), ethers.MaxUint256),
    tokenC.connect(alice).approve(await router.getAddress(), ethers.MaxUint256),
  ];

  await Promise.all(approvals);

  return {
    owner,
    alice,
    bob,
    feeTo,
    factory,
    wrapped,
    router,
    tokenA,
    tokenB,
    tokenC,
  };
}

async function getPair(factory, tokenA, tokenB) {
  const pairAddress = await factory.getPair(await tokenA.getAddress(), await tokenB.getAddress());
  return ethers.getContractAt("ReefswapV2Pair", pairAddress);
}

async function reservesFor(pair, tokenAAddress) {
  const [reserve0, reserve1] = await pair.getReserves();
  const token0 = await pair.token0();
  if (token0.toLowerCase() === tokenAAddress.toLowerCase()) {
    return [reserve0, reserve1];
  }
  return [reserve1, reserve0];
}

async function signPermit(signer, pair, spender, value, permitDeadline) {
  const nonce = await pair.nonces(signer.address);
  const chainId = (await ethers.provider.getNetwork()).chainId;

  const domain = {
    name: await pair.name(),
    version: "1",
    chainId,
    verifyingContract: await pair.getAddress(),
  };

  const types = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };

  const message = {
    owner: signer.address,
    spender,
    value,
    nonce,
    deadline: permitDeadline,
  };

  const signature = await signer.signTypedData(domain, types, message);
  return ethers.Signature.from(signature);
}

describe("Reefswap contracts", function () {
  describe("ReefswapV2Factory", function () {
    it("creates pair deterministically and populates bidirectional mappings", async function () {
      const { owner, factory, tokenA, tokenB } = await deployCore();
      const tokenAAddress = await tokenA.getAddress();
      const tokenBAddress = await tokenB.getAddress();
      const [token0, token1] = sortAddresses(tokenAAddress, tokenBAddress);

      await expect(factory.createPair(tokenAAddress, tokenBAddress))
        .to.emit(factory, "PairCreated")
        .withArgs(token0, token1, anyValue, 1);

      const pairAddress = await factory.getPair(tokenAAddress, tokenBAddress);
      const reversePairAddress = await factory.getPair(tokenBAddress, tokenAAddress);
      expect(pairAddress).to.equal(reversePairAddress);

      const Pair = await ethers.getContractFactory("ReefswapV2Pair");
      const initCodeHash = ethers.keccak256(Pair.bytecode);
      const salt = ethers.keccak256(
        ethers.solidityPacked(["address", "address"], [token0, token1])
      );
      const expectedPair = ethers.getCreate2Address(await factory.getAddress(), salt, initCodeHash);
      expect(pairAddress).to.equal(expectedPair);

      expect(await factory.allPairsLength()).to.equal(1);
      expect(await factory.allPairs(0)).to.equal(pairAddress);

      const pair = await ethers.getContractAt("ReefswapV2Pair", pairAddress);
      expect(await pair.factory()).to.equal(await factory.getAddress());
      expect(await pair.token0()).to.equal(token0);
      expect(await pair.token1()).to.equal(token1);

      // no unintended side-effects on ownership state
      expect(await factory.feeToSetter()).to.equal(owner.address);
    });

    it("reverts on invalid pair creation attempts", async function () {
      const { factory, tokenA, tokenB } = await deployCore();

      const tokenAAddress = await tokenA.getAddress();
      const tokenBAddress = await tokenB.getAddress();

      await expect(factory.createPair(tokenAAddress, tokenAAddress)).to.be.revertedWith(
        "ReefswapV2: IDENTICAL_ADDRESSES"
      );

      await expect(factory.createPair(ethers.ZeroAddress, tokenAAddress)).to.be.revertedWith(
        "ReefswapV2: ZERO_ADDRESS"
      );

      await factory.createPair(tokenAAddress, tokenBAddress);
      await expect(factory.createPair(tokenAAddress, tokenBAddress)).to.be.revertedWith(
        "ReefswapV2: PAIR_EXISTS"
      );
    });

    it("enforces feeTo and feeToSetter access control", async function () {
      const { owner, alice, bob, factory } = await deployCore();

      await expect(factory.connect(alice).setFeeTo(alice.address)).to.be.revertedWith(
        "ReefswapV2: FORBIDDEN"
      );

      await expect(factory.connect(alice).setFeeToSetter(alice.address)).to.be.revertedWith(
        "ReefswapV2: FORBIDDEN"
      );

      await factory.setFeeTo(alice.address);
      expect(await factory.feeTo()).to.equal(alice.address);

      await factory.setFeeToSetter(bob.address);
      expect(await factory.feeToSetter()).to.equal(bob.address);

      await expect(factory.setFeeTo(owner.address)).to.be.revertedWith("ReefswapV2: FORBIDDEN");
      await factory.connect(bob).setFeeTo(owner.address);
      expect(await factory.feeTo()).to.equal(owner.address);
    });
  });

  describe("WrappedREEF", function () {
    it("supports deposit by function and receive fallback", async function () {
      const [owner] = await ethers.getSigners();
      const Wrapped = await ethers.getContractFactory("WrappedREEF");
      const wrapped = await Wrapped.deploy();
      const wrappedAddress = await wrapped.getAddress();

      await wrapped.deposit({ value: ethers.parseEther("1.5") });
      await owner.sendTransaction({ to: wrappedAddress, value: ethers.parseEther("0.5") });

      expect(await wrapped.balanceOf(owner.address)).to.equal(ethers.parseEther("2"));
      expect(await wrapped.totalSupply()).to.equal(ethers.parseEther("2"));
    });

    it("withdraws correctly and enforces balances", async function () {
      const [owner] = await ethers.getSigners();
      const Wrapped = await ethers.getContractFactory("WrappedREEF");
      const wrapped = await Wrapped.deploy();

      await wrapped.deposit({ value: ethers.parseEther("2") });
      await wrapped.withdraw(ethers.parseEther("0.75"));
      expect(await wrapped.balanceOf(owner.address)).to.equal(ethers.parseEther("1.25"));

      await expect(wrapped.withdraw(ethers.parseEther("2"))).to.be.revertedWith(
        "WrappedREEF: INSUFFICIENT_BALANCE"
      );
    });

    it("handles allowance and infinite allowance transferFrom semantics", async function () {
      const [owner, alice, bob] = await ethers.getSigners();
      const Wrapped = await ethers.getContractFactory("WrappedREEF");
      const wrapped = await Wrapped.deploy();

      await wrapped.deposit({ value: ethers.parseEther("3") });
      await wrapped.approve(alice.address, ethers.parseEther("2"));

      await wrapped.connect(alice).transferFrom(owner.address, bob.address, ethers.parseEther("1.25"));
      expect(await wrapped.allowance(owner.address, alice.address)).to.equal(ethers.parseEther("0.75"));

      await wrapped.approve(alice.address, ethers.MaxUint256);
      await wrapped.connect(alice).transferFrom(owner.address, bob.address, ethers.parseEther("0.25"));
      expect(await wrapped.allowance(owner.address, alice.address)).to.equal(ethers.MaxUint256);

      expect(await wrapped.balanceOf(bob.address)).to.equal(ethers.parseEther("1.5"));

      await expect(
        wrapped.connect(alice).transferFrom(owner.address, bob.address, ethers.parseEther("100"))
      ).to.be.revertedWith("WrappedREEF: INSUFFICIENT_BALANCE");
    });
  });

  describe("ReefswapV2Pair (core behavior)", function () {
    async function setupPairWithFactory() {
      const [owner, alice, feeRecipient] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory("ReefswapV2Factory");
      const factory = await Factory.deploy(owner.address);

      const Token = await ethers.getContractFactory("Token");
      const LotrToken = await ethers.getContractFactory("LotrToken");
      const tokenA = await Token.deploy(INITIAL_SUPPLY);
      const tokenB = await LotrToken.deploy(INITIAL_SUPPLY);

      await factory.createPair(await tokenA.getAddress(), await tokenB.getAddress());
      const pair = await getPair(factory, tokenA, tokenB);

      return { owner, alice, feeRecipient, factory, tokenA, tokenB, pair };
    }

    async function mintInitialLiquidity(ctx, amountA, amountB, to) {
      const recipient = to || ctx.owner.address;
      await ctx.tokenA.transfer(await ctx.pair.getAddress(), amountA);
      await ctx.tokenB.transfer(await ctx.pair.getAddress(), amountB);
      await ctx.pair.mint(recipient);
    }

    it("mints initial liquidity and locks MINIMUM_LIQUIDITY", async function () {
      const ctx = await setupPairWithFactory();
      const amountA = ethers.parseEther("10");
      const amountB = ethers.parseEther("40");

      await mintInitialLiquidity(ctx, amountA, amountB);

      const [reserveA, reserveB] = await reservesFor(ctx.pair, await ctx.tokenA.getAddress());
      expect(reserveA).to.equal(amountA);
      expect(reserveB).to.equal(amountB);

      const minimumLiquidity = await ctx.pair.MINIMUM_LIQUIDITY();
      expect(await ctx.pair.balanceOf(ethers.ZeroAddress)).to.equal(minimumLiquidity);

      const expectedLiquidity = sqrt(amountA * amountB) - minimumLiquidity;
      expect(await ctx.pair.balanceOf(ctx.owner.address)).to.equal(expectedLiquidity);
      expect(await ctx.pair.totalSupply()).to.equal(expectedLiquidity + minimumLiquidity);
    });

    it("burn returns underlying assets pro-rata after LP tokens are sent to pair", async function () {
      const ctx = await setupPairWithFactory();
      const amountA = ethers.parseEther("25");
      const amountB = ethers.parseEther("25");

      await mintInitialLiquidity(ctx, amountA, amountB);

      const pairAddress = await ctx.pair.getAddress();
      const ownerLiquidity = await ctx.pair.balanceOf(ctx.owner.address);
      const ownerABefore = await ctx.tokenA.balanceOf(ctx.owner.address);
      const ownerBBefore = await ctx.tokenB.balanceOf(ctx.owner.address);

      await ctx.pair.transfer(pairAddress, ownerLiquidity);
      await expect(ctx.pair.burn(ctx.owner.address)).to.emit(ctx.pair, "Burn");

      const ownerAAfter = await ctx.tokenA.balanceOf(ctx.owner.address);
      const ownerBAfter = await ctx.tokenB.balanceOf(ctx.owner.address);

      expect(ownerAAfter).to.be.gt(ownerABefore);
      expect(ownerBAfter).to.be.gt(ownerBBefore);
      expect(await ctx.pair.balanceOf(ctx.owner.address)).to.equal(0);
      expect(await ctx.pair.totalSupply()).to.equal(await ctx.pair.MINIMUM_LIQUIDITY());
    });

    it("enforces swap input/output constraints and updates reserves", async function () {
      const ctx = await setupPairWithFactory();
      const amountA = ethers.parseEther("10");
      const amountB = ethers.parseEther("10");
      await mintInitialLiquidity(ctx, amountA, amountB);

      await expect(
        ctx.pair.swap(ethers.parseEther("1"), 0, ctx.alice.address, "0x")
      ).to.be.revertedWith("ReefswapV2: INSUFFICIENT_INPUT_AMOUNT");

      const inputAmount = ethers.parseEther("1");
      await ctx.tokenA.transfer(await ctx.pair.getAddress(), inputAmount);

      const outputAmount = getAmountOut(inputAmount, amountA, amountB);
      const balanceBefore = await ctx.tokenB.balanceOf(ctx.alice.address);
      const token0 = await ctx.pair.token0();
      const tokenAAddress = await ctx.tokenA.getAddress();
      const amount0Out = token0.toLowerCase() === tokenAAddress.toLowerCase() ? 0n : outputAmount;
      const amount1Out = token0.toLowerCase() === tokenAAddress.toLowerCase() ? outputAmount : 0n;

      await expect(
        ctx.pair.swap(amount0Out, amount1Out, ctx.alice.address, "0x")
      ).to.emit(ctx.pair, "Swap");

      const balanceAfter = await ctx.tokenB.balanceOf(ctx.alice.address);
      expect(balanceAfter - balanceBefore).to.equal(outputAmount);

      const [reserveA, reserveB] = await reservesFor(ctx.pair, await ctx.tokenA.getAddress());
      expect(reserveA).to.equal(amountA + inputAmount);
      expect(reserveB).to.equal(amountB - outputAmount);
    });

    it("supports skim and sync to reconcile balances and reserves", async function () {
      const ctx = await setupPairWithFactory();
      await mintInitialLiquidity(ctx, ethers.parseEther("5"), ethers.parseEther("5"));

      await ctx.tokenA.transfer(await ctx.pair.getAddress(), ethers.parseEther("1"));
      await ctx.tokenB.transfer(await ctx.pair.getAddress(), ethers.parseEther("2"));

      const aliceABefore = await ctx.tokenA.balanceOf(ctx.alice.address);
      const aliceBBefore = await ctx.tokenB.balanceOf(ctx.alice.address);

      await ctx.pair.skim(ctx.alice.address);

      expect(await ctx.tokenA.balanceOf(ctx.alice.address)).to.equal(aliceABefore + ethers.parseEther("1"));
      expect(await ctx.tokenB.balanceOf(ctx.alice.address)).to.equal(aliceBBefore + ethers.parseEther("2"));

      await ctx.tokenA.transfer(await ctx.pair.getAddress(), ethers.parseEther("0.5"));
      await ctx.tokenB.transfer(await ctx.pair.getAddress(), ethers.parseEther("0.5"));
      await ctx.pair.sync();

      const [reserveA, reserveB] = await reservesFor(ctx.pair, await ctx.tokenA.getAddress());
      expect(reserveA).to.equal(ethers.parseEther("5.5"));
      expect(reserveB).to.equal(ethers.parseEther("5.5"));
    });

    it("mints protocol fees to feeTo when enabled and k grows", async function () {
      const ctx = await setupPairWithFactory();
      await ctx.factory.setFeeTo(ctx.feeRecipient.address);

      const amountA = ethers.parseEther("100");
      const amountB = ethers.parseEther("100");
      await mintInitialLiquidity(ctx, amountA, amountB);

      const swapInput = ethers.parseEther("10");
      await ctx.tokenA.transfer(await ctx.pair.getAddress(), swapInput);
      const swapOut = getAmountOut(swapInput, amountA, amountB);
      const token0 = await ctx.pair.token0();
      const tokenAAddress = await ctx.tokenA.getAddress();
      const amount0Out = token0.toLowerCase() === tokenAAddress.toLowerCase() ? 0n : swapOut;
      const amount1Out = token0.toLowerCase() === tokenAAddress.toLowerCase() ? swapOut : 0n;
      await ctx.pair.swap(amount0Out, amount1Out, ctx.owner.address, "0x");

      await ctx.tokenA.transfer(await ctx.pair.getAddress(), ethers.parseEther("20"));
      await ctx.tokenB.transfer(await ctx.pair.getAddress(), ethers.parseEther("20"));
      await ctx.pair.mint(ctx.owner.address);

      expect(await ctx.pair.balanceOf(ctx.feeRecipient.address)).to.be.gt(0);
    });
  });

  describe("ReefswapV2Router02 (integration)", function () {
    it("adds liquidity for ERC20/ERC20 pair and updates reserves", async function () {
      const { owner, factory, router, tokenA, tokenB } = await deployCore();

      const amountA = ethers.parseEther("1000");
      const amountB = ethers.parseEther("3000");
      const deadline = await deadlineAfter();

      await expect(
        router.addLiquidity(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          amountA,
          amountB,
          0,
          0,
          owner.address,
          deadline
        )
      ).to.emit(factory, "PairCreated");

      const pair = await getPair(factory, tokenA, tokenB);
      const [reserveA, reserveB] = await reservesFor(pair, await tokenA.getAddress());

      expect(reserveA).to.equal(amountA);
      expect(reserveB).to.equal(amountB);
      expect(await pair.balanceOf(owner.address)).to.be.gt(0);
    });

    it("swaps exact tokens for tokens and tokens for exact tokens", async function () {
      const { alice, factory, router, tokenA, tokenB } = await deployCore();
      const deadline = await deadlineAfter();

      await router.addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        ethers.parseEther("1000"),
        ethers.parseEther("1000"),
        0,
        0,
        alice.address,
        deadline
      );

      const path = [await tokenA.getAddress(), await tokenB.getAddress()];

      const amountIn = ethers.parseEther("10");
      const quoteOut = await router.connect(alice).getAmountsOut(amountIn, path);
      const beforeSwapOut = await tokenB.balanceOf(alice.address);

      await router
        .connect(alice)
        .swapExactTokensForTokens(amountIn, quoteOut[1], path, alice.address, await deadlineAfter());

      const afterSwapOut = await tokenB.balanceOf(alice.address);
      expect(afterSwapOut - beforeSwapOut).to.equal(quoteOut[1]);

      const exactOut = ethers.parseEther("4");
      const quoteIn = await router.connect(alice).getAmountsIn(exactOut, path);
      const beforeExact = await tokenB.balanceOf(alice.address);

      await router
        .connect(alice)
        .swapTokensForExactTokens(exactOut, quoteIn[0], path, alice.address, await deadlineAfter());

      const afterExact = await tokenB.balanceOf(alice.address);
      expect(afterExact - beforeExact).to.equal(exactOut);

      const pair = await getPair(factory, tokenA, tokenB);
      const [reserveA, reserveB] = await reservesFor(pair, await tokenA.getAddress());
      expect(reserveA).to.be.gt(0);
      expect(reserveB).to.be.gt(0);
    });

    it("supports ETH liquidity and ETH/token swap paths", async function () {
      const { alice, bob, router, tokenA, wrapped } = await deployCore();

      await router.addLiquidityETH(
        await tokenA.getAddress(),
        ethers.parseEther("500"),
        0,
        0,
        alice.address,
        await deadlineAfter(),
        { value: ethers.parseEther("50") }
      );

      const ethToTokenPath = [await wrapped.getAddress(), await tokenA.getAddress()];
      const tokenBefore = await tokenA.balanceOf(alice.address);

      await router
        .connect(alice)
        .swapExactETHForTokens(0, ethToTokenPath, alice.address, await deadlineAfter(), {
          value: ethers.parseEther("1"),
        });

      const tokenAfter = await tokenA.balanceOf(alice.address);
      expect(tokenAfter).to.be.gt(tokenBefore);

      const tokenToEthPath = [await tokenA.getAddress(), await wrapped.getAddress()];
      const sellAmount = (tokenAfter - tokenBefore) / 2n;
      const bobEthBefore = await ethers.provider.getBalance(bob.address);

      await router
        .connect(alice)
        .swapExactTokensForETH(sellAmount, 0, tokenToEthPath, bob.address, await deadlineAfter());

      const bobEthAfter = await ethers.provider.getBalance(bob.address);
      expect(bobEthAfter).to.be.gt(bobEthBefore);
    });

    it("removes ERC20/ETH liquidity and sends proceeds to recipient", async function () {
      const { owner, alice, factory, router, tokenA, wrapped } = await deployCore();

      const tx = await router.addLiquidityETH(
        await tokenA.getAddress(),
        ethers.parseEther("200"),
        0,
        0,
        owner.address,
        await deadlineAfter(),
        { value: ethers.parseEther("20") }
      );
      await tx.wait();

      const pair = await getPair(factory, tokenA, wrapped);
      const liquidity = await pair.balanceOf(owner.address);
      await pair.approve(await router.getAddress(), liquidity);

      const aliceTokenBefore = await tokenA.balanceOf(alice.address);
      const aliceEthBefore = await ethers.provider.getBalance(alice.address);

      await router.removeLiquidityETH(
        await tokenA.getAddress(),
        liquidity / 2n,
        0,
        0,
        alice.address,
        await deadlineAfter()
      );

      const aliceTokenAfter = await tokenA.balanceOf(alice.address);
      const aliceEthAfter = await ethers.provider.getBalance(alice.address);

      expect(aliceTokenAfter).to.be.gt(aliceTokenBefore);
      expect(aliceEthAfter).to.be.gt(aliceEthBefore);
    });

    it("handles multihop swaps across two pairs", async function () {
      const { alice, router, tokenA, tokenB, tokenC } = await deployCore();

      await router.addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        ethers.parseEther("1000"),
        ethers.parseEther("1000"),
        0,
        0,
        alice.address,
        await deadlineAfter()
      );

      await router.addLiquidity(
        await tokenB.getAddress(),
        await tokenC.getAddress(),
        ethers.parseEther("1000"),
        ethers.parseEther("1000"),
        0,
        0,
        alice.address,
        await deadlineAfter()
      );

      const path = [await tokenA.getAddress(), await tokenB.getAddress(), await tokenC.getAddress()];
      const amountIn = ethers.parseEther("15");
      const amountsOut = await router.getAmountsOut(amountIn, path);
      const before = await tokenC.balanceOf(alice.address);

      await router
        .connect(alice)
        .swapExactTokensForTokens(amountIn, amountsOut[2], path, alice.address, await deadlineAfter());

      const after = await tokenC.balanceOf(alice.address);
      expect(after - before).to.equal(amountsOut[2]);
    });

    it("reverts on expired deadlines and invalid ETH swap paths", async function () {
      const { alice, router, tokenA, tokenB, wrapped } = await deployCore();
      const latest = await ethers.provider.getBlock("latest");
      const expired = BigInt(latest.timestamp - 1);

      await expect(
        router.addLiquidity(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          ethers.parseEther("1"),
          ethers.parseEther("1"),
          0,
          0,
          alice.address,
          expired
        )
      ).to.be.revertedWith("ReefswapV2Router: EXPIRED");

      await expect(
        router
          .connect(alice)
          .swapExactETHForTokens(
            0,
            [await tokenA.getAddress(), await wrapped.getAddress()],
            alice.address,
            await deadlineAfter(),
            { value: ethers.parseEther("1") }
          )
      ).to.be.revertedWith("ReefswapV2Router: INVALID_PATH");

      await expect(
        router
          .connect(alice)
          .swapTokensForExactETH(
            ethers.parseEther("1"),
            ethers.parseEther("100"),
            [await wrapped.getAddress(), await tokenB.getAddress()],
            alice.address,
            await deadlineAfter()
          )
      ).to.be.revertedWith("ReefswapV2Router: INVALID_PATH");
    });

    it("removes liquidity with permit signature", async function () {
      const { owner, factory, router, tokenA, tokenB } = await deployCore();

      await router.addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        ethers.parseEther("100"),
        ethers.parseEther("100"),
        0,
        0,
        owner.address,
        await deadlineAfter()
      );

      const pair = await getPair(factory, tokenA, tokenB);
      const liquidity = await pair.balanceOf(owner.address);
      const permitDeadline = await deadlineAfter();
      const sig = await signPermit(
        owner,
        pair,
        await router.getAddress(),
        liquidity,
        permitDeadline
      );

      const ownerTokenABefore = await tokenA.balanceOf(owner.address);
      const ownerTokenBBefore = await tokenB.balanceOf(owner.address);

      await router.removeLiquidityWithPermit(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        liquidity,
        0,
        0,
        owner.address,
        permitDeadline,
        false,
        sig.v,
        sig.r,
        sig.s
      );

      const ownerTokenAAfter = await tokenA.balanceOf(owner.address);
      const ownerTokenBAfter = await tokenB.balanceOf(owner.address);

      expect(ownerTokenAAfter).to.be.gt(ownerTokenABefore);
      expect(ownerTokenBAfter).to.be.gt(ownerTokenBBefore);
      expect(await pair.nonces(owner.address)).to.equal(1);
    });

    it("supports fee-on-transfer tokens through dedicated swap function", async function () {
      const { alice, bob, router, wrapped } = await deployCore();

      const FeeToken = await ethers.getContractFactory("FeeOnTransferToken");
      const feeToken = await FeeToken.deploy(
        "Taxed Token",
        "TAX",
        ethers.parseEther("1000000"),
        100
      ); // 1%

      await feeToken.transfer(alice.address, ethers.parseEther("50000"));
      await feeToken.approve(await router.getAddress(), ethers.MaxUint256);
      await feeToken.connect(alice).approve(await router.getAddress(), ethers.MaxUint256);

      await router.addLiquidityETH(
        await feeToken.getAddress(),
        ethers.parseEther("10000"),
        0,
        0,
        alice.address,
        await deadlineAfter(),
        { value: ethers.parseEther("200") }
      );

      const path = [await feeToken.getAddress(), await wrapped.getAddress()];
      const amountIn = ethers.parseEther("10");

      await expect(
        router
          .connect(alice)
          .swapExactTokensForETH(amountIn, 0, path, bob.address, await deadlineAfter())
      ).to.be.revertedWith("ReefswapV2: K");

      const bobEthBefore = await ethers.provider.getBalance(bob.address);

      await router
        .connect(alice)
        .swapExactTokensForETHSupportingFeeOnTransferTokens(
          amountIn,
          0,
          path,
          bob.address,
          await deadlineAfter()
        );

      const bobEthAfter = await ethers.provider.getBalance(bob.address);
      expect(bobEthAfter).to.be.gt(bobEthBefore);
    });
  });
});
