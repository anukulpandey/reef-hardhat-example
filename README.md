# Sqwid Marketplace Core

This project has been created using the [Hardhat-reef-template](https://github.com/anukulpandey/reef-hardhat-example).

## Installing

```bash
npm install
```

## Compile contracts

```bash
npx hardhat compile
```

## Deploy contracts

Deploy on Reef:

```bash
npx hardhat run scripts/deploy.js --network reef
```

## Run tests

```bash
npx hardhat test --network reef
```

To reuse a contract already deployed, set its address in the _hardhat.config.js_ file, in the _contracts_ section. If no address is specified, a new contract will be deployed.

## Use account seeds

In order to use your Reef account to deploy the contracts or run the tests, you have to rename the _seeds.example.json_ file to _seeds.json_ and set your seed words there.

## Diagram

![diagram](sqwid-diagram-v02.png)

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
