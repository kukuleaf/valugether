import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  Equals,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ConsentDto {
  @IsInt() termId!: number;
  @IsBoolean() agreed!: boolean;
}

export class RegisterDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(10) password!: string;
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ConsentDto)
  consents!: ConsentDto[];
}
export class LoginDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
}
export class RefreshDto {
  @IsString() refreshToken!: string;
}
export class LogoutDto {
  @IsString() refreshToken!: string;
}

export class EmailRequestDto {
  @IsEmail() email!: string;
}

export class TokenConfirmDto {
  @IsString() @MinLength(20) token!: string;
}

export class PasswordResetConfirmDto extends TokenConfirmDto {
  @IsString() @MinLength(10) newPassword!: string;
}

export class DeleteAccountDto {
  @Equals('DELETE_MY_ACCOUNT') confirmation!: string;
  @IsOptional() @IsString() password?: string;
}
