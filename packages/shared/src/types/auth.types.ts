/** The signed-in HR as returned by POST /api/auth/login and GET /api/auth/me */
export interface IHrSessionUser {
  id: string;
  name: string;
  email: string;
}

/** Body of POST /api/auth/login */
export interface ILoginRequest {
  email: string;
  password: string;
}

/** Response of POST /api/auth/login and GET /api/auth/me */
export interface IHrSessionResponse {
  user: IHrSessionUser;
}

/** Error body of the auth / HR API: same shape as the applications API */
export interface IApiErrorResponse<Code extends string = string> {
  statusCode: number;
  error: string;
  code: Code;
  message: string;
}
