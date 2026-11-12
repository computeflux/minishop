// Auto-generated from ink! ABI
// DO NOT EDIT MANUALLY

export interface CallContent {
  Contract: string;
  Selector: string;
  Args: string[];
  Amount: U256;
}

export interface Curve {
  Type: string;
  LinearBegin: number;
  LinearEnd: number;
  LinearLength: string;
  StepBegin: number;
  StepEnd: number;
  StepSize: number;
  StepPeriod: string;
  ReciprocalFactor: number;
  ReciprocalXScale: number;
  ReciprocalXOffset: string;
  ReciprocalYOffset: string;
}

export interface Member {
  Account: UniAddr;
  Balance: U256;
}

export interface PendingRuntimeUpgrade {
  Version: number;
  CodeHash: string;
  WasmBytes: string;
  Description: string;
  ActivationHeight: string;
}

export interface Proposal {
  Call: CallContent | null;
  TrackID: number;
  Caller: UniAddr;
  Status: ProposalStatus;
  SubmitBlock: string;
  Deposit: ProposalDeposit;
}

export interface ProposalDeposit {
  Depositor: UniAddr;
  Amount: U256;
  Block: string;
}

export interface ProposalStatus {
  State: number;
  Block: string;
}

export interface ProposalStatusQuery {
  State: number;
  BlockHeight: string;
  ConfirmedNumber: number;
  LastConfirmedBlock: string;
}

export interface ProposalWithID {
  ID: number;
  Proposal: Proposal;
}

export interface TrackData {
  Name: string;
  PreparePeriod: number;
  MaxDeciding: number;
  ConfirmPeriod: number;
  DecisionPeriod: number;
  MinEnactmentPeriod: number;
  DecisionDeposit: U256;
  MaxBalance: U256;
  MinApproval: Curve;
  MinSupport: Curve;
}

export interface TrackWithID {
  ID: number;
  Track: TrackData;
}

export interface U256 {
  _7: string[];
}

export interface UniAddr {
  T: number;
  V: string;
}

export interface Vote {
  Index: number;
  ProposalID: number;
  Caller: UniAddr;
  Pledge: U256;
  OpinionYes: boolean;
  VoteWeight: U256;
  VoteBlock: string;
  Deleted: boolean;
}

export type CancelVoteResponse = void;
export type SetPublicJoinResponse = void;
export type SubmitProposalResponse = void;
export type LeaveResponse = void;
export type SetDefaultTrackResponse = void;
export type VotesResponse = Vote[];
export type DefaultTrackResponse = number;
export type TracksResponse = TrackWithID[];
export type ExecProposalResponse = void;
export type CancelProposalResponse = void;
export type VoteResponse = Vote | null;
export type MembersResponse = Member[];
export type InitResponse = void;
export type SudoResponse = UniAddr;
export type DisableSudoResponse = void;
export type PublicJoinResponse = void;
export type RuntimeMetaResponse = PendingRuntimeUpgrade;
export type GetPublicJoinResponse = boolean;
export type TotalSupplyResponse = U256;
export type ProposalResponse = ProposalWithID | null;
export type SpendResponse = void;
export type BalanceOfResponse = U256;
export type LeaveWithBurnResponse = void;
export type MintResponse = void;
export type RuntimeUpgradeResponse = void;
export type PayoutResponse = void;
export type MigrationResponse = void;
export type RuntimeVersionResponse = number;
export type TransferResponse = void;
export type TrackResponse = TrackData | null;
export type IsSudoDisabledResponse = boolean;
export type SubmitVoteResponse = void;
export type CallAsSudoResponse = void;
export type JoinResponse = void;
export type RuntimeAtHeightResponse = number;
export type SetSudoResponse = void;
export type AddTrackResponse = void;
export type DepositProposalResponse = void;
export type TransferFromResponse = void;
export type ProposalStatusResponse = ProposalStatusQuery | null;
export type ProposalsResponse = ProposalWithID[];
export type VotesOfUserResponse = Vote[];
