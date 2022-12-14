import { MessageApiInjection } from 'naive-ui/es/message/src/MessageProvider';
import { Ref } from 'vue';

export type Result<T, E = undefined> =
  | { ok: true; value: T }
  | { ok: false; error: E | undefined };

export const Ok = <T>(data: T): Result<T, never> => {
  return { ok: true, value: data };
};

export const Err = <E>(error?: E): Result<never, E> => {
  return { ok: false, error };
};

export type ResultRef<T> = Ref<Result<T, any> | undefined>;
