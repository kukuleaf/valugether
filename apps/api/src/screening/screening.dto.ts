import {
  ArrayMaxSize,
  IsArray,
  IsIn,
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
}
export class ScreenSearchDto {
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) marketCodes?: string[];
  @IsOptional() @IsString() strategyCode?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ScreenConditionDto)
  conditions?: ScreenConditionDto[];
  @IsOptional() @IsNumber() @Min(1) @Max(200) limit?: number;
}
