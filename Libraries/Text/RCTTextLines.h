/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

#import <UIKit/UIKit.h>

#import "RCTBridgeModule.h"

@interface RCTTextLines : NSObject<RCTBridgeModule>

// The maximum width of each line.
@property (assign, nonatomic) CGFloat maxWidth;

// Set the attributed string.
- (void)setText:(NSAttributedString *)text;

// Create an attributed string from a style dictionary, and replace the old string with it.
- (void)setText:(NSString *)text withStyle:(NSDictionary *)style;

// Create an attributed string from a font object, and replace the old string with it.
- (void)setText:(NSString *)text withFont:(UIFont *)font letterSpacing:(NSNumber *)letterSpacing;

// Returns the index of the line containing the given character index.
- (NSUInteger)lineIndexFromCharacterIndex:(NSUInteger)charIndex;

// Returns the lines within the given range.
- (NSRange)lineRangeFromCharacterRange:(NSRange)charRange;

// The text being measured.
- (NSString *)text;

// The array of strings, representing each line.
- (NSArray<NSString *> *)array;

// The number of lines.
- (NSUInteger)count;

// The bounds of the measured text.
- (CGRect)frame;

// The highest current line width.
- (CGFloat)width;

@end
