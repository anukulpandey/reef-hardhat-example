# ReefSwap Comparison

## ReefSwap Contract Diff Report

Comparison source: `contracts/ReefSwap` (this repo) vs `/tmp/reefswap-official/contracts` (upstream clone of `https://github.com/reef-chain/reefswap/tree/main/contracts`).

Generated: 2026-03-03 10:45:36 UTC

Notes:
- `Upstream lines` and `Our lines` are exact line-number ranges for each changed chunk.
- Snippets are shown side-by-side in table columns.
- `—` means that side has no lines for that change chunk (insert/delete).

### `ReefswapV2ERC20.sol`

- Status: 4 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L1 | pragma solidity =0.5.16; | L1-L2 | // SPDX-License-Identifier: MIT<br>pragma solidity ^0.8.28; |
| L21-L24 |     event Approval(address indexed owner, address indexed spender, uint value);<br>    event Transfer(address indexed from, address indexed to, uint value);<br><br>    constructor() public { | L22 |     constructor() { |
| L27 |             chainId := chainid | L25 |             chainId := chainid() |
| L74 |         if (allowance[from][msg.sender] != uint(-1)) { | L72 |         if (allowance[from][msg.sender] != type(uint).max) { |

### `ReefswapV2Factory.sol`

- Status: 2 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L1 | pragma solidity =0.5.16; | L1-L2 | // SPDX-License-Identifier: MIT<br>pragma solidity ^0.8.28; |
| L13-L15 |     event PairCreated(address indexed token0, address indexed token1, address pair, uint);<br><br>    constructor(address _feeToSetter) public { | L14 |     constructor(address _feeToSetter) { |

### `ReefswapV2Pair.sol`

- Status: 3 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L1 | pragma solidity =0.5.16; | L1-L2 | // SPDX-License-Identifier: MIT<br>pragma solidity ^0.8.28; |
| L49-L61 |     event Mint(address indexed sender, uint amount0, uint amount1);<br>    event Burn(address indexed sender, uint amount0, uint amount1, address indexed to);<br>    event Swap(<br>        address indexed sender,<br>        uint amount0In,<br>        uint amount1In,<br>        uint amount0Out,<br>        uint amount1Out,<br>        address indexed to<br>    );<br>    event Sync(uint112 reserve0, uint112 reserve1);<br><br>    constructor() public { | L50 |     constructor() { |
| L74 |         require(balance0 &lt;= uint112(-1) &amp;&amp; balance1 &lt;= uint112(-1), &#x27;ReefswapV2: OVERFLOW&#x27;); | L63 |         require(balance0 &lt;= type(uint112).max &amp;&amp; balance1 &lt;= type(uint112).max, &#x27;ReefswapV2: OVERFLOW&#x27;); |

### `ReefswapV2Router02.sol`

- Status: 5 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L1-L10 | pragma solidity =0.6.6;<br><br>import &#x27;contracts/interfaces/IReefswapV2Factory.sol&#x27;;<br>import &#x27;contracts/libraries/TransferHelper.sol&#x27;;<br><br>import &#x27;contracts/interfaces/IReefswapV2Router02.sol&#x27;;<br>import &#x27;contracts/libraries/ReefswapV2Library.sol&#x27;;<br>import &#x27;contracts/libraries/SafeMath2.sol&#x27;;<br>import &#x27;contracts/interfaces/IERC20.sol&#x27;;<br>import &#x27;contracts/interfaces/IWETH.sol&#x27;; | L1-L11 | // SPDX-License-Identifier: MIT<br>pragma solidity ^0.8.28;<br><br>import &#x27;./interfaces/IReefswapV2Factory.sol&#x27;;<br>import &#x27;./libraries/TransferHelper.sol&#x27;;<br><br>import &#x27;./interfaces/IReefswapV2Router02.sol&#x27;;<br>import &#x27;./libraries/ReefswapV2Library.sol&#x27;;<br>import &#x27;./libraries/SafeMath2.sol&#x27;;<br>import &#x27;./interfaces/IERC20.sol&#x27;;<br>import &#x27;./interfaces/IWETH.sol&#x27;; |
| L23 |     constructor(address _factory, address _WETH) public { | L24 |     constructor(address _factory, address _WETH) { |
| L152 |         uint value = approveMax ? uint(-1) : liquidity; | L153 |         uint value = approveMax ? type(uint).max : liquidity; |
| L166 |         uint value = approveMax ? uint(-1) : liquidity; | L167 |         uint value = approveMax ? type(uint).max : liquidity; |
| L203 |         uint value = approveMax ? uint(-1) : liquidity; | L204 |         uint value = approveMax ? type(uint).max : liquidity; |

### `Token.sol`

- Status: 4 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L1 | pragma solidity ^0.7.0; | L1-L2 | // SPDX-License-Identifier: MIT<br>pragma solidity ^0.8.28; |
| L6 |     constructor(uint256 initialBalance) public ERC20(&quot;Reef&quot;, &quot;REEF&quot;) { | L7 |     constructor(uint256 initialBalance) ERC20(&quot;Reef&quot;, &quot;REEF&quot;) { |
| L14 |     ) public ERC20(&quot;lord of the rings&quot;, &quot;LOTR&quot;) { | L15 |     ) ERC20(&quot;lord of the rings&quot;, &quot;LOTR&quot;) { |
| L20 |     constructor(uint256 initialBalance) public ERC20(&quot;Swar wars&quot;, &quot;SW&quot;) { | L21 |     constructor(uint256 initialBalance) ERC20(&quot;Swar wars&quot;, &quot;SW&quot;) { |

### `WrappedREEF.sol`

- Status: Present only in our repo.

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| — | — | L1-L61 | // SPDX-License-Identifier: MIT<br>pragma solidity ^0.8.28;<br><br>// Minimal wrapped native token compatible with IWETH interface used by ReefswapV2Router02.<br>contract WrappedREEF {<br>    string public name = &quot;Wrapped REEF&quot;;<br>    string public symbol = &quot;WREEF&quot;;<br>    uint8 public decimals = 18;<br><br>    event Approval(address indexed src, address indexed guy, uint wad);<br>    event Transfer(address indexed src, address indexed dst, uint wad);<br>    event Deposit(address indexed dst, uint wad);<br>    event Withdrawal(address indexed src, uint wad);<br><br>    mapping(address =&gt; uint) public balanceOf;<br>    mapping(address =&gt; mapping(address =&gt; uint)) public allowance;<br><br>    receive() external payable {<br>        deposit();<br>    }<br><br>    function deposit() public payable {<br>        balanceOf[msg.sender] += msg.value;<br>        emit Deposit(msg.sender, msg.value);<br>    }<br><br>    function withdraw(uint wad) public {<br>        require(balanceOf[msg.sender] &gt;= wad, &quot;WrappedREEF: INSUFFICIENT_BALANCE&quot;);<br>        balanceOf[msg.sender] -= wad;<br>        (bool success, ) = payable(msg.sender).call{value: wad}(&quot;&quot;);<br>        require(success, &quot;WrappedREEF: TRANSFER_FAILED&quot;);<br>        emit Withdrawal(msg.sender, wad);<br>    }<br><br>    function totalSupply() public view returns (uint) {<br>        return address(this).balance;<br>    }<br><br>    function approve(address guy, uint wad) public returns (bool) {<br>        allowance[msg.sender][guy] = wad;<br>        emit Approval(msg.sender, guy, wad);<br>        return true;<br>    }<br><br>    function transfer(address dst, uint wad) public returns (bool) {<br>        return transferFrom(msg.sender, dst, wad);<br>    }<br><br>    function transferFrom(address src, address dst, uint wad) public returns (bool) {<br>        require(balanceOf[src] &gt;= wad, &quot;WrappedREEF: INSUFFICIENT_BALANCE&quot;);<br>        if (src != msg.sender &amp;&amp; allowance[src][msg.sender] != type(uint).max) {<br>            require(allowance[src][msg.sender] &gt;= wad, &quot;WrappedREEF: INSUFFICIENT_ALLOWANCE&quot;);<br>            allowance[src][msg.sender] -= wad;<br>        }<br><br>        balanceOf[src] -= wad;<br>        balanceOf[dst] += wad;<br>        emit Transfer(src, dst, wad);<br>        return true;<br>    }<br>} |

### `interfaces/IERC20.sol`

- Status: 1 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L1 | pragma solidity &gt;=0.5.0; | L1-L2 | // SPDX-License-Identifier: MIT<br>pragma solidity ^0.8.28; |

### `interfaces/IReefswapV2Callee.sol`

- Status: 1 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L1 | pragma solidity &gt;=0.5.0; | L1-L2 | // SPDX-License-Identifier: MIT<br>pragma solidity ^0.8.28; |

### `interfaces/IReefswapV2ERC20.sol`

- Status: 1 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L1 | pragma solidity &gt;=0.5.0; | L1-L2 | // SPDX-License-Identifier: MIT<br>pragma solidity ^0.8.28; |

### `interfaces/IReefswapV2Factory.sol`

- Status: 1 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L1 | pragma solidity &gt;=0.5.0; | L1-L2 | // SPDX-License-Identifier: MIT<br>pragma solidity ^0.8.28; |

### `interfaces/IReefswapV2Migrator.sol`

- Status: 1 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L1 | pragma solidity &gt;=0.5.0; | L1-L2 | // SPDX-License-Identifier: MIT<br>pragma solidity ^0.8.28; |

### `interfaces/IReefswapV2Pair.sol`

- Status: 3 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L1 | pragma solidity &gt;=0.5.0; | L1-L2 | // SPDX-License-Identifier: MIT<br>pragma solidity ^0.8.28; |
| L3-L5 | interface IReefswapV2Pair {<br>    event Approval(address indexed owner, address indexed spender, uint value);<br>    event Transfer(address indexed from, address indexed to, uint value); | L4 | import &#x27;./IReefswapV2ERC20.sol&#x27;; |
| L7-L23 |     function name() external pure returns (string memory);<br>    function symbol() external pure returns (string memory);<br>    function decimals() external pure returns (uint8);<br>    function totalSupply() external view returns (uint);<br>    function balanceOf(address owner) external view returns (uint);<br>    function allowance(address owner, address spender) external view returns (uint);<br><br>    function approve(address spender, uint value) external returns (bool);<br>    function transfer(address to, uint value) external returns (bool);<br>    function transferFrom(address from, address to, uint value) external returns (bool);<br><br>    function DOMAIN_SEPARATOR() external view returns (bytes32);<br>    function PERMIT_TYPEHASH() external pure returns (bytes32);<br>    function nonces(address owner) external view returns (uint);<br><br>    function permit(address owner, address spender, uint value, uint deadline, uint8 v, bytes32 r, bytes32 s) external;<br> | L6 | interface IReefswapV2Pair is IReefswapV2ERC20 { |

### `interfaces/IReefswapV2Router01.sol`

- Status: 2 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L1 | pragma solidity &gt;=0.6.2; | L1-L2 | // SPDX-License-Identifier: MIT<br>pragma solidity ^0.8.28; |
| L4-L5 |     function factory() external pure returns (address);<br>    function WETH() external pure returns (address); | L5-L6 |     function factory() external view returns (address);<br>    function WETH() external view returns (address); |

### `interfaces/IReefswapV2Router02.sol`

- Status: 1 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L1 | pragma solidity &gt;=0.6.2; | L1-L2 | // SPDX-License-Identifier: MIT<br>pragma solidity ^0.8.28; |

### `interfaces/IWETH.sol`

- Status: 1 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L1 | pragma solidity &gt;=0.5.0; | L1-L2 | // SPDX-License-Identifier: MIT<br>pragma solidity ^0.8.28; |

### `interfaces/V1/IReefswapV1Exchange.sol`

- Status: 1 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L1 | pragma solidity &gt;=0.5.0; | L1-L2 | // SPDX-License-Identifier: MIT<br>pragma solidity ^0.8.28; |

### `interfaces/V1/IReefswapV1Factory.sol`

- Status: 1 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L1 | pragma solidity &gt;=0.5.0; | L1-L2 | // SPDX-License-Identifier: MIT<br>pragma solidity ^0.8.28; |

### `libraries/AddressStringUtil.sol`

- Status: 2 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L3 | pragma solidity &gt;=0.5.0; | L3 | pragma solidity ^0.8.28; |
| L11 |         uint256 addrNum = uint256(addr); | L11 |         uint256 addrNum = uint256(uint160(addr)); |

### `libraries/Babylonian.sol`

- Status: 1 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L3 | pragma solidity &gt;=0.4.0; | L3 | pragma solidity ^0.8.28; |

### `libraries/BitMath.sol`

- Status: 6 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L2 | pragma solidity &gt;=0.5.0; | L2 | pragma solidity ^0.8.28; |
| L48 |         if (x &amp; uint128(-1) &gt; 0) { | L48 |         if (x &amp; type(uint128).max &gt; 0) { |
| L53 |         if (x &amp; uint64(-1) &gt; 0) { | L53 |         if (x &amp; type(uint64).max &gt; 0) { |
| L58 |         if (x &amp; uint32(-1) &gt; 0) { | L58 |         if (x &amp; type(uint32).max &gt; 0) { |
| L63 |         if (x &amp; uint16(-1) &gt; 0) { | L63 |         if (x &amp; type(uint16).max &gt; 0) { |
| L68 |         if (x &amp; uint8(-1) &gt; 0) { | L68 |         if (x &amp; type(uint8).max &gt; 0) { |

### `libraries/FixedPoint.sol`

- Status: 10 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L2 | pragma solidity &gt;=0.4.0; | L2 | pragma solidity ^0.8.28; |
| L81 |         require(upper &lt;= uint112(-1), &#x27;FixedPoint::muluq: upper overflow&#x27;); | L81 |         require(upper &lt;= type(uint112).max, &#x27;FixedPoint::muluq: upper overflow&#x27;); |
| L87 |         require(sum &lt;= uint224(-1), &#x27;FixedPoint::muluq: sum overflow&#x27;); | L87 |         require(sum &lt;= type(uint224).max, &#x27;FixedPoint::muluq: sum overflow&#x27;); |
| L98 |         if (self._x &lt;= uint144(-1)) { | L98 |         if (self._x &lt;= type(uint144).max) { |
| L100 |             require(value &lt;= uint224(-1), &#x27;FixedPoint::divuq: overflow&#x27;); | L100 |             require(value &lt;= type(uint224).max, &#x27;FixedPoint::divuq: overflow&#x27;); |
| L105 |         require(result &lt;= uint224(-1), &#x27;FixedPoint::divuq: overflow&#x27;); | L105 |         require(result &lt;= type(uint224).max, &#x27;FixedPoint::divuq: overflow&#x27;); |
| L115 |         if (numerator &lt;= uint144(-1)) { | L115 |         if (numerator &lt;= type(uint144).max) { |
| L117 |             require(result &lt;= uint224(-1), &#x27;FixedPoint::fraction: overflow&#x27;); | L117 |             require(result &lt;= type(uint224).max, &#x27;FixedPoint::fraction: overflow&#x27;); |
| L121 |             require(result &lt;= uint224(-1), &#x27;FixedPoint::fraction: overflow&#x27;); | L121 |             require(result &lt;= type(uint224).max, &#x27;FixedPoint::fraction: overflow&#x27;); |
| L138 |         if (self._x &lt;= uint144(-1)) { | L138 |         if (self._x &lt;= type(uint144).max) { |

### `libraries/FullMath.sol`

- Status: 4 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L2 | pragma solidity &gt;=0.4.0; | L2 | pragma solidity ^0.8.28; |
| L8 |         uint256 mm = mulmod(x, y, uint256(-1)); | L8 |         uint256 mm = mulmod(x, y, type(uint256).max); |
| L19 |         uint256 pow2 = d &amp; -d; | L19 |         uint256 pow2 = d &amp; (~d + 1); |
| L22 |         l += h * ((-pow2) / pow2 + 1); | L22-L24 |         unchecked {<br>            l += h * ((0 - pow2) / pow2 + 1);<br>        } |

### `libraries/Math.sol`

- Status: 1 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L1 | pragma solidity =0.5.16; | L1-L2 | // SPDX-License-Identifier: MIT<br>pragma solidity ^0.8.28; |

### `libraries/ReefswapV2Library.sol`

- Status: 3 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L1 | pragma solidity &gt;=0.5.0; | L1-L2 | // SPDX-License-Identifier: MIT<br>pragma solidity ^0.8.28; |
| L3 | import &#x27;contracts/interfaces/IReefswapV2Pair.sol&#x27;; | L4 | import &#x27;../interfaces/IReefswapV2Pair.sol&#x27;; |
| L20-L25 |         pair = address(uint(keccak256(abi.encodePacked(<br>                hex&#x27;ff&#x27;,<br>                factory,<br>                keccak256(abi.encodePacked(token0, token1)),<br>                hex&#x27;5ab3fa688c4bf6e08fa334d5f13c17175ae2e87dee7ac66682e2e10a471ef881&#x27; // init code hash<br>            )))); | L21-L34 |         pair = address(<br>            uint160(<br>                uint(<br>                    keccak256(<br>                        abi.encodePacked(<br>                            hex&#x27;ff&#x27;,<br>                            factory,<br>                            keccak256(abi.encodePacked(token0, token1)),<br>                            hex&#x27;5ab3fa688c4bf6e08fa334d5f13c17175ae2e87dee7ac66682e2e10a471ef881&#x27; // init code hash<br>                        )<br>                    )<br>                )<br>            )<br>        ); |

### `libraries/ReefswapV2LiquidityMathLibrary.sol`

- Status: 2 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L1 | pragma solidity &gt;=0.5.0; | L1-L2 | // SPDX-License-Identifier: MIT<br>pragma solidity ^0.8.28; |
| L3-L6 | import &#x27;contracts/interfaces/IReefswapV2Pair.sol&#x27;;<br>import &#x27;contracts/interfaces/IReefswapV2Factory.sol&#x27;;<br>import &#x27;contracts/libraries/Babylonian.sol&#x27;;<br>import &#x27;contracts/libraries/FullMath.sol&#x27;; | L4-L7 | import &#x27;../interfaces/IReefswapV2Pair.sol&#x27;;<br>import &#x27;../interfaces/IReefswapV2Factory.sol&#x27;;<br>import &#x27;./Babylonian.sol&#x27;;<br>import &#x27;./FullMath.sol&#x27;; |

### `libraries/ReefswapV2OracleLibrary.sol`

- Status: 2 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L1 | pragma solidity &gt;=0.5.0; | L1-L2 | // SPDX-License-Identifier: MIT<br>pragma solidity ^0.8.28; |
| L3-L4 | import &#x27;contracts/interfaces/IReefswapV2Pair.sol&#x27;;<br>import &#x27;contracts/libraries/FixedPoint.sol&#x27;; | L4-L5 | import &#x27;../interfaces/IReefswapV2Pair.sol&#x27;;<br>import &#x27;./FixedPoint.sol&#x27;; |

### `libraries/SafeERC20Namer.sol`

- Status: 1 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L3 | pragma solidity &gt;=0.5.0; | L3 | pragma solidity ^0.8.28; |

### `libraries/SafeMath.sol`

- Status: 1 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L1 | pragma solidity =0.5.16; | L1-L2 | // SPDX-License-Identifier: MIT<br>pragma solidity ^0.8.28; |

### `libraries/SafeMath2.sol`

- Status: 1 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L1 | pragma solidity =0.6.6; | L1-L2 | // SPDX-License-Identifier: MIT<br>pragma solidity ^0.8.28; |

### `libraries/TransferHelper.sol`

- Status: 1 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L3 | pragma solidity &gt;=0.6.0; | L3 | pragma solidity ^0.8.28; |

### `libraries/UQ112x112.sol`

- Status: 1 changed chunk(s).

| Upstream lines | Upstream snippet | Our lines | Our snippet |
|---|---|---|---|
| L1 | pragma solidity =0.5.16; | L1-L2 | // SPDX-License-Identifier: MIT<br>pragma solidity ^0.8.28; |
