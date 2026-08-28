export interface AppError {
  code: `${'INPUT' | 'FORMAT' | 'POLICY' | 'CREDENTIAL' | 'PROBE' | 'PROJECTION' | 'DATA' | 'RENDER' | 'STORAGE'}_${string}`;
  message: string;
  retryable: boolean;
  nextAction: string;
  detail: Record<string, string | number | boolean | null>;
}

export function appError(
  code: AppError['code'],
  message: string,
  options: Partial<Pick<AppError, 'retryable' | 'nextAction' | 'detail'>> = {},
): AppError {
  return {
    code,
    message,
    retryable: options.retryable ?? false,
    nextAction: options.nextAction ?? '请检查输入后重试',
    detail: options.detail ?? {},
  };
}
