import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
export class ScreenConditionDto {
  @IsString() metricCode!: string;
  @IsIn(['LTE', 'LT', 'GTE', 'GT', 'EQ', 'BETWEEN']) operator!:
    'LTE' | 'LT' | 'GTE' | 'GT' | 'EQ' | 'BETWEEN';
  @IsNumber() target!: number;
  @IsOptional() @IsNumber() target2?: number;
  @IsOptional() @IsNumber() @Min(0.01) weight?: number;
  @IsOptional() @IsBoolean() required?: boolean;
}
export class ScreenSearchDto {
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) marketCodes?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) exchangeCodes?: string[];
  @IsOptional() @IsString() strategyCode?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ScreenConditionDto)
  conditions?: ScreenConditionDto[];
  @IsOptional() @IsNumber() @Min(1) @Max(200) limit?: number;
}

export class SearchHistoryQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) beforeId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
