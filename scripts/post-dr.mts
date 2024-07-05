import { Signer, buildSigningConfig, postAndAwaitDataRequest } from '@seda-protocol/dev-tools';

async function main() {
    if (!process.env.DR_BINARY_ID) {
        throw new Error('Please set the DR_BINARY_ID in your env file');
    }

    // Takes the mnemonic from the .env file (SEDA_MNEMONIC and SEDA_RPC_ENDPOINT)
    const signingConfig = buildSigningConfig({});
    const signer = await Signer.fromPartial(signingConfig);

    console.log('Posting and waiting for a result, this may take a lil while..');

    const result = await postAndAwaitDataRequest(signer, {
        consensusOptions: {
            method: 'none'
        },
        drBinaryId: process.env.DR_BINARY_ID,
        drInputs: Buffer.from('eth-usdc'),
        tallyInputs: Buffer.from([]),
        memo: Buffer.from(new Date().toISOString()),
    }, {});

    console.table(result);
}

main();