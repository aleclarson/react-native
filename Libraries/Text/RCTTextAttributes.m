/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

#import "RCTTextAttributes.h"

#import "RCTConvert.h"

void RCTAddAttribute(id attributeValue,
                     NSString *attribute,
                     NSMutableAttributedString *attributedString)
{
  if (!attributeValue) {
    return;
  }
  [attributedString enumerateAttribute:attribute inRange:NSMakeRange(0, attributedString.length) options:0 usingBlock:^(id value, NSRange range, BOOL *stop) {
    if (!value) {
      [attributedString addAttribute:attribute value:attributeValue range:range];
    }
  }];
}

void RCTSetFontAttribute(UIFont *font,
                         CGFloat lineHeight,
                         NSNumber *letterSpacing,
                         NSTextAlignment textAlign,
                         NSWritingDirection writingDirection,
                         NSMutableDictionary<NSString *, id> *attributes)
{
  attributes[NSFontAttributeName] = font;
  attributes[NSKernAttributeName] = letterSpacing ?: @0;

  if (lineHeight || textAlign) {
    NSMutableParagraphStyle *paragraphStyle = [NSMutableParagraphStyle new];
    paragraphStyle.alignment = textAlign;
    paragraphStyle.baseWritingDirection = writingDirection;
    paragraphStyle.minimumLineHeight = lineHeight;
    paragraphStyle.maximumLineHeight = lineHeight;
    attributes[NSParagraphStyleAttributeName] = paragraphStyle;

    CGFloat baselineOffset =
      lineHeight > font.lineHeight ?
      lineHeight / 2 - font.lineHeight / 2 : 0;

    if (baselineOffset > 0) {
      attributes[NSBaselineOffsetAttributeName] = @(baselineOffset);
    }
  }
}

void RCTApplyDropShadow(NSDictionary *dropShadow,
                        CALayer *layer)
{
  CGSize offset = [RCTConvert CGSize:dropShadow[@"offset"]];
  NSNumber *radius = dropShadow[@"radius"] ?: @0;
  UIColor *color = [RCTConvert UIColor:dropShadow[@"color"]] ?: [UIColor blackColor];
  NSNumber *opacity = dropShadow[@"opacity"] ?: @1;
  BOOL shouldRasterize = [RCTConvert BOOL:dropShadow[@"shouldRasterizeIOS"]] ?: NO;

  layer.masksToBounds = NO;
  layer.shadowOffset = offset;
  layer.shadowOpacity = opacity.doubleValue;
  layer.shadowRadius = radius.doubleValue;
  layer.shadowColor = color.CGColor;

  if (shouldRasterize) {
    layer.shouldRasterize = YES;
    layer.rasterizationScale = [UIScreen mainScreen].scale;
  } else {
    layer.shouldRasterize = NO;
  }
}
