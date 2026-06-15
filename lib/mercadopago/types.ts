export interface MpPayment {
  id: number;
  status: string;
  status_detail?: string;
  external_reference?: string | null;
  transaction_amount?: number;
}

export interface MpPreferenceResponse {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
}

export interface MpPaymentSearchResponse {
  results: MpPayment[];
}
