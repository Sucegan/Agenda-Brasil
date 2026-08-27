export type NormalizedSignup = {
  name: string;
  phone: string;
  email: string;
  password: string;
};

export type SignupValidationResult =
  | { data: NormalizedSignup; error: null }
  | { data: null; error: string };

type SignupUserLike = {
  identities?: unknown[] | null;
};

/**
 * With e-mail confirmation enabled, Supabase deliberately returns an
 * obfuscated user instead of an error when an address is already registered.
 * That response has no identities and must not be presented as a new account.
 */
export function signupLooksLikeExistingAccount(user: SignupUserLike | null | undefined) {
  return Boolean(user && Array.isArray(user.identities) && user.identities.length === 0);
}

export function validateSignupFields(input: { name: string; phone: string; email: string; password: string }): SignupValidationResult {
  const name = input.name.trim().replace(/\s+/g, ' ');
  const phoneDigits = input.phone.replace(/\D/g, '');
  const email = input.email.trim().toLowerCase();

  if (name.length < 2) return { data: null, error: 'Informe seu nome completo com pelo menos 2 caracteres.' };
  if (name.length > 120) return { data: null, error: 'O nome pode ter no máximo 120 caracteres.' };
  if (phoneDigits.length !== 10 && phoneDigits.length !== 11) return { data: null, error: 'Informe um WhatsApp válido com DDD.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { data: null, error: 'Informe um endereço de e-mail válido.' };
  if (input.password.length < 8) return { data: null, error: 'A senha deve ter no mínimo 8 caracteres.' };

  return {
    data: { name, phone: input.phone.trim(), email, password: input.password },
    error: null,
  };
}

export function signupErrorMessage(error: { code?: string; message?: string } | null | undefined) {
  const code = error?.code ?? '';
  const message = error?.message ?? '';

  if (code === 'user_already_exists' || /already registered|already exists/i.test(message)) {
    return 'Este e-mail já está cadastrado. Faça login ou recupere sua senha.';
  }
  if (code === 'weak_password') return 'Escolha uma senha mais forte, com pelo menos 8 caracteres.';
  if (code === 'signup_disabled') return 'Novos cadastros estão temporariamente indisponíveis.';
  if (code === 'captcha_failed') return 'A verificação de segurança expirou. Tente novamente.';
  if (code === 'email_address_invalid') return 'Informe um endereço de e-mail válido.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || /rate limit/i.test(message)) {
    return 'Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.';
  }
  if (/database error saving new user|dados de cadastro inválidos/i.test(message)) {
    return 'Não foi possível criar o perfil. Confira o nome completo, o WhatsApp e tente novamente.';
  }
  if (/(confirmation email|email.*(?:send|authorized))/i.test(message)) {
    return 'Não foi possível enviar o e-mail de confirmação. Tente novamente em alguns minutos.';
  }

  return 'Não foi possível concluir o cadastro agora. Revise os dados e tente novamente.';
}
