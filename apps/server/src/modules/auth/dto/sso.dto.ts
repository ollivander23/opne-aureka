import { IsString, IsNotEmpty } from 'class-validator';

/** Payload for the auto-login / SSO token exchange. */
export class SsoDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
