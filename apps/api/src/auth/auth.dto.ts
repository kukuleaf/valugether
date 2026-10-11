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
  MaxLength,
  MinLength,
  Matches,
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
  @IsOptional() @IsString() @MaxLength(8192) kakaoIdToken?: string;
  @IsOptional() @IsString() @MaxLength(4096) kakaoAccessToken?: string;
  @IsOptional() @IsString() @MaxLength(128) kakaoNonce?: string;
  @IsOptional() @IsString() @MinLength(20) @MaxLength(4096)
  @Matches(/^[A-Za-z0-9+/_=-]+$/) naverRefreshToken?: string;
}

export class KakaoLoginDto {
  @IsString() @MinLength(20) @MaxLength(8192) idToken!: string;
  @IsString() @MinLength(20) @MaxLength(128) nonce!: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ConsentDto)
  consents?: ConsentDto[];
}

export class NaverLoginDto {
  @IsString() @MinLength(20) @MaxLength(4096)
  @Matches(/^[A-Za-z0-9+/_=-]+$/) refreshToken!: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ConsentDto)
  consents?: ConsentDto[];
}
