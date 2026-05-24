export type TransactionRequestStatus =
  | "draft"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "submitted"
  | "failed";

export type TransactionRequestSource =
  | "ai_suggestion"
  | "manual"
  | "user_action"
  | "operations_console";

export type TransactionRequest = {
  id: string;
  user_id: string;
  chat_id: string | null;
  project_id: string | null;
  agent_run_id: string | null;
  source: TransactionRequestSource;
  type: "native_evm_transfer";
  status: TransactionRequestStatus;
  from_address: string | null;
  to_address: string;
  chain_id: string | null;
  network_name: string | null;
  native_symbol: "ETH";
  amount_eth: string;
  amount_wei: string;
  human_amount: string;
  amount_display: string;
  reason: string;
  risk_summary: string;
  approval_required: true;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  submitted_at: string | null;
  tx_hash: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};
