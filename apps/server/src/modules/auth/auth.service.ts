import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dto/login.dto';

/**
 * Authentication is delegated to JitWord — the single source of truth for
 * user credentials. Aureka never stores passwords: it proxies the login to
 * JitWord's `/api/v1/user/login` endpoint and reuses the JWT that JitWord
 * returns. The same token is then used for Aureka's own API calls, so a user
 * signed in to JitWord is effectively signed in to Aureka (SSO).
 *
 * Auto-login (see JitWord OpenAPI "鉴权说明"):
 *  - Same-domain deployments share JitWord's `localStorage.jwt_token`.
 *  - Editor links hand the token over via a `?token=` URL parameter.
 * Both flows funnel into `exchangeToken`, which validates the JWT shape and
 * expiry and resolves the owning user without re-prompting for credentials.
 */
export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly config: ConfigService) {}

  /** Proxy a username/password login to JitWord and adopt its JWT. */
  async login(dto: LoginDto) {
    const base = this.jitwordBase();

    let body: any;
    try {
      const res = await fetch(`${base}/api/v1/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: dto.username, password: dto.password }),
      });
      body = await res.json().catch(() => null);
      if (!res.ok) {
        const reason = body?.message || body?.error || `HTTP ${res.status}`;
        this.logger.warn(`JitWord login rejected for "${dto.username}": ${reason}`);
        throw new UnauthorizedException('用户名或密码不正确');
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.error(`Failed to reach JitWord at ${base}: ${(err as Error).message}`);
      throw new UnauthorizedException('无法连接 JitWord 认证服务，请稍后重试');
    }

    const token = this.extractToken(body);
    if (!token) {
      this.logger.error('JitWord login succeeded but returned no token');
      throw new UnauthorizedException('JitWord 未返回有效的登录凭证');
    }

    return { accessToken: token, user: this.resolveUser(token, body, dto.username) };
  }

  /**
   * Exchange an existing JitWord token (from `localStorage.jwt_token` or a
   * `?token=` URL handoff) for an Aureka session without asking for
   * credentials again. This is the auto-login / SSO path.
   */
  async exchangeToken(token: string) {
    const payload = this.decodeJwtPayload(token);
    if (!payload) {
      throw new UnauthorizedException('无效的登录凭证');
    }

    // Reject tokens that JitWord has already expired.
    const exp = typeof payload.exp === 'number' ? payload.exp : null;
    if (exp !== null && exp * 1000 < Date.now()) {
      throw new UnauthorizedException('登录凭证已过期，请重新登录');
    }

    return { accessToken: token, user: this.resolveUser(token, null, undefined) };
  }

  /** JitWord base URL, trimmed of any trailing slash. */
  private jitwordBase(): string {
    const base = this.config.get<string>('jitword.baseUrl') || 'https://next.jitword.com';
    return base.replace(/\/+$/, '');
  }

  /** JitWord responses nest the JWT under `data.token`; be defensive. */
  private extractToken(body: any): string | null {
    const token =
      body?.data?.token ?? body?.token ?? body?.data?.accessToken ?? body?.accessToken;
    return typeof token === 'string' && token.length > 0 ? token : null;
  }

  /** Decode a JWT payload without verifying the signature (done by JitWord). */
  private decodeJwtPayload(token: string): Record<string, any> | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const json = Buffer.from(parts[1], 'base64url').toString('utf8');
      const payload = JSON.parse(json);
      return payload && typeof payload === 'object' ? payload : null;
    } catch {
      return null;
    }
  }

  /**
   * Build the user profile. Prefer explicit fields from the JitWord response,
   * then fall back to claims inside the JWT, then to the login username.
   */
  private resolveUser(token: string, body: any, fallbackUsername?: string): AuthUser {
    const payload = this.decodeJwtPayload(token) ?? {};
    const data = body?.data ?? {};

    const id = String(data.id ?? payload.sub ?? payload.id ?? payload.userId ?? '');
    const username = String(
      data.username ?? payload.username ?? payload.name ?? fallbackUsername ?? '',
    );
    const displayName = String(
      data.displayName ??
        data.nickname ??
        payload.displayName ??
        payload.nickname ??
        payload.name ??
        username,
    );
    const role = String(data.role ?? payload.role ?? 'user');

    return { id: id || username, username, displayName: displayName || username, role };
  }
}
