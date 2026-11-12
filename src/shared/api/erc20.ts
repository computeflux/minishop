import { GraphqlClient } from "./gql";
import { getTeeProviderBase } from "@/shared/config/api";

const erc20GqlClient = new GraphqlClient(`${getTeeProviderBase()}/gql`);

const ERC20_LIST_QUERY = `
  query Erc20List($chainId: Int!) {
    erc20List(chainId: $chainId) {
      address
      rate
      unit
      name
      decimals
      active
    }
  }
`;

export interface Erc20ListEntry {
  address: string;
  rate: string;
  unit: string;
  name: string;
  decimals: number;
  active: boolean;
}

/** 从后端 GraphQL 接口获取 ERC20 代币列表（列表/元数据可缓存，余额不在此接口） */
export async function fetchErc20List(
  chainId: number
): Promise<Erc20ListEntry[]> {
  const data = await erc20GqlClient.query<{ erc20List: Erc20ListEntry[] }>({
    query: ERC20_LIST_QUERY,
    variables: { chainId },
  });
  return data?.erc20List ?? [];
}
