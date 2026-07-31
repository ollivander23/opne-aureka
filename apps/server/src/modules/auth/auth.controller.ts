import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SsoDto } from './dto/sso.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Username/password login proxied to JitWord. */
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** Auto-login: exchange an existing JitWord token for an Aureka session. */
  @Post('sso')
  async sso(@Body() dto: SsoDto) {
    return this.authService.exchangeToken(dto.token);
  }
}
