/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

#import <UIKit/UIKit.h>

#import "RCTDefines.h"

RCT_EXTERN void RCTAddAttribute(id attributeValue,
                                NSString *attribute,
                                NSMutableAttributedString *attributedString);

RCT_EXTERN void RCTSetFontAttribute(UIFont *font,
                                    CGFloat lineHeight,
                                    NSNumber *letterSpacing,
                                    NSTextAlignment textAlign,
                                    NSWritingDirection writingDirection,
                                    NSMutableDictionary<NSString *, id> *attributes);

RCT_EXTERN void RCTApplyDropShadow(NSDictionary *dropShadow,
                                   CALayer *layer);
