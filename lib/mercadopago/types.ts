export interface MpPayment {
  id: number;
  status: string;
  status_detail?: string;
  external_reference?: string | null;
  transaction_amount?: number;
  /** false = pago hecho con credenciales de prueba. */
  live_mode?: boolean;
}

export interface MpPreferenceResponse {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
}

export interface MpPaymentSearchResponse {
  results: MpPayment[];
}
