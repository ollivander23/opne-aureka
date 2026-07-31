import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  // Password policy is owned by JitWord, so we only require a non-empty value.
  @IsString()
  @IsNotEmpty()
  password: string;
}
