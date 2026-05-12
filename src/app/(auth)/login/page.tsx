/* eslint-disable @next/next/no-img-element */
import { loginAction } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="login">
      <form className="login__card" action={loginAction}>
        <div className="login__brand">
          <img src="/zeni-logo.png" alt="Zeni Pets" width={58} height={58} />
          <h1>Zeni Pets</h1>
          <p>Painel interno - acesso restrito</p>
        </div>

        {params.error ? (
          <div className="alert alert--danger">Usuário ou senha inválidos.</div>
        ) : null}

        <label className="field">
          <span className="field__label">Usuario</span>
          <input
            className="input"
            name="identifier"
            type="text"
            autoComplete="username"
            placeholder="Fernanda"
          />
        </label>
        <label className="field">
          <span className="field__label">Senha</span>
          <input
            className="input"
            name="password"
            type="password"
            autoComplete="current-password"
          />
        </label>
        <div className="row row--between">
          <label className="check">
            <input type="checkbox" name="remember" defaultChecked /> Manter conectada
          </label>
        </div>
        <button className="btn btn--primary login__button" type="submit">
          Entrar no painel
        </button>
        <p className="login__footer">v0.1 - MVP - desenvolvido por Heitor Fernandes</p>
      </form>
    </main>
  );
}
