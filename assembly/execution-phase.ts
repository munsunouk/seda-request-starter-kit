import {
  Bytes,
  Console,
  HttpFetchOptions,
  HttpResponse,
  Process,
  httpFetch,
  u128,
  
  
} from "@seda-protocol/as-sdk/assembly";

// Define an interface for the expected data structure
interface StaderData {
  value: string;
}

class TokenDailyStats {
  rateETH: string;

  constructor(rateETH: string) {
    this.rateETH = rateETH; // Initialize rateETH in the constructor
  }
}

class TokenApies {
  apy7DayAvg: string;

  constructor(apy7DayAvg: string) {
    this.apy7DayAvg = apy7DayAvg; // Initialize apy7DayAvg in the constructor
  }
}

class OriginDataInner {
  oTokenDailyStats: TokenDailyStats[];
  oTokenApies: TokenApies[];

  constructor(oTokenDailyStats: TokenDailyStats[], oTokenApies: TokenApies[]) {
    this.oTokenDailyStats = oTokenDailyStats;
    this.oTokenApies = oTokenApies;
  }
}

interface OriginData {
  data: OriginDataInner;
}

/**
 * Executes the data request phase within the SEDA network.
 * This phase is responsible for fetching non-deterministic data (e.g., price of an asset pair)
 * from an external source such as a price feed API. The input specifies the asset pair to fetch.
 */
export function executionPhase(): void {
  // Retrieve the input parameters for the data request (DR).
  // Expected to be in the format "symbolA-symbolB" (e.g., "BTC-USDT").
  const drInputsRaw = Process.getInputs().toUtf8String();

  // Log the asset pair being fetched as part of the Execution Standard Out.
  Console.log(`Fetching price for pair: ${drInputsRaw}`);

  // Split the input string into symbolA and symbolB.
  // Example: "ETH-USDC" will be split into "ETH" and "USDC".
  const drInputs = drInputsRaw.split("-");
  const protocol = drInputs[0];
  const purpose = drInputs[1];

  let response: HttpResponse | null = null;

  if (protocol === "starder") {
    if (purpose === "exchangeRate") {
      response = httpFetch(
        "https://universe.staderlabs.com/eth/exchangeRate"
      );
    } else if (purpose === "apy") {
      response = httpFetch(
        "https://universe.staderlabs.com/eth/apy"
      );
    }
  } else if (protocol === "origin") {

    const url = "https://origin.squids.live/origin-squid:prod/api/graphql";
    const options = new HttpFetchOptions();

    if (purpose === "exchangeRate") {

      let body = `{
        "query": "query oTokenStats($token: String!, $chainId: Int!) { oTokenDailyStats(limit: 1, orderBy: [timestamp_DESC], where: {otoken_eq: $token, chainId_eq: $chainId}) { rateETH }}",
        "variables": {
          "token": "0xdbfefd2e8460a6ee4955a68582f85708baea60a3",
          "chainId": 8453
        }
      }`;

      options.body = Bytes.fromUtf8String(body);

      response = httpFetch(url, options);
    } else if (purpose === "apy") {
      let body = `{
        "query": "query OTokenApy($chainId: Int!, $token: String!) { oTokenApies(limit: 1, orderBy: timestamp_DESC, where: {chainId_eq: $chainId, otoken_eq: $token}) { apy7DayAvg }}",
        "variables": {
          "token": "0xdbfefd2e8460a6ee4955a68582f85708baea60a3",
          "chainId": 8453
        }
      }`;

      options.body = Bytes.fromUtf8String(body);

      response = httpFetch(url, options);
    }
  }

  // Check if the HTTP request was successfully fulfilled.
  if (response === null || !response.ok) {
    // Handle the case where the HTTP request failed or was rejected.
    Console.error(
      `HTTP Response was rejected: ${response ? response.status.toString() : 'unknown'} - ${response ? response.bytes.toUtf8String() : 'no data'}`
    );
    // Report the failure to the SEDA network with an error code of 1.
    Process.error(Bytes.fromUtf8String("Error while fetching price feed"));
  } else {

    let value: string = "0";
    let parsedValue: f32 = 0;

    if (protocol === "starder") {
      if (purpose === "exchangeRate") {
        const data: StaderData = response.bytes.toJSON<StaderData>() ;
        value = data.value;
        parsedValue = f32.parse(value);
      } else if (purpose === "apy") {
        const data: StaderData = response.bytes.toJSON<StaderData>();
        value = data.value;
        parsedValue = f32.parse(value);
      }
    } else if (protocol === "origin") {
      if (purpose === "exchangeRate") {
        const data: OriginData = response.bytes.toJSON<OriginData>();
        value = data.data.oTokenApies[0].apy7DayAvg;
        parsedValue = f32.parse(value);
      } else if (purpose === "apy") {
        const data: OriginData = response.bytes.toJSON<OriginData>();
        value = data.data.oTokenDailyStats[0].rateETH;
        parsedValue = f32.parse(value);
      }
    }

    if (value === "0" || isNaN(parsedValue)) {
      // Report the failure to the SEDA network with an error code of 1.
      Process.error(Bytes.fromUtf8String(`Error while parsing : ${value || 'undefined'}`));
    }
    const result = u128.from(parsedValue * 1000000);

    // Report the successful result back to the SEDA network.
    Process.success(Bytes.fromNumber<u128>(result));
  }
}
