export type ActionError = {
  code: string;
  message: string;
};

export type ActionResult<T> = { data: T; error: null } | { data: null; error: ActionError };

export const ok = <T>(data: T): ActionResult<T> => ({ data, error: null });

export const err = (code: string, message: string): ActionResult<null> => ({
  data: null,
  error: { code, message },
});
